import { useCallback, useState } from 'react';
import * as meApi from '../api/me';
import * as vaultApi from '../api/vault';
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

  /**
   * Retira una credencial de la organización con el código del segundo factor (HU18). NO atrapa el
   * error: lo muestra el modal que pidió el código, dentro de sí mismo y con el `code` del backend
   * a mano para distinguir «configurá tu factor» de «el código está mal». Un banner de la pestaña
   * lo perdería de vista. Los 403 (ya no está activa para vos), 404 y 503 traen un detail pensado
   * para mostrarse tal cual.
   */
  const reveal = useCallback(
    (credentialId: string, code: string): Promise<CredentialSecret> =>
      meApi.revealAssignedCredential(credentialId, code),
    [],
  );

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
