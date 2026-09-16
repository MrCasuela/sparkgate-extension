import { useCallback, useState } from 'react';
import * as vaultApi from '../api/vault';
import { ApiError } from '../api/client';
import type { VaultItem, VaultItemCreate, VaultSecret } from '../types/vault';

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export function useVault() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moduleUnavailable, setModuleUnavailable] = useState(false);

  const refresh = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const list = await vaultApi.listItems();
      setItems(list);
    } catch (e: unknown) {
      setError(errorMessage(e, 'Error al cargar tus credenciales'));
    } finally {
      setLoadingList(false);
    }
  }, []);

  const saveItem = useCallback(
    async (payload: VaultItemCreate): Promise<boolean> => {
      setSaving(true);
      setError(null);
      setModuleUnavailable(false);
      try {
        await vaultApi.saveItem(payload);
        await refresh();
        return true;
      } catch (e: unknown) {
        if (e instanceof ApiError && e.status === 503) setModuleUnavailable(true);
        setError(errorMessage(e, 'Error al guardar la credencial'));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const getSecret = useCallback(async (itemId: string): Promise<VaultSecret | null> => {
    setError(null);
    setModuleUnavailable(false);
    try {
      return await vaultApi.getSecret(itemId);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 503) setModuleUnavailable(true);
      setError(errorMessage(e, 'Error al consultar la credencial'));
      return null;
    }
  }, []);

  const deleteItem = useCallback(async (itemId: string): Promise<boolean> => {
    setError(null);
    try {
      await vaultApi.deleteItem(itemId);
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      return true;
    } catch (e: unknown) {
      setError(errorMessage(e, 'Error al eliminar la credencial'));
      return false;
    }
  }, []);

  const purgeAll = useCallback(async (): Promise<number | null> => {
    setError(null);
    try {
      const res = await vaultApi.purgeVault();
      setItems([]);
      return res.deleted_count;
    } catch (e: unknown) {
      setError(errorMessage(e, 'Error al eliminar tus credenciales'));
      return null;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    items,
    loadingList,
    saving,
    error,
    moduleUnavailable,
    refresh,
    saveItem,
    getSecret,
    deleteItem,
    purgeAll,
    clearError,
  };
}
