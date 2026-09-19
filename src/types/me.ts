import type { CredentialStatus, CredentialType } from './dashboard';

/** Una credencial de la organización asignada al usuario logueado. Nunca lleva el secreto. */
export interface AssignedCredential {
  id: string;
  organization_name: string;
  service_name: string;
  type: CredentialType;
  username: string | null;
  status: CredentialStatus;
  secret_updated_at: string | null;
  updated_at: string;
  has_secret: boolean;
}
