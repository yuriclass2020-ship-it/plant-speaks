import OpenAI from 'openai';
import {
  authorizeSessionRequest,
  authorizeUserKeyConnection,
  createEncryptedUserKeyToken,
  getExpiredUserKeyCookie,
  getPublicOpenAiError,
  getUserKeyCookie,
  logOpenAiError,
  readEncryptedUserOpenAiApiKey,
} from '../lib/api-security.js';

function isPlausibleOpenAiApiKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  return key.startsWith('sk-') && key.length >= 20 && key.length <= 512;
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return res.status(405).json({
      ok: false,
      code: 'METHOD_NOT_ALLOWED',
      error: '지원하지 않는 요청이에요.',
    });
  }

  const session = authorizeSessionRequest(req, res, { maxBodyBytes: 2048 });
  if (!session) return;

  if (req.method === 'GET') {
    return res.json({
      ok: true,
      connected: Boolean(readEncryptedUserOpenAiApiKey(req)),
    });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', getExpiredUserKeyCookie(req));
    return res.json({ ok: true, connected: false });
  }

  const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
  if (!isPlausibleOpenAiApiKey(apiKey)) {
    return res.status(400).json({
      ok: false,
      code: 'USER_API_KEY_INVALID',
      error: 'sk-로 시작하는 OpenAI API 키를 확인해 주세요.',
    });
  }
  if (!(await authorizeUserKeyConnection(req, res, session))) return;

  try {
    const openai = new OpenAI({
      apiKey,
      timeout: 10000,
      maxRetries: 0,
    });
    await openai.models.list();

    const token = createEncryptedUserKeyToken(req, apiKey);
    if (!token) {
      return res.status(503).json({
        ok: false,
        code: 'USER_KEY_ENCRYPTION_FAILED',
        error: 'API 키를 안전하게 연결하지 못했어요. 잠시 후 다시 해 주세요.',
      });
    }

    res.setHeader('Set-Cookie', getUserKeyCookie(req, token));
    return res.json({ ok: true, connected: true });
  } catch (error) {
    logOpenAiError('User OpenAI key validation error', error);
    const publicError = getPublicOpenAiError(
      error,
      'OpenAI API 키를 확인하지 못했어요. 잠시 후 다시 해 주세요.'
    );
    return res.status(publicError.status).json({
      ok: false,
      code: publicError.code,
      error: publicError.error,
    });
  }
}
