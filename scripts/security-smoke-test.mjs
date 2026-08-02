import assert from 'node:assert/strict';
import sessionHandler from '../api/session.js';
import chatHandler from '../api/chat-answer.js';
import userKeyHandler from '../api/user-key.js';
import {
  createEncryptedUserKeyToken,
  createSessionToken,
  getSessionCookie,
  getUserKeyCookie,
  readEncryptedUserOpenAiApiKey,
} from '../lib/api-security.js';

function createResponse() {
  return {
    statusCode: 200,
    headers: new Map(),
    payload: null,
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), value);
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function createRequest({
  method = 'GET',
  body = {},
  cookie = '',
  origin = 'https://plant-speaks.vercel.app',
  extraHeaders = {},
} = {}) {
  return {
    method,
    body,
    headers: {
      host: 'plant-speaks.vercel.app',
      origin,
      'x-forwarded-host': 'plant-speaks.vercel.app',
      'x-forwarded-proto': 'https',
      ...(cookie ? { cookie } : {}),
      ...extraHeaders,
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

function getCookiePair(setCookie) {
  return String(setCookie).split(';')[0];
}

process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
delete process.env.SESSION_SECRET;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.APP_ACCESS_CODE;

const unavailableResponse = createResponse();
await sessionHandler(createRequest(), unavailableResponse);
assert.equal(unavailableResponse.statusCode, 200);
assert.equal(unavailableResponse.payload.available, false);
assert.equal(unavailableResponse.payload.authenticated, false);

delete process.env.VERCEL;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET =
  'test-session-secret-with-more-than-thirty-two-characters';
process.env.APP_ACCESS_CODE = 'class-room-code';

const invalidCodeResponse = createResponse();
await sessionHandler(
  createRequest({
    method: 'POST',
    body: {
      consent: true,
      adultConfirmed: true,
      accessCode: 'wrong-code',
    },
  }),
  invalidCodeResponse
);
assert.equal(invalidCodeResponse.statusCode, 401);
assert.equal(invalidCodeResponse.payload.code, 'ACCESS_CODE_INVALID');

const loginResponse = createResponse();
await sessionHandler(
  createRequest({
    method: 'POST',
    body: {
      consent: true,
      adultConfirmed: true,
      accessCode: 'class-room-code',
    },
  }),
  loginResponse
);
assert.equal(loginResponse.statusCode, 200);
assert.equal(loginResponse.payload.authenticated, true);

const setCookie = loginResponse.headers.get('set-cookie');
assert.match(setCookie, /HttpOnly/);
assert.match(setCookie, /SameSite=Strict/);
assert.match(setCookie, /Secure/);

const cookie = getCookiePair(setCookie);
const authenticatedResponse = createResponse();
await sessionHandler(createRequest({ cookie }), authenticatedResponse);
assert.equal(authenticatedResponse.payload.authenticated, true);

const missingUserKeyResponse = createResponse();
await userKeyHandler(createRequest({ cookie }), missingUserKeyResponse);
assert.equal(missingUserKeyResponse.statusCode, 200);
assert.equal(missingUserKeyResponse.payload.connected, false);

const spoofedUserKeyResponse = createResponse();
await userKeyHandler(
  createRequest({
    cookie,
    extraHeaders: { 'x-user-openai-api-key': 'sk-spoofed-key-must-be-ignored' },
  }),
  spoofedUserKeyResponse
);
assert.equal(spoofedUserKeyResponse.payload.connected, false);

const testUserKey = 'sk-test-user-owned-key-not-a-real-secret';
const encryptedToken = createEncryptedUserKeyToken(
  createRequest({ cookie }),
  testUserKey
);
assert.ok(encryptedToken);
assert.equal(encryptedToken.includes(testUserKey), false);
const userKeySetCookie = getUserKeyCookie(createRequest({ cookie }), encryptedToken);
assert.match(userKeySetCookie, /HttpOnly/);
assert.match(userKeySetCookie, /SameSite=Strict/);
assert.match(userKeySetCookie, /Secure/);

const combinedCookie = `${cookie}; ${getCookiePair(userKeySetCookie)}`;
assert.equal(
  readEncryptedUserOpenAiApiKey(createRequest({ cookie: combinedCookie })),
  testUserKey
);
const connectedUserKeyResponse = createResponse();
await userKeyHandler(
  createRequest({ cookie: combinedCookie }),
  connectedUserKeyResponse
);
assert.equal(connectedUserKeyResponse.payload.connected, true);

const otherSessionToken = createSessionToken();
const otherSessionCookie = getCookiePair(
  getSessionCookie(createRequest(), otherSessionToken)
);
const wrongSessionCookie = `${otherSessionCookie}; ${getCookiePair(userKeySetCookie)}`;
assert.equal(
  readEncryptedUserOpenAiApiKey(createRequest({ cookie: wrongSessionCookie })),
  ''
);

const expiredUserKeyResponse = createResponse();
await userKeyHandler(
  createRequest({ method: 'DELETE', cookie: combinedCookie }),
  expiredUserKeyResponse
);
assert.equal(expiredUserKeyResponse.payload.connected, false);
assert.match(expiredUserKeyResponse.headers.get('set-cookie'), /Max-Age=0/);

const unauthorizedAiResponse = createResponse();
await chatHandler(
  createRequest({
    method: 'POST',
    body: { question: '오늘 기분이 어때?' },
  }),
  unauthorizedAiResponse
);
assert.equal(unauthorizedAiResponse.statusCode, 401);
assert.equal(unauthorizedAiResponse.payload.code, 'SESSION_REQUIRED');

const crossOriginResponse = createResponse();
await sessionHandler(
  createRequest({
    method: 'POST',
    origin: 'https://malicious.example',
    body: {
      consent: true,
      adultConfirmed: true,
      accessCode: 'class-room-code',
    },
  }),
  crossOriginResponse
);
assert.equal(crossOriginResponse.statusCode, 403);
assert.equal(crossOriginResponse.payload.code, 'ORIGIN_NOT_ALLOWED');

console.log('Security smoke test passed.');
