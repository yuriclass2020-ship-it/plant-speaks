import {
  PRIVACY_POLICY_VERSION,
  applyApiSecurityHeaders,
  authorizeSessionCreation,
  createSessionToken,
  getExpiredSessionCookie,
  getSessionReadiness,
  getSessionCookie,
  isValidAccessCode,
  readSession,
  validateSessionRequestOrigin,
} from '../lib/api-security.js';

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (!validateSessionRequestOrigin(req)) {
    return res.status(403).json({
      ok: false,
      code: 'ORIGIN_NOT_ALLOWED',
      error: '허용되지 않은 요청이에요.',
    });
  }

  const readiness = getSessionReadiness();
  if (req.method === 'GET') {
    return res.json({
      ok: true,
      available: readiness.available,
      authenticated: readiness.available && Boolean(readSession(req)),
      accessCodeRequired: readiness.accessCodeRequired,
      policyVersion: PRIVACY_POLICY_VERSION,
      unavailableReason: readiness.available
        ? ''
        : '공개 서비스를 위한 보안 설정을 준비하고 있어요.',
    });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', getExpiredSessionCookie(req));
    return res.json({ ok: true });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      code: 'METHOD_NOT_ALLOWED',
      error: '지원하지 않는 요청이에요.',
    });
  }
  if (!readiness.available) {
    return res.status(503).json({
      ok: false,
      code: 'SECURITY_CONFIGURATION_REQUIRED',
      error: '안전한 서비스 설정을 준비하고 있어요.',
    });
  }

  const { consent, adultConfirmed, accessCode } = req.body ?? {};
  if (consent !== true || adultConfirmed !== true) {
    return res.status(400).json({
      ok: false,
      code: 'CONSENT_REQUIRED',
      error: '선생님 또는 보호자와 함께 개인정보 안내를 확인해 주세요.',
    });
  }
  if (!(await authorizeSessionCreation(req, res))) return;
  if (!isValidAccessCode(accessCode)) {
    return res.status(401).json({
      ok: false,
      code: 'ACCESS_CODE_INVALID',
      error: '참여 코드를 다시 확인해 주세요.',
    });
  }

  const token = createSessionToken();
  if (!token) {
    return res.status(503).json({
      ok: false,
      code: 'SESSION_CONFIGURATION_REQUIRED',
      error: '보안 세션 설정을 확인하고 있어요.',
    });
  }

  res.setHeader('Set-Cookie', getSessionCookie(req, token));
  return res.json({
    ok: true,
    authenticated: true,
    policyVersion: PRIVACY_POLICY_VERSION,
  });
}
