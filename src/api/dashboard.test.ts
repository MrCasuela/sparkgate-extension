import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dashboard from './dashboard';
import * as me from './me';
import { getAudit } from './vault';

function mockFetch(body: unknown = {}) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  } as Response);
}

function lastCall(spy: ReturnType<typeof mockFetch>) {
  const [url, init] = spy.mock.calls[spy.mock.calls.length - 1];
  return { url: String(url), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined };
}

/**
 * Lo que fija este archivo es el contrato con el backend de la etapa C: método,
 * ruta y cuerpo de cada llamada. Un método equivocado (GET en vez de POST) haría que
 * ver una contraseña no auditara, o que quedara en el historial del navegador.
 */
describe('api/dashboard — contrato de la etapa C', () => {
  let spy: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    spy = mockFetch();
  });
  afterEach(() => vi.restoreAllMocks());

  it('revocar sin contraseña propia manda el cuerpo vacío: la genera el backend', async () => {
    await dashboard.revokeInternal('c1');
    expect(lastCall(spy)).toMatchObject({ method: 'POST', body: {} });
    expect(lastCall(spy).url).toMatch(/\/dashboard\/credentials\/c1\/revoke$/);
  });

  it('con contraseña propia la manda como new_password', async () => {
    await dashboard.suggestExternal('c1', 'Mi-Clave-Larga-1!');
    expect(lastCall(spy).body).toEqual({ new_password: 'Mi-Clave-Larga-1!' });
  });

  it('ver la contraseña de una credencial es POST, no GET (audita)', async () => {
    await dashboard.revealCredentialSecret('c1');
    expect(lastCall(spy).method).toBe('POST');
    expect(lastCall(spy).url).toMatch(/\/dashboard\/credentials\/c1\/secret\/reveal$/);
  });

  it('guardar la contraseña es PUT sobre /secret', async () => {
    await dashboard.saveCredentialSecret('c1', { password: 'x', apply_to_account: true });
    expect(lastCall(spy)).toMatchObject({ method: 'PUT', body: { password: 'x', apply_to_account: true } });
    expect(lastCall(spy).url).toMatch(/\/dashboard\/credentials\/c1\/secret$/);
  });

  it('reasignar manda member_id, y null devuelve al pool', async () => {
    await dashboard.reassignCredential('c1', 'm2');
    expect(lastCall(spy).body).toEqual({ member_id: 'm2' });
    await dashboard.reassignCredential('c1', null);
    expect(lastCall(spy).body).toEqual({ member_id: null });
  });

  it('el pool se pide con assigned=false', async () => {
    await dashboard.getUnassignedCredentials();
    expect(lastCall(spy).url).toMatch(/\/dashboard\/credentials\?assigned=false$/);
    expect(lastCall(spy).method).toBe('GET');
  });

  it('registrar una cuenta es POST /credentials', async () => {
    await dashboard.createCredential({ service_name: 'Dropbox', member_id: null });
    expect(lastCall(spy)).toMatchObject({ method: 'POST', body: { service_name: 'Dropbox', member_id: null } });
    expect(lastCall(spy).url).toMatch(/\/dashboard\/credentials$/);
  });
});

describe('api/me y vault — el lado del trabajador', () => {
  afterEach(() => vi.restoreAllMocks());

  it('retirar lo asignado es POST bajo /me, nunca bajo /dashboard', async () => {
    const spy = mockFetch();
    await me.revealAssignedCredential('c1');
    expect(lastCall(spy).method).toBe('POST');
    expect(lastCall(spy).url).toMatch(/\/api\/v1\/me\/credentials\/c1\/reveal$/);
    expect(lastCall(spy).url).not.toContain('/dashboard/');
  });

  it('listar lo asignado y el historial propio son GET', async () => {
    const spy = mockFetch([]);
    await me.listAssignedCredentials();
    expect(lastCall(spy).url).toMatch(/\/api\/v1\/me\/credentials$/);
    await getAudit();
    expect(lastCall(spy).url).toMatch(/\/api\/v1\/vault\/audit$/);
    expect(lastCall(spy).method).toBe('GET');
  });
});
