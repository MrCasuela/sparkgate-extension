import { get, post } from './client';
import type { AuditLogEntry, CredentialActionResponse, Member } from '../types/dashboard';

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
