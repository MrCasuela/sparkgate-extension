import { useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/auth';
import {
  getJwt,
  setJwt,
  setUserId,
  clearAuth,
  getUserId,
  getTypeAccount,
  setTypeAccount,
} from '../utils/storage';
import { isJwtExpired, getJwtAccountType } from '../utils/jwt';
import { SESSION_EXPIRED_EVENT } from '../utils/authEvents';
import type { AccountType, RegisterResponse } from '../types/auth';

export interface UseAuthReturn {
  isAuthenticated: boolean;
  userId: string | null;
  /** HU21 AC4: solo las cuentas de empresa ven la puerta al panel. */
  isEnterprise: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    typeAccount?: AccountType,
    organizationName?: string,
  ) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

/**
 * El claim del token es la fuente preferida (sobrevive a un storage vaciado a
 * medias); el valor guardado en el login es el respaldo para el caso en que el
 * access token no incluya `user_metadata`.
 */
async function resolveAccountType(jwt: string): Promise<AccountType> {
  return getJwtAccountType(jwt) ?? (await getTypeAccount()) ?? 'personal';
}

export function useAuth(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserIdState] = useState<string | null>(null);
  const [isEnterprise, setIsEnterprise] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    const jwt = await getJwt();
    const uid = await getUserId();
    if (jwt !== null && isJwtExpired(jwt)) {
      await clearAuth();
      setIsAuthenticated(false);
      setUserIdState(null);
      setIsEnterprise(false);
    } else {
      setIsAuthenticated(jwt !== null);
      setUserIdState(uid);
      setIsEnterprise(jwt !== null && (await resolveAccountType(jwt)) === 'enterprise');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const onSessionExpired = () => {
      setIsAuthenticated(false);
      setUserIdState(null);
      setIsEnterprise(false);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      await setJwt(res.access_token);
      await setUserId(res.user_id);
      if (res.type_account) await setTypeAccount(res.type_account);
      setIsAuthenticated(true);
      setUserIdState(res.user_id);
      setIsEnterprise((await resolveAccountType(res.access_token)) === 'enterprise');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al iniciar sesión';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      typeAccount: AccountType = 'personal',
      organizationName?: string,
    ) => {
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.register(email, password, typeAccount, organizationName);
      if (res.access_token) {
        await setJwt(res.access_token);
        await setUserId(res.user_id);
        await setTypeAccount(res.type_account ?? typeAccount);
        setIsAuthenticated(true);
        setUserIdState(res.user_id);
        setIsEnterprise((await resolveAccountType(res.access_token)) === 'enterprise');
      }
      return res;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al registrar';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore logout errors
    } finally {
      await clearAuth();
      setIsAuthenticated(false);
      setUserIdState(null);
      setIsEnterprise(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    isAuthenticated,
    userId,
    isEnterprise,
    loading,
    error,
    login,
    register,
    logout,
    clearError,
    checkAuth,
  };
}
