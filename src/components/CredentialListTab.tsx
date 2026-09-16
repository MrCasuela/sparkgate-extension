import { useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import type { VaultItem, VaultSecret } from '../types/vault';

interface CredentialListTabProps {
  items: VaultItem[];
  loading: boolean;
  onGetSecret: (itemId: string) => Promise<VaultSecret | null>;
  onDelete: (itemId: string) => Promise<boolean>;
}

export function CredentialListTab({ items, loading, onGetSecret, onDelete }: CredentialListTabProps) {
  const [revealed, setRevealed] = useState<Record<string, VaultSecret>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleReveal = async (itemId: string) => {
    setLoadingId(itemId);
    const secret = await onGetSecret(itemId);
    setLoadingId(null);
    if (secret) {
      setRevealed((prev) => ({ ...prev, [itemId]: secret }));
    }
  };

  const handleHide = (itemId: string) => {
    setRevealed((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleCopy = async (password: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedId(itemId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard not available
    }
  };

  const handleDelete = async (itemId: string) => {
    const ok = await onDelete(itemId);
    if (ok) {
      handleHide(itemId);
      setConfirmDeleteId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Cargando tus credenciales..." small />;
  }

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
        Todavía no guardaste ninguna credencial.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const secret = revealed[item.id];
        return (
          <div
            key={item.id}
            className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text dark:text-darkText">{item.service_name}</p>
                {item.username && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.username}</p>
                )}
              </div>
              <div className="flex gap-1">
                {secret ? (
                  <button
                    onClick={() => handleHide(item.id)}
                    className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    Ocultar
                  </button>
                ) : (
                  <button
                    onClick={() => handleReveal(item.id)}
                    disabled={loadingId === item.id}
                    className="rounded-lg px-2 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {loadingId === item.id ? <LoadingSpinner small /> : 'Ver'}
                  </button>
                )}
                <button
                  onClick={() => setConfirmDeleteId(item.id)}
                  className="rounded-lg px-2 py-1 text-xs text-alert hover:bg-alert/10"
                >
                  Eliminar
                </button>
              </div>
            </div>

            {secret && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={secret.password}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 font-mono text-xs text-text outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-darkText"
                />
                <button
                  onClick={() => handleCopy(secret.password, item.id)}
                  className="min-w-[64px] rounded-lg bg-primary px-2 py-1.5 text-xs text-white hover:opacity-90"
                >
                  {copiedId === item.id ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            )}
            {secret?.notes && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{secret.notes}</p>
            )}

            {confirmDeleteId === item.id && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-alert/10 p-2">
                <span className="text-xs text-alert">¿Eliminar esta credencial?</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="rounded-lg bg-alert px-2 py-1 text-xs font-medium text-white hover:opacity-90"
                  >
                    Sí, eliminar
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
