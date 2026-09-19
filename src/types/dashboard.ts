export type CredentialType = 'interna' | 'externa';
export type CredentialStatus = 'activa' | 'revocada' | 'pendiente_aplicacion_manual';

export interface Credential {
  id: string;
  type: CredentialType;
  service_name: string;
  status: CredentialStatus;
  updated_at: string;
  supabase_user_id: string | null;
  /** null = sin asignar (pool). La credencial es de la organización; el integrante es su portador. */
  member_id: string | null;
  username: string | null;
  /** Cuándo se guardó o rotó por última vez el secreto. Nunca el secreto. */
  secret_updated_at: string | null;
  /** Calculado por el backend: hay una contraseña guardada que se puede ver. */
  has_secret: boolean;
  /** Alguien que ya no debería conocerla la conoce: conviene rotarla. Solo se apaga guardando otra. */
  rotation_required: boolean;
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
  temporary_password: string;
  /** false = no se pudo guardar cifrada: esta respuesta es la única copia. */
  secret_stored: boolean;
}

/** Una credencial cuya contraseña conviene cambiar tras bloquear o reemplazar a alguien. */
export interface RotationSuggestion {
  credential_id: string;
  service_name: string;
  type: CredentialType;
  /** De quién es la contraseña que conoce: el integrante bloqueado o el anterior. */
  member_name: string | null;
}

export interface CredentialActionResponse {
  credential: Credential;
  admin_api_success: boolean;
  /** revoke: la contraseña que Auth confirmó. null si el cambio falló. */
  applied_password: string | null;
  /** suggest: la propuesta para aplicar a mano en el servicio externo. */
  suggested_password: string | null;
  /** false = la contraseña de esta respuesta es la única copia. */
  secret_stored: boolean;
  rotation_suggested: RotationSuggestion[];
}

export interface CreateCredentialRequest {
  member_id?: string | null;
  service_name: string;
  username?: string;
  /** Opcional: se puede registrar la cuenta ahora y guardar la contraseña después. */
  password?: string;
  notes?: string;
}

export interface CredentialSecretRequest {
  password: string;
  username?: string;
  notes?: string;
  /** Solo internas: además de guardarla, la aplica a la cuenta de Auth. */
  apply_to_account?: boolean;
}

export interface CredentialSecretSaveResponse {
  credential: Credential;
  admin_api_success: boolean;
  secret_stored: boolean;
}

export interface CredentialSecret {
  id: string;
  service_name: string;
  type: CredentialType;
  username: string | null;
  password: string;
  notes: string | null;
  secret_updated_at: string | null;
}

export interface ReassignCredentialResponse {
  credential: Credential;
  rotation_suggested: RotationSuggestion[];
}

export interface AuditLogEntry {
  id: string;
  /** null = el actor ejerció su derecho de supresión (el correo se anula fuera del hash). */
  actor_email: string | null;
  actor_user_id: string | null;
  /** null = credencial del pool o evento que no involucra a un integrante. */
  member_id: string | null;
  /** Reasignación: member_id es de quién sale y este, a quién pasa. */
  target_member_id: string | null;
  // Nullables desde HU21: un evento de bóveda no tiene credencial de
  // gobernanza asociada, lleva vault_item_id.
  credential_id: string | null;
  credential_type: CredentialType | null;
  vault_item_id: string | null;
  action: string;
  created_at: string;
}
