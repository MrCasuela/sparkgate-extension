import { get, post, put, withTotp } from './client';
import type {
  AuditLogEntry,
  CreateCredentialRequest,
  CreateMemberRequest,
  CreateMemberResponse,
  Credential,
  CredentialActionResponse,
  CredentialSecret,
  CredentialSecretRequest,
  CredentialSecretSaveResponse,
  Member,
  ReassignCredentialResponse,
} from '../types/dashboard';
import type { VaultItem, VaultSecret } from '../types/vault';

export function getMembers(): Promise<Member[]> {
  return get<Member[]>('/api/v1/dashboard/members');
}

export function getAuditLog(): Promise<AuditLogEntry[]> {
  return get<AuditLogEntry[]>('/api/v1/dashboard/audit-log');
}

/** El pool de credenciales sin asignar: no aparece en getMembers(). */
export function getUnassignedCredentials(): Promise<Credential[]> {
  return get<Credential[]>('/api/v1/dashboard/credentials?assigned=false');
}

/*
 * HU18: las seis operaciones sobre un secreto AJENO exigen el código del segundo factor del que
 * las pide, en el header X-SparkGate-TOTP. El código es un parámetro OBLIGATORIO de cada una:
 * TypeScript no deja llamarlas sin él, así que una séptima pantalla no puede olvidarse de pedirlo.
 * Las seis son: revocar, sugerir, guardar una contraseña, ver la de una credencial, ver la bóveda
 * de un integrante (acá) y retirar una credencial asignada (api/me.ts).
 */

/**
 * `newPassword` es opcional: sin él, el backend genera la contraseña y la devuelve
 * en `applied_password`. Lo que se muestre tiene que ser lo que devuelve él, no
 * algo generado acá: es la única forma de que lo mostrado sea lo guardado.
 */
export function revokeInternal(
  credentialId: string,
  newPassword: string | undefined,
  totp: string,
): Promise<CredentialActionResponse> {
  return post<CredentialActionResponse>(
    `/api/v1/dashboard/credentials/${credentialId}/revoke`,
    newPassword ? { new_password: newPassword } : {},
    false,
    withTotp(totp),
  );
}

export function suggestExternal(
  credentialId: string,
  newPassword: string | undefined,
  totp: string,
): Promise<CredentialActionResponse> {
  return post<CredentialActionResponse>(
    `/api/v1/dashboard/credentials/${credentialId}/suggest`,
    newPassword ? { new_password: newPassword } : {},
    false,
    withTotp(totp),
  );
}

export function restoreCredential(credentialId: string): Promise<CredentialActionResponse> {
  return post<CredentialActionResponse>(`/api/v1/dashboard/credentials/${credentialId}/restore`);
}

export function createMember(payload: CreateMemberRequest): Promise<CreateMemberResponse> {
  return post<CreateMemberResponse>('/api/v1/dashboard/members', payload);
}

/** Registra una cuenta externa de la organización. Las internas solo nacen con el alta de trabajador. */
export function createCredential(payload: CreateCredentialRequest): Promise<Credential> {
  return post<Credential>('/api/v1/dashboard/credentials', payload);
}

/**
 * Reemplaza el secreto guardado. Nunca devuelve el plaintext: quien lo envió ya lo tiene.
 * Guardar una contraseña nueva ES rotar, así que exige el segundo factor aunque no toque una cuenta real.
 */
export function saveCredentialSecret(
  credentialId: string,
  payload: CredentialSecretRequest,
  totp: string,
): Promise<CredentialSecretSaveResponse> {
  return put<CredentialSecretSaveResponse>(
    `/api/v1/dashboard/credentials/${credentialId}/secret`,
    payload,
    withTotp(totp),
  );
}

/** POST y no GET, igual que la bóveda del trabajador: escribe auditoría y no debe quedar en el historial. */
export function revealCredentialSecret(credentialId: string, totp: string): Promise<CredentialSecret> {
  return post<CredentialSecret>(
    `/api/v1/dashboard/credentials/${credentialId}/secret/reveal`,
    undefined,
    false,
    withTotp(totp),
  );
}

/** memberId null = devolver la credencial al pool. Solo cuentas externas (400 si es interna). */
export function reassignCredential(
  credentialId: string,
  memberId: string | null,
): Promise<ReassignCredentialResponse> {
  return post<ReassignCredentialResponse>(`/api/v1/dashboard/credentials/${credentialId}/reassign`, {
    member_id: memberId,
  });
}

export function getMemberVault(memberId: string): Promise<VaultItem[]> {
  return get<VaultItem[]>(`/api/v1/dashboard/members/${memberId}/vault`);
}

/**
 * POST y no GET a propósito: escribe auditoría, no debe quedar en el historial
 * del navegador ni ser precargable. La consulta queda registrada en los dos
 * logs, incluido el que ve el propio trabajador.
 */
export function revealMemberVaultItem(memberId: string, itemId: string, totp: string): Promise<VaultSecret> {
  return post<VaultSecret>(
    `/api/v1/dashboard/members/${memberId}/vault/${itemId}/reveal`,
    undefined,
    false,
    withTotp(totp),
  );
}
