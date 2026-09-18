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

export type AccountType = 'personal' | 'enterprise';

/**
 * Lee el tipo de cuenta del claim `user_metadata` del access token.
 *
 * Devuelve null si el token no lleva ese claim, y en ese caso el llamador cae
 * al valor que el backend devolvió en el login/registro (ver useAuth). Es solo
 * gating de UI: el control real lo hace `require_enterprise` en el backend, y
 * un 403 del panel se maneja igual.
 */
export function getJwtAccountType(jwt: string): AccountType | null {
  const decoded = decodeJwtPayload(jwt);
  if (!decoded) return null;
  const metadata = decoded.user_metadata as Record<string, unknown> | undefined;
  const value = metadata?.type_account;
  return value === 'enterprise' || value === 'personal' ? value : null;
}
