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
