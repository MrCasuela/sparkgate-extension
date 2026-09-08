export type CredentialType = 'interna' | 'externa';
export type CredentialStatus = 'activa' | 'revocada' | 'pendiente_aplicacion_manual';

export interface Credential {
  id: string;
  type: CredentialType;
  service_name: string;
  status: CredentialStatus;
  updated_at: string;
  supabase_user_id: string | null;
}

export interface Member {
  id: string;
  full_name: string;
  email: string;
  role_title: string | null;
  credentials: Credential[];
}

export interface CredentialActionResponse {
  credential: Credential;
  admin_api_success: boolean;
}

export interface AuditLogEntry {
  id: string;
  actor_email: string;
  member_id: string;
  credential_id: string;
  credential_type: CredentialType;
  action: string;
  created_at: string;
}
