import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

export const PRIVACY_POLICY_VERSION = '2026-07-29';
export const SESSION_COOKIE_NAME = 'plant_talk_session';

const SESSION_TTL_SECONDS = 60 * 60 * 12;
const ephemeralCache = new Map();
const localSessionAttempts = new Map();
let rateLimiters;

function isProduction() {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

function parsePositiveInteger(name, fallback, min = 1, max = 100000) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function getSessionSecret() {
  const configured = String(process.env.SESSION_SECRET ?? '').trim();
  if (configured) return configured;
  return isProduction() ? '' : 'plant-talk-local-development-session-secret';
}

function getRedisConfig() {
  return {
    url: String(
      process.env.UPSTASH_REDIS_REST_URL ??
        process.env.KV_REST_API_URL ??
        ''
    ).trim(),
    token: String(
      process.env.UPSTASH_REDIS_REST_TOKEN ??
        process.env.KV_REST_API_TOKEN ??
        ''
    ).trim(),
  };
}

export function getSecurityReadiness() {
  const missing = [];
  const redis = getRedisConfig();

  if (getSessionSecret().length < 32) missing.push('보안 세션');
  if (!redis.url || !redis.token) missing.push('사용량 보호');
  if (!String(process.env.OPENAI_API_KEY ?? '').trim()) missing.push('AI 연결');

  return {
    available: !isProduction() || missing.length === 0,
    missing,
    accessCodeRequired: Boolean(
      String(process.env.APP_ACCESS_CODE ?? '').trim()
    ),
  };
}

export function applyApiSecurityHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function firstHeader(value) {
  return String(Array.isArray(value) ? value[0] : value ?? '')
    .split(',')[0]
    .trim();
}

function getRequestOrigin(req) {
  const host =
    firstHeader(req.headers['x-forwarded-host']) ||
    firstHeader(req.headers.host);
  const protocol =
    firstHeader(req.headers['x-forwarded-proto']) ||
    (host.startsWith('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : 'https');
  return host ? `${protocol}://${host}` : '';
}

export function validateSessionRequestOrigin(req) {
  const origin = firstHeader(req.headers.origin).replace(/\/+$/, '');
  if (!origin) return !isProduction() || req.method === 'GET';

  const configuredOrigins = String(process.env.APP_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const allowedOrigins = new Set([
    getRequestOrigin(req).replace(/\/+$/, ''),
    ...configuredOrigins,
  ]);
  return allowedOrigins.has(origin);
}

function parseCookies(req) {
  const cookieHeader = firstHeader(req.headers.cookie);
  if (!cookieHeader) return {};

  return Object.fromEntries(
    cookieHeader.split(';').map((cookie) => {
      const separator = cookie.indexOf('=');
      const name = separator >= 0 ? cookie.slice(0, separator).trim() : cookie;
      const encodedValue =
        separator >= 0 ? cookie.slice(separator + 1).trim() : '';
      try {
        return [name, decodeURIComponent(encodedValue)];
      } catch {
        return [name, ''];
      }
    })
  );
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function safelyEqual(first, second) {
  const firstBuffer = createHash('sha256').update(String(first)).digest();
  const secondBuffer = createHash('sha256').update(String(second)).digest();
  return timingSafeEqual(firstBuffer, secondBuffer);
}

export function createSessionToken() {
  const secret = getSessionSecret();
  if (secret.length < 32) return '';

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      sid: randomBytes(24).toString('base64url'),
      iat: issuedAt,
      exp: issuedAt + SESSION_TTL_SECONDS,
      policy: PRIVACY_POLICY_VERSION,
    })
  ).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function readSession(req) {
  const secret = getSessionSecret();
  const token = parseCookies(req)[SESSION_COOKIE_NAME];
  if (secret.length < 32 || !token) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safelyEqual(signature, sign(payload, secret))) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    );
    const now = Math.floor(Date.now() / 1000);
    if (
      session?.v !== 1 ||
      typeof session.sid !== 'string' ||
      session.sid.length < 20 ||
      session.exp <= now ||
      session.policy !== PRIVACY_POLICY_VERSION
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function isSecureRequest(req) {
  return (
    isProduction() || firstHeader(req.headers['x-forwarded-proto']) === 'https'
  );
}

export function getSessionCookie(req, token) {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'HttpOnly',
    'SameSite=Strict',
    isSecureRequest(req) ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export function getExpiredSessionCookie(req) {
  return [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Strict',
    isSecureRequest(req) ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export function isValidAccessCode(value) {
  const expected = String(process.env.APP_ACCESS_CODE ?? '').trim();
  if (!expected) return true;
  return safelyEqual(String(value ?? '').trim(), expected);
}

function getDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getClientIpHash(req) {
  const ip =
    firstHeader(req.headers['x-forwarded-for']) ||
    firstHeader(req.headers['x-real-ip']) ||
    firstHeader(req.socket?.remoteAddress) ||
    'unknown';
  return createHmac('sha256', getSessionSecret())
    .update(ip)
    .digest('hex')
    .slice(0, 24);
}

function getLimitConfig() {
  return {
    chat: parsePositiveInteger('DAILY_CHAT_LIMIT', 30, 1, 200),
    photo: parsePositiveInteger('DAILY_PHOTO_ANALYSIS_LIMIT', 12, 1, 100),
    draft: parsePositiveInteger('DAILY_DRAFT_LIMIT', 8, 1, 50),
    tts: parsePositiveInteger('DAILY_TTS_LIMIT', 30, 1, 200),
    burst: parsePositiveInteger('AI_BURST_LIMIT_PER_MINUTE', 60, 5, 500),
    global: parsePositiveInteger('GLOBAL_DAILY_AI_BUDGET', 600, 20, 100000),
    ip: parsePositiveInteger('IP_DAILY_AI_BUDGET', 200, 20, 100000),
  };
}

function createRateLimiters() {
  if (rateLimiters) return rateLimiters;
  const redisConfig = getRedisConfig();
  if (!redisConfig.url || !redisConfig.token) return null;

  const redis = new Redis(redisConfig);
  const limits = getLimitConfig();
  const baseOptions = { redis, analytics: false, ephemeralCache };
  rateLimiters = {
    sessionCreate: new Ratelimit({
      ...baseOptions,
      prefix: 'plant-talk:session-create',
      limiter: Ratelimit.fixedWindow(10, '1 h'),
    }),
    burst: new Ratelimit({
      ...baseOptions,
      prefix: 'plant-talk:burst',
      limiter: Ratelimit.fixedWindow(limits.burst, '1 m'),
    }),
    global: new Ratelimit({
      ...baseOptions,
      prefix: 'plant-talk:global',
      limiter: Ratelimit.fixedWindow(limits.global, '1 d'),
    }),
    ip: new Ratelimit({
      ...baseOptions,
      prefix: 'plant-talk:ip',
      limiter: Ratelimit.fixedWindow(limits.ip, '1 d'),
    }),
    session: Object.fromEntries(
      ['chat', 'photo', 'draft', 'tts'].map((kind) => [
        kind,
        new Ratelimit({
          ...baseOptions,
          prefix: `plant-talk:session:${kind}`,
          limiter: Ratelimit.fixedWindow(limits[kind], '1 d'),
        }),
      ])
    ),
  };
  return rateLimiters;
}

async function checkRateLimit(req, session, kind) {
  const limiters = createRateLimiters();
  if (!limiters) throw new Error('Persistent rate limiting is not configured');

  const dateKey = getDateKey();
  const ipHash = getClientIpHash(req);
  const costs = { chat: 1, photo: 5, draft: 3, tts: 2 };
  const cost = costs[kind] ?? 1;

  const burst = await limiters.burst.limit(ipHash);
  if (!burst.success) return { ...burst, scope: 'burst' };

  const sessionRate = await limiters.session[kind].limit(
    `${session.sid}:${dateKey}`
  );
  if (!sessionRate.success) return { ...sessionRate, scope: 'session' };

  const ipRate = await limiters.ip.limit(`${ipHash}:${dateKey}`, {
    rate: cost,
  });
  if (!ipRate.success) return { ...ipRate, scope: 'ip' };

  const globalRate = await limiters.global.limit(dateKey, { rate: cost });
  if (!globalRate.success) return { ...globalRate, scope: 'global' };

  return { ...sessionRate, scope: 'session' };
}

export async function authorizeSessionCreation(req, res) {
  const ipHash = getClientIpHash(req);
  const limiters = createRateLimiters();

  try {
    let rate;
    if (limiters) {
      rate = await limiters.sessionCreate.limit(ipHash);
    } else if (!isProduction()) {
      const now = Date.now();
      const saved = localSessionAttempts.get(ipHash);
      const attempts = saved?.reset > now ? saved.attempts : 0;
      const reset = saved?.reset > now ? saved.reset : now + 60 * 60 * 1000;
      const nextAttempts = attempts + 1;
      localSessionAttempts.set(ipHash, { attempts: nextAttempts, reset });
      rate = {
        success: nextAttempts <= 10,
        limit: 10,
        remaining: Math.max(0, 10 - nextAttempts),
        reset,
      };
    } else {
      throw new Error('Persistent session limiting is not configured');
    }

    if (!rate.success) {
      const retryAfter = Math.max(
        1,
        Math.ceil((rate.reset - Date.now()) / 1000)
      );
      res.setHeader('Retry-After', String(retryAfter));
      sendError(
        res,
        429,
        'SESSION_RATE_LIMIT_REACHED',
        '시작 요청이 너무 많아요. 잠시 후 다시 확인해 주세요.',
        { retryAfter }
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error('Session rate limit error:', error);
    sendError(
      res,
      503,
      'RATE_LIMIT_UNAVAILABLE',
      '사용량 보호 기능을 확인하지 못했어요. 잠시 후 다시 해 주세요.'
    );
    return false;
  }
}

function bodyByteLength(body) {
  try {
    return Buffer.byteLength(JSON.stringify(body ?? {}), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function sendError(res, status, code, error, extra = {}) {
  return res.status(status).json({ ok: false, code, error, ...extra });
}

export async function authorizeAiRequest(
  req,
  res,
  { kind, maxBodyBytes = 128 * 1024 }
) {
  applyApiSecurityHeaders(res);

  if (!getSecurityReadiness().available) {
    sendError(
      res,
      503,
      'SECURITY_CONFIGURATION_REQUIRED',
      '안전한 서비스 설정을 준비하고 있어요.'
    );
    return null;
  }
  if (!validateSessionRequestOrigin(req)) {
    sendError(res, 403, 'ORIGIN_NOT_ALLOWED', '허용되지 않은 요청이에요.');
    return null;
  }

  const session = readSession(req);
  if (!session) {
    sendError(
      res,
      401,
      'SESSION_REQUIRED',
      '안전한 사용 동의를 다시 확인해 주세요.'
    );
    return null;
  }
  if (bodyByteLength(req.body) > maxBodyBytes) {
    sendError(res, 413, 'PAYLOAD_TOO_LARGE', '보낸 내용이 너무 커요.');
    return null;
  }

  try {
    const rate = await checkRateLimit(req, session, kind);
    if (!rate.success) {
      const retryAfter = Math.max(
        1,
        Math.ceil((rate.reset - Date.now()) / 1000)
      );
      res.setHeader('Retry-After', String(retryAfter));
      sendError(
        res,
        429,
        'RATE_LIMIT_REACHED',
        rate.scope === 'global'
          ? '오늘 서비스 전체 AI 사용량을 모두 사용했어요.'
          : rate.scope === 'burst'
            ? '질문이 너무 빠르게 이어졌어요. 잠시 후 다시 해 주세요.'
            : '오늘 AI 사용량을 모두 사용했어요.',
        {
          scope: rate.scope,
          usage: rate.limit - rate.remaining,
          limit: rate.limit,
          retryAfter,
        }
      );
      return null;
    }

    res.setHeader('X-RateLimit-Limit', String(rate.limit));
    res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
    return {
      session,
      rate,
      safetyIdentifier: createHash('sha256')
        .update(session.sid)
        .digest('hex')
        .slice(0, 64),
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    sendError(
      res,
      503,
      'RATE_LIMIT_UNAVAILABLE',
      '사용량 보호 기능을 확인하지 못했어요. 잠시 후 다시 해 주세요.'
    );
    return null;
  }
}

export function getServerOpenAiApiKey() {
  return String(process.env.OPENAI_API_KEY ?? '').trim();
}
