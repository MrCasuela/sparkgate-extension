import { useCallback, useState } from 'react';
import * as meApi from '../api/me';
import * as vaultApi from '../api/vault';
import { ApiError } from '../api/client';
import type { CredentialSecret } from '../types/dashboard';
import type { AssignedCredential } from '../types/me';
import type { VaultAuditEntry } from '../types/vault';

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/** Lo que la empresa le asignó al usuario (HU21 etapa C, /api/v1/me). */
export function useCompanyCredentials() {
  const [items, setItems] = useState<AssignedCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await meApi.listAssignedCredentials());
    } catch (e: unknown) {
      setError(errorMessage(e, 'Error al cargar las cuentas de tu empresa'));
    } finally {
      setLoading(false);
    }
  }, []);

  const reveal = useCallback(async (credentialId: string): Promise<CredentialSecret | null> => {
    setError(null);
    try {
      return await meApi.revealAssignedCredential(credentialId);
    } catch (e: unknown) {
      // 403 (ya no está activa para vos), 404 (no es tuya o no tiene contraseña) y 503
      // (módulo caído) traen un detail pensado para mostrarse tal cual.
      setError(
        e instanceof ApiError ? e.detail : errorMessage(e, 'Error al retirar la contraseña'),
      );
      return null;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { items, loading, error, refresh, reveal, clearError };
}

/** El historial de accesos a la bóveda propia, incluidos los de la empresa (HU21 AC7). */
export function useAccessLog() {
  const [entries, setEntries] = useState<VaultAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await vaultApi.getAudit());
    } catch (e: unknown) {
      setError(errorMessage(e, 'Error al cargar el historial de accesos'));
    } finally {
      setLoading(false);
    }
  }, []);

  return { entries, loading, error, refresh };
}
