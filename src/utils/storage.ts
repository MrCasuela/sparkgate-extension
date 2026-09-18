import type { AccountType } from './jwt';

const KEYS = {
  JWT: 'jwt',
  USER_ID: 'user_id',
  TYPE_ACCOUNT: 'type_account',
  THEME: 'theme',
} as const;

export async function getJwt(): Promise<string | null> {
  const result = await chrome.storage.local.get(KEYS.JWT);
  return (result[KEYS.JWT] as string | undefined) ?? null;
}

export async function setJwt(token: string): Promise<void> {
  await chrome.storage.local.set({ [KEYS.JWT]: token });
}

export async function getUserId(): Promise<string | null> {
  const result = await chrome.storage.local.get(KEYS.USER_ID);
  return (result[KEYS.USER_ID] as string | undefined) ?? null;
}

export async function setUserId(id: string): Promise<void> {
  await chrome.storage.local.set({ [KEYS.USER_ID]: id });
}

/**
 * Respaldo del tipo de cuenta para cuando el access token no trae el claim
 * `user_metadata`. Lo escribe el login/registro con lo que respondió el backend.
 */
export async function getTypeAccount(): Promise<AccountType | null> {
  const result = await chrome.storage.local.get(KEYS.TYPE_ACCOUNT);
  const value = result[KEYS.TYPE_ACCOUNT] as string | undefined;
  return value === 'enterprise' || value === 'personal' ? value : null;
}

export async function setTypeAccount(typeAccount: AccountType): Promise<void> {
  await chrome.storage.local.set({ [KEYS.TYPE_ACCOUNT]: typeAccount });
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove([KEYS.JWT, KEYS.USER_ID, KEYS.TYPE_ACCOUNT]);
}

export async function getTheme(): Promise<'light' | 'dark'> {
  const result = await chrome.storage.local.get(KEYS.THEME);
  return (result[KEYS.THEME] as 'light' | 'dark') ?? 'light';
}

export async function setTheme(theme: 'light' | 'dark'): Promise<void> {
  await chrome.storage.local.set({ [KEYS.THEME]: theme });
}
