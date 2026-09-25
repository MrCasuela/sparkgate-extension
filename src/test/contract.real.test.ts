/**
 * Contrato de HU18 contra el backend REAL en marcha (sparkgate-api + Supabase), no contra mocks.
 *
 * Existe por la misma razón que el E2E del backend: los tests con mocks prueban que el código
 * hace lo que el autor cree, no que el backend responde lo que el autor cree. Acá corre el código
 * REAL de la extensión (src/api, src/utils, src/dashboard/labels) contra respuestas reales.
 *
 * APAGADO por defecto: necesita un backend, un Supabase y cuentas desechables. Se enciende con
 *
 *   VITE_SPARKGATE_RUN_REAL=1 VITE_SPARKGATE_REAL_FIXTURE="$(cat fixture.json)" \
 *   VITE_API_URL=http://localhost:8001 pnpm exec vitest run src/test/contract.real.test.ts
 *
 * El fixture lo produce el backend (tokens de un admin de empresa y de un trabajador, y una
 * credencial externa con contraseña conocida): ver sparkgate-api/scripts/e2e_hu18_check.py, de
 * donde salen las mismas funciones de aprovisionamiento. Los códigos TOTP se generan acá con
 * WebCrypto: una implementación de RFC 6238 independiente de la del backend (pyotp), cuyos vectores
 * de prueba se comprueban abajo en un test que corre SIEMPRE.
 *
 * Cada forma de respuesta se compara con las claves del tipo TS. `Record<keyof T, true>` hace que
 * el compilador rechace la lista si le sobra o le falta una clave: no hay forma de que el tipo y
 * la comprobación se desincronicen en silencio.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import * as dashboardApi from '../api/dashboard';
import * as meApi from '../api/me';
import * as mfaApi from '../api/mfa';
import { getAudit } from '../api/vault';
import { VAULT_ACTION_LABEL } from '../components/AccessLogTab';
import { ACTION_LABEL, DENIED_REASON_LABEL } from '../dashboard/labels';
import { setJwt } from '../utils/storage';
import { qrPath } from '../utils/qr';
import { stepUpFailure } from '../utils/stepUp';
import type {
  AuditLogEntry,
  CredentialActionResponse,
  CredentialSecret,
} from '../types/dashboard';
import type { MfaEnrollment, MfaStatus } from '../types/mfa';
import type { VaultAuditEntry } from '../types/vault';

// Las variables llevan el prefijo VITE_ porque Vite solo expone esas al código: el test no usa APIs de
// Node (no hay @types/node en el proyecto), así que ni lee archivos ni toca `process`.
const RUN = import.meta.env.VITE_SPARKGATE_RUN_REAL === '1';

interface Fixture {
  admin_token: string;
  worker_token: string;
  internal_id: string;
  ext_id: string;
  ext_password: string;
}

// ---- Las claves de cada tipo, con el compilador vigilando que coincidan con la interfaz ----

const keys = <T>(spec: Record<keyof T, true>): string[] => Object.keys(spec).sort();

const MFA_STATUS = keys<MfaStatus>({ enrolled: true, pending: true, confirmed_at: true, last_used_at: true, locked_until: true });
const MFA_ENROLLMENT = keys<MfaEnrollment>({
  secret: true, otpauth_uri: true, issuer: true, account_name: true, digits: true, period: true, algorithm: true,
});
const CREDENTIAL_SECRET = keys<CredentialSecret>({
  id: true, service_name: true, type: true, username: true, password: true, notes: true, secret_updated_at: true,
});
const ACTION_RESPONSE = keys<CredentialActionResponse>({
  credential: true, admin_api_success: true, applied_password: true, suggested_password: true,
  secret_stored: true, rotation_suggested: true,
});
const AUDIT_ENTRY = keys<AuditLogEntry>({
  id: true, actor_email: true, actor_user_id: true, member_id: true, target_member_id: true, credential_id: true,
  credential_type: true, vault_item_id: true, action: true, denied_reason: true, created_at: true,
});
const VAULT_AUDIT_ENTRY = keys<VaultAuditEntry>({
  id: true, user_id: true, item_id: true, action: true, result: true, actor_user_id: true, created_at: true,
});

const sortedKeys = (o: object) => Object.keys(o).sort();

// ---- TOTP independiente de la implementación del backend (RFC 6238, SHA-1, 30 s) ----

function base32Decode(input: string): Uint8Array<ArrayBuffer> {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  }
  const out = new Uint8Array(new ArrayBuffer(Math.floor(bits.length / 8)));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out;
}

/** El código de un instante dado (segundos Unix). `digits` es 6 en producción y 8 en los vectores del RFC. */
async function totpAt(secret: string, unixSeconds: number, digits = 6): Promise<string> {
  const counter = Math.floor(unixSeconds / 30);
  const message = new DataView(new ArrayBuffer(8));
  message.setBigUint64(0, BigInt(counter));
  const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, message.buffer));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}

const totp = (secret: string, stepOffset = 0): Promise<string> =>
  totpAt(secret, Date.now() / 1000 + stepOffset * 30);

/** Un código de formato válido que NO es ninguno de los tres de la ventana: uno al azar colisionaría 3 de cada 10^6 veces. */
async function wrongCode(secret: string): Promise<string> {
  const valid = new Set([await totp(secret, -1), await totp(secret, 0), await totp(secret, 1)]);
  for (let n = 100000; n < 100200; n++) {
    const code = String(n);
    if (!valid.has(code)) return code;
  }
  throw new Error('sin código incorrecto');
}

async function waitNextStep(): Promise<void> {
  const wait = 30_000 - (Date.now() % 30_000) + 1000;
  await new Promise((resolve) => setTimeout(resolve, wait));
}

/** El error que lanza una llamada que el backend rechaza. */
async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    return e as ApiError;
  }
  throw new Error('la llamada debía ser rechazada y no lo fue');
}

describe.skipIf(!RUN)('contrato de HU18 contra el backend real', () => {
  let fixture: Fixture;
  let adminSecret = '';
  let workerSecret = '';

  beforeAll(() => {
    fixture = JSON.parse(String(import.meta.env.VITE_SPARKGATE_REAL_FIXTURE)) as Fixture;
  });

  const asAdmin = () => setJwt(fixture.admin_token);
  const asWorker = () => setJwt(fixture.worker_token);

  it('A. sin segundo factor: el 403 trae `code`, y la extensión lo clasifica como «configurá tu factor»', async () => {
    await asAdmin();
    const status = await mfaApi.getMfaStatus();
    expect(sortedKeys(status)).toEqual(MFA_STATUS);
    expect(status).toMatchObject({ enrolled: false, pending: false });

    const error = await rejection(dashboardApi.revealCredentialSecret(fixture.ext_id, '000000'));
    expect(error.status).toBe(403);
    expect(typeof error.detail).toBe('string'); // `detail` sigue siendo un string en toda la API
    expect(error.code).toBe('totp_no_enrolado');
    expect(stepUpFailure(error)?.kind).toBe('enroll');
  });

  it('B. el trabajador sin factor tampoco retira lo que le asignaron', async () => {
    await asWorker();
    const error = await rejection(meApi.revealAssignedCredential(fixture.ext_id, '000000'));
    expect(error.code).toBe('totp_no_enrolado');
    expect(stepUpFailure(error)?.kind).toBe('enroll');
  });

  it('C. enrolar devuelve lo que la extensión necesita para dibujar el QR, y confirmar activa el factor', async () => {
    await asAdmin();
    const enrollment = await mfaApi.enrollMfa();
    expect(sortedKeys(enrollment)).toEqual(MFA_ENROLLMENT);
    expect(enrollment).toMatchObject({ issuer: 'SparkGate', digits: 6, period: 30, algorithm: 'SHA1' });
    // El URI REAL del backend es lo que se le da al QR: se dibuja sin lanzar y con un tamaño legible.
    const { modules } = qrPath(enrollment.otpauth_uri);
    expect(modules).toBeGreaterThan(20);
    expect(modules).toBeLessThan(60);
    adminSecret = enrollment.secret;

    // Pendiente: NO habilita nada aunque el código sea válido para ese secreto.
    const pending = await rejection(dashboardApi.revealCredentialSecret(fixture.ext_id, await totp(adminSecret)));
    expect(pending.code).toBe('totp_no_enrolado');

    const confirmed = await mfaApi.confirmMfa(await totp(adminSecret));
    expect(sortedKeys(confirmed)).toEqual(MFA_STATUS);
    expect(confirmed).toMatchObject({ enrolled: true, pending: false });

    // El trabajador, por su cuenta.
    await asWorker();
    workerSecret = (await mfaApi.enrollMfa()).secret;
    expect((await mfaApi.confirmMfa(await totp(workerSecret))).enrolled).toBe(true);
  }, 60_000);

  it('D. con código: lee la credencial; el reuso y el código malo se distinguen por su `code`', async () => {
    await waitNextStep(); // confirmar consumió el paso actual (anti-replay, RFC 6238 §5.2)
    await asAdmin();
    const code = await totp(adminSecret);

    const secret = await dashboardApi.revealCredentialSecret(fixture.ext_id, code);
    expect(sortedKeys(secret)).toEqual(CREDENTIAL_SECRET);
    expect(secret.password).toBe(fixture.ext_password);

    const reused = await rejection(dashboardApi.revealCredentialSecret(fixture.ext_id, code));
    expect(reused.code).toBe('totp_reutilizado');
    expect(stepUpFailure(reused)?.kind).toBe('wait');

    const wrong = await rejection(dashboardApi.revealCredentialSecret(fixture.ext_id, await wrongCode(adminSecret)));
    expect(wrong.code).toBe('totp_invalido');
    expect(stepUpFailure(wrong)?.kind).toBe('retry');
    expect(wrong.detail).toBe(stepUpFailure(wrong)?.message); // el detail del backend, sin reinterpretar (V20)

    // El trabajador retira lo que la empresa le asignó, con SU código.
    await asWorker();
    const assigned = await meApi.revealAssignedCredential(fixture.ext_id, await totp(workerSecret));
    expect(sortedKeys(assigned)).toEqual(CREDENTIAL_SECRET);
    expect(assigned.password).toBe(fixture.ext_password);

    // Y ve el ciclo de vida de SU factor en su propia auditoría (antes de que F lo revoque y su token deje de servir).
    const audit = await getAudit();
    for (const entry of audit) {
      expect(sortedKeys(entry)).toEqual(VAULT_AUDIT_ENTRY);
      expect(VAULT_ACTION_LABEL[entry.action], `sin etiqueta: ${entry.action}`).toBeTruthy();
    }
    const actions = new Set(audit.map((e) => e.action));
    expect(actions.has('mfa_enrolar')).toBe(true);
    expect(actions.has('mfa_activar')).toBe(true);
  }, 60_000);

  it('E. las tres escrituras rechazadas dejan intacto el estado, y la auditoría las etiqueta con su motivo', async () => {
    await asAdmin();
    const bad = await wrongCode(adminSecret);

    const suggest = await rejection(dashboardApi.suggestExternal(fixture.ext_id, undefined, bad));
    const save = await rejection(dashboardApi.saveCredentialSecret(fixture.ext_id, { password: 'Manual#Nueva_Larga_1' }, bad));
    const revoke = await rejection(dashboardApi.revokeInternal(fixture.internal_id, undefined, bad));
    for (const error of [suggest, save, revoke]) {
      expect(error.status).toBe(403);
      expect(error.code).toBe('totp_invalido');
    }

    const log = await dashboardApi.getAuditLog();
    for (const entry of log) {
      expect(sortedKeys(entry)).toEqual(AUDIT_ENTRY);
      // Toda acción que el backend escribe tiene etiqueta: la tabla nunca muestra un identificador crudo.
      expect(ACTION_LABEL[entry.action], `sin etiqueta: ${entry.action}`).toBeTruthy();
      if (entry.denied_reason) expect(DENIED_REASON_LABEL[entry.denied_reason], entry.denied_reason).toBeTruthy();
    }
    const denied = new Map(log.filter((e) => e.denied_reason).map((e) => [e.action, e.denied_reason]));
    expect(denied.get('revocar_interna_denegado')).toBe('totp_invalido');
    expect(denied.get('sugerir_externa_denegado')).toBe('totp_invalido');
    expect(denied.get('guardar_secreto_denegado')).toBe('totp_invalido');
    expect(denied.get('consultar_secreto_denegado')).toBeTruthy();
    // Ningún código de 6 dígitos llegó a la auditoría como motivo.
    expect(log.every((e) => !/^\d{6}$/.test(e.denied_reason ?? ''))).toBe(true);
  }, 60_000);

  it('F. revocar con código rota la contraseña y, desde la extensión, la sesión del trabajador deja de servir (AC2, AC5)', async () => {
    await waitNextStep();
    await asAdmin();

    const revoked = await dashboardApi.revokeInternal(fixture.internal_id, undefined, await totp(adminSecret));
    expect(sortedKeys(revoked)).toEqual(ACTION_RESPONSE);
    expect(revoked.admin_api_success).toBe(true);
    expect(typeof revoked.applied_password).toBe('string');
    expect(revoked.credential.status).toBe('revocada');

    // AC5 medido por el código real de la extensión: el access token que el trabajador YA tenía.
    await asWorker();
    const after = await rejection(meApi.listAssignedCredentials());
    expect(after.status).toBe(401);
  }, 60_000);

  it('G. desactivar exige un código vigente y devuelve 204', async () => {
    await waitNextStep();
    await asAdmin();

    const bad = await rejection(mfaApi.disableMfa(await wrongCode(adminSecret)));
    expect(bad.code).toBe('totp_invalido');
    expect((await mfaApi.getMfaStatus()).enrolled).toBe(true);

    await expect(mfaApi.disableMfa(await totp(adminSecret))).resolves.toBeUndefined();
    expect((await mfaApi.getMfaStatus()).enrolled).toBe(false);
  }, 60_000);
});


/** El generador de este archivo es lo que hace independiente a la prueba: se verifica contra el estándar, no contra el backend. */
describe('generador TOTP del test — vectores de RFC 6238, Apéndice B', () => {
  const SEED = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // "12345678901234567890"

  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('T=%i da %s', async (unixSeconds, expected) => {
    expect(await totpAt(SEED, unixSeconds, 8)).toBe(expected);
  });
});
