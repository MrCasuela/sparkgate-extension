import { useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/auth';
import { getJwt, setJwt, setUserId, clearAuth, getUserId } from '../utils/storage';

export interface UseAuthReturn {
  isAuthenticated: boolean;
  userId: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    const jwt = await getJwt();
    const uid = await getUserId();
    setIsAuthenticated(jwt !== null);
    setUserIdState(uid);
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      await setJwt(res.access_token);
      await setUserId(res.user_id);
      setIsAuthenticated(true);
      setUserIdState(res.user_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al iniciar sesión';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      await authApi.register(email, password);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al registrar';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore logout errors
    } finally {
      await clearAuth();
      setIsAuthenticated(false);
      setUserIdState(null);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    isAuthenticated,
    userId,
    loading,
    error,
    login,
    register,
    logout,
    clearError,
    checkAuth,
  };
}
