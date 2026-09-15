export function getJwtExpiry(jwt: string): number | null {
  try {
    const payload = jwt.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

export function isJwtExpired(jwt: string, nowMs = Date.now()): boolean {
  const exp = getJwtExpiry(jwt);
  return exp !== null && exp * 1000 <= nowMs;
}