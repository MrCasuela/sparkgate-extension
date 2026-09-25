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
    await dashboard.revokeInternal('c1', undefined, '123456');
    expect(lastCall(spy)).toMatchObject({ method: 'POST', body: {} });
    expect(lastCall(spy).url).toMatch(/\/dashboard\/credentials\/c1\/revoke$/);
  });

  it('con contraseña propia la manda como new_password', async () => {
    await dashboard.suggestExternal('c1', 'Mi-Clave-Larga-1!', '123456');
    expect(lastCall(spy).body).toEqual({ new_password: 'Mi-Clave-Larga-1!' });
  });

  it('ver la contraseña de una credencial es POST, no GET (audita)', async () => {
    await dashboard.revealCredentialSecret('c1', '123456');
    expect(lastCall(spy).method).toBe('POST');
    expect(lastCall(spy).url).toMatch(/\/dashboard\/credentials\/c1\/secret\/reveal$/);
  });

  it('guardar la contraseña es PUT sobre /secret', async () => {
    await dashboard.saveCredentialSecret('c1', { password: 'x', apply_to_account: true }, '123456');
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
    await me.revealAssignedCredential('c1', '123456');
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

/**
 * HU18. El backend exige el código del segundo factor en SEIS operaciones sobre un secreto ajeno, y
 * en ninguna otra. Un header de más no rompe nada pero filtra el código a endpoints que no lo
 * necesitan; uno de menos es un 403 en producción. Se fijan las dos direcciones.
 */
describe('api — el segundo factor viaja en las seis operaciones que lo exigen, y solo en ellas', () => {
  afterEach(() => vi.restoreAllMocks());

  const CODE = '246810';
  const CON_CODIGO: [string, () => Promise<unknown>][] = [
    ['revocar una interna', () => dashboard.revokeInternal('c1', undefined, CODE)],
    ['sugerir para una externa', () => dashboard.suggestExternal('c1', undefined, CODE)],
    ['guardar una contraseña', () => dashboard.saveCredentialSecret('c1', { password: 'x' }, CODE)],
    ['ver la contraseña de una credencial', () => dashboard.revealCredentialSecret('c1', CODE)],
    ['ver la bóveda de un integrante', () => dashboard.revealMemberVaultItem('m1', 'i1', CODE)],
    ['retirar una credencial asignada', () => me.revealAssignedCredential('c1', CODE)],
  ];

  it.each(CON_CODIGO)('%s manda X-SparkGate-TOTP', async (_name, call) => {
    const spy = mockFetch();
    await call();
    const headers = spy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['X-SparkGate-TOTP']).toBe(CODE);
  });

  it.each(CON_CODIGO)('%s no manda el código en la URL ni en el body', async (_name, call) => {
    const spy = mockFetch();
    await call();
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).not.toContain(CODE);
    expect(String(init?.body ?? '')).not.toContain(CODE);
  });

  const SIN_CODIGO: [string, () => Promise<unknown>][] = [
    ['listar integrantes', () => dashboard.getMembers()],
    ['ver la auditoría', () => dashboard.getAuditLog()],
    ['restaurar una credencial', () => dashboard.restoreCredential('c1')],
    ['reasignar una credencial', () => dashboard.reassignCredential('c1', 'm2')],
    ['dar de alta a un trabajador', () => dashboard.createMember({ full_name: 'A', email: 'a@b.cl' })],
    ['registrar una cuenta', () => dashboard.createCredential({ service_name: 'Dropbox' })],
    ['listar la bóveda de un integrante (metadata)', () => dashboard.getMemberVault('m1')],
    ['listar lo asignado', () => me.listAssignedCredentials()],
  ];

  it.each(SIN_CODIGO)('%s NO manda el código: el backend no lo exige', async (_name, call) => {
    const spy = mockFetch([]);
    await call();
    const headers = (spy.mock.calls[0][1]?.headers ?? {}) as Record<string, string>;
    expect(headers).not.toHaveProperty('X-SparkGate-TOTP');
  });
});

