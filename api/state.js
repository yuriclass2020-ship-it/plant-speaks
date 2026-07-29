import { applyApiSecurityHeaders } from '../lib/api-security.js';

export default async function handler(_req, res) {
  applyApiSecurityHeaders(res);
  return res.status(410).json({
    ok: false,
    code: 'LOCAL_STATE_ONLY',
    error: '관찰 기록은 개인정보 보호를 위해 이 기기에만 저장돼요.',
    state: null,
  });
}
