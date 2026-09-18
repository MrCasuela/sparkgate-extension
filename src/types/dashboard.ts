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
  /** null = integrante sin cuenta SparkGate vinculada (no tiene bóveda). */
  supabase_user_id: string | null;
  credentials: Credential[];
}

export interface CreateMemberRequest {
  full_name: string;
  email: string;
  role_title?: string;
}

export interface CreateMemberResponse {
  member: Member;
  /** Se muestra una sola vez: el backend no la persiste en ningún lado. */
  temporary_password: string;
}

export interface CredentialActionResponse {
  credential: Credential;
  admin_api_success: boolean;
}

export interface AuditLogEntry {
  id: string;
  actor_email: string;
  member_id: string;
  // Nullables desde HU21: un evento de bóveda no tiene credencial de
  // gobernanza asociada, lleva vault_item_id.
  credential_id: string | null;
  credential_type: CredentialType | null;
  vault_item_id: string | null;
  action: string;
  created_at: string;
}
