import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuth } from './useAuth';
import { setJwt, setUserId, clearAuth } from '../utils/storage';
import { SESSION_EXPIRED_EVENT } from '../utils/authEvents';

function makeJwt(exp: number): string {
  const enc = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${enc({ alg: 'HS256' })}.${enc({ sub: 'u1', exp })}.sig`;
}

describe('useAuth — sesión vencida', () => {
  beforeEach(async () => {
    await clearAuth();
    vi.clearAllMocks();
  });

  it('al recibir sparkgate:unauthorized desloguea el estado en vivo', async () => {
    await setJwt(makeJwt(2_000_000_000));
    await setUserId('u1');

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(result.current.userId).toBeNull();
  });

  it('checkAuth trata un JWT expirado como no autenticado', async () => {
    await setJwt(makeJwt(1_600_000_000)); // exp pasado
    await setUserId('u1');

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.userId).toBeNull();
  });

  it('checkAuth autentica con JWT vigente', async () => {
    await setJwt(makeJwt(2_000_000_000)); // exp futuro
    await setUserId('u1');

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.userId).toBe('u1');
  });
});