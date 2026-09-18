import { get, post } from './client';
import type {
  AuditLogEntry,
  CreateMemberRequest,
  CreateMemberResponse,
  CredentialActionResponse,
  Member,
} from '../types/dashboard';
import type { VaultItem, VaultSecret } from '../types/vault';

export function getMembers(): Promise<Member[]> {
  return get<Member[]>('/api/v1/dashboard/members');
}

export function getAuditLog(): Promise<AuditLogEntry[]> {
  return get<AuditLogEntry[]>('/api/v1/dashboard/audit-log');
}

export function revokeInternal(credentialId: string, newPassword: string): Promise<CredentialActionResponse> {
  return post<CredentialActionResponse>(`/api/v1/dashboard/credentials/${credentialId}/revoke`, {
    new_password: newPassword,
  });
}

export function suggestExternal(credentialId: string, newPassword: string): Promise<CredentialActionResponse> {
  return post<CredentialActionResponse>(`/api/v1/dashboard/credentials/${credentialId}/suggest`, {
    new_password: newPassword,
  });
}

export function restoreCredential(credentialId: string): Promise<CredentialActionResponse> {
  return post<CredentialActionResponse>(`/api/v1/dashboard/credentials/${credentialId}/restore`);
}

export function createMember(payload: CreateMemberRequest): Promise<CreateMemberResponse> {
  return post<CreateMemberResponse>('/api/v1/dashboard/members', payload);
}

export function getMemberVault(memberId: string): Promise<VaultItem[]> {
  return get<VaultItem[]>(`/api/v1/dashboard/members/${memberId}/vault`);
}

/**
 * POST y no GET a propósito: escribe auditoría, no debe quedar en el historial
 * del navegador ni ser precargable. La consulta queda registrada en los dos
 * logs, incluido el que ve el propio trabajador.
 */
export function revealMemberVaultItem(memberId: string, itemId: string): Promise<VaultSecret> {
  return post<VaultSecret>(`/api/v1/dashboard/members/${memberId}/vault/${itemId}/reveal`);
}
