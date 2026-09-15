import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get, post } from './client';

function mockFetch(status: number, body: unknown) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response);
}

describe('client — manejo de 401', () => {
  beforeEach(() => {
    vi.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispara sparkgate:unauthorized cuando el backend responde 401', async () => {
    mockFetch(401, { detail: 'Invalid or expired token' });
    await expect(get('/api/v1/passwords/evaluate')).rejects.toThrow();

    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sparkgate:unauthorized' }),
    );
  });

  it('no dispara el evento en otros errores (403, 500)', async () => {
    mockFetch(403, { detail: 'Premium requerido' });
    await expect(get('/api/v1/dashboard/members')).rejects.toThrow();
    mockFetch(500, { detail: 'error' });
    await expect(post('/api/v1/passwords/generate')).rejects.toThrow();

    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });

  it('no dispara el evento en respuestas exitosas', async () => {
    mockFetch(200, { access_token: 'tok' });
    await post('/api/v1/auth/login', { email: 'a@b.cl', password: 'x' });

    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
});