import { useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import type { CredentialSecret } from '../types/dashboard';
import type { AssignedCredential } from '../types/me';

interface CompanyCredentialsTabProps {
  items: AssignedCredential[];
  loading: boolean;
  onReveal: (credentialId: string) => Promise<CredentialSecret | null>;
}

/**
 * Las cuentas de la organización que la empresa le asignó a este usuario. Solo
 * lectura: no las edita ni las borra. Retirar una contraseña queda registrado en
 * la auditoría de la empresa, y acá se avisa antes de que lo haga por sorpresa.
 */
export function CompanyCredentialsTab({ items, loading, onReveal }: CompanyCredentialsTabProps) {
  const [revealed, setRevealed] = useState<Record<string, CredentialSecret>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleReveal = async (id: string) => {
    setLoadingId(id);
    const secret = await onReveal(id);
    setLoadingId(null);
    if (secret) setRevealed((prev) => ({ ...prev, [id]: secret }));
  };

  const handleHide = (id: string) => {
    setRevealed((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleCopy = async (password: string, id: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // portapapeles no disponible
    }
  };

  if (loading) {
    return <LoadingSpinner message="Cargando las cuentas de tu empresa..." small />;
  }

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
        Tu empresa no te asignó ninguna cuenta.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Son cuentas de tu empresa, no tuyas. Cuando retirás una contraseña, la empresa lo ve en su registro.
      </p>
      {items.map((item) => {
        const secret = revealed[item.id];
        const canReveal = item.has_secret && item.status === 'activa';
        return (
          <div
            key={item.id}
            className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-text dark:text-darkText">{item.service_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {item.organization_name}
                  {item.username ? ` · ${item.username}` : ''}
                </p>
              </div>
              {secret ? (
                <button
                  onClick={() => handleHide(item.id)}
                  className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Ocultar
                </button>
              ) : canReveal ? (
                <button
                  onClick={() => handleReveal(item.id)}
                  disabled={loadingId === item.id}
                  className="rounded-lg px-2 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  {loadingId === item.id ? <LoadingSpinner small /> : 'Ver contraseña'}
                </button>
              ) : (
                <span className="text-xs italic text-gray-500 dark:text-gray-400">
                  {item.has_secret ? 'No disponible ahora' : 'Sin contraseña guardada'}
                </span>
              )}
            </div>

            {secret && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  aria-label={`Contraseña de ${item.service_name}`}
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
          </div>
        );
      })}
    </div>
  );
}
