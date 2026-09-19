import { get, post } from './client';
import type { AssignedCredential } from '../types/me';
import type { CredentialSecret } from '../types/dashboard';

export function listAssignedCredentials(): Promise<AssignedCredential[]> {
  return get<AssignedCredential[]>('/api/v1/me/credentials');
}

/** POST: retirar una contraseña ajena audita, y la empresa ve quién la retiró. */
export function revealAssignedCredential(credentialId: string): Promise<CredentialSecret> {
  return post<CredentialSecret>(`/api/v1/me/credentials/${credentialId}/reveal`);
}
