// 상태는 브라우저 localStorage에 저장됨
// 이 엔드포인트는 하위 호환성을 위해 유지 (항상 성공 반환)
export default async function handler(req, res) {
  // GET, POST, PUT 모두 성공 반환
  return res.json({ ok: true, state: null });
}
