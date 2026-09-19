export interface VaultItem {
  id: string;
  service_name: string;
  username: string | null;
  created_at: string;
  updated_at: string;
}

export interface VaultSecret {
  id: string;
  service_name: string;
  username: string | null;
  password: string;
  notes: string | null;
}

export interface VaultItemCreate {
  service_name: string;
  username?: string;
  password: string;
  notes?: string;
}

export interface VaultPurgeResponse {
  deleted_count: number;
}

export interface VaultAuditEntry {
  id: string;
  user_id: string;
  item_id: string | null;
  action: string;
  result: 'ok' | 'denegado' | 'error';
  /** Quién consultó cuando no fue el propio dueño (HU21 AC7). null = fuiste vos. */
  actor_user_id: string | null;
  created_at: string;
}
