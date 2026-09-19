import { get, post, del } from './client';
import type {
  VaultAuditEntry,
  VaultItem,
  VaultItemCreate,
  VaultPurgeResponse,
  VaultSecret,
} from '../types/vault';

export function saveItem(payload: VaultItemCreate): Promise<VaultItem> {
  return post<VaultItem>('/api/v1/vault/items', payload);
}

export function listItems(): Promise<VaultItem[]> {
  return get<VaultItem[]>('/api/v1/vault/items');
}

export function getSecret(itemId: string): Promise<VaultSecret> {
  return get<VaultSecret>(`/api/v1/vault/items/${itemId}`);
}

export function deleteItem(itemId: string): Promise<void> {
  return del<void>(`/api/v1/vault/items/${itemId}`);
}

export function purgeVault(): Promise<VaultPurgeResponse> {
  return del<VaultPurgeResponse>('/api/v1/vault/items');
}

/** El historial de accesos a tu bóveda, incluidos los de tu empresa (HU21 AC7). */
export function getAudit(): Promise<VaultAuditEntry[]> {
  return get<VaultAuditEntry[]>('/api/v1/vault/audit');
}
