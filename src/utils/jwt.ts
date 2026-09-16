function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const payload = jwt.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export function getJwtExpiry(jwt: string): number | null {
  const decoded = decodeJwtPayload(jwt);
  return decoded && typeof decoded.exp === 'number' ? decoded.exp : null;
}

export function isJwtExpired(jwt: string, nowMs = Date.now()): boolean {
  const exp = getJwtExpiry(jwt);
  return exp !== null && exp * 1000 <= nowMs;
}

export function getJwtEmail(jwt: string): string | null {
  const decoded = decodeJwtPayload(jwt);
  return decoded && typeof decoded.email === 'string' ? decoded.email : null;
}