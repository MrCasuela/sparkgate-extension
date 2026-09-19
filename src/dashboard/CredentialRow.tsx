import type { Credential } from '../types/dashboard';
import { STATUS_CLASS, STATUS_LABEL } from './labels';

interface CredentialRowProps {
  credential: Credential;
  /** La cuenta interna del propio administrador: no se puede revocar desde acá. */
  isOwnAccount: boolean;
  busy?: boolean;
  onReveal: (credential: Credential) => void;
  onSaveSecret: (credential: Credential) => void;
  onReassign: (credential: Credential) => void;
  onRevoke: (credential: Credential) => void;
  onSuggest: (credential: Credential) => void;
  onRestore: (credential: Credential) => void;
}

const SECONDARY_BUTTON =
  'rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition-opacity hover:bg-primary/10 disabled:opacity-50 dark:text-white';

export function CredentialRow({
  credential,
  isOwnAccount,
  busy = false,
  onReveal,
  onSaveSecret,
  onReassign,
  onRevoke,
  onSuggest,
  onRestore,
}: CredentialRowProps) {
  const isInternal = credential.type === 'interna';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium dark:bg-gray-700">
          {isInternal ? 'Interna' : 'Externa'}
        </span>
        <span className="text-sm">{credential.service_name}</span>
        {credential.username && (
          <span className="text-xs text-gray-500 dark:text-gray-400">{credential.username}</span>
        )}
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[credential.status]}`}>
          {STATUS_LABEL[credential.status]}
        </span>
        {credential.rotation_required && (
          <span
            title="Alguien que ya no debería conocerla la conoce. Se apaga al guardar una contraseña nueva."
            className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
          >
            Rotar pendiente
          </span>
        )}
        {!credential.has_secret && (
          <span className="text-xs italic text-gray-500 dark:text-gray-400">Sin contraseña guardada</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {credential.has_secret && (
          <button onClick={() => onReveal(credential)} disabled={busy} className={SECONDARY_BUTTON}>
            Ver contraseña
          </button>
        )}

        {credential.status === 'activa' && (
          <button onClick={() => onSaveSecret(credential)} disabled={busy} className={SECONDARY_BUTTON}>
            {credential.has_secret ? 'Cambiar contraseña' : 'Guardar contraseña'}
          </button>
        )}

        {!isInternal && (
          <button onClick={() => onReassign(credential)} disabled={busy} className={SECONDARY_BUTTON}>
            Reasignar
          </button>
        )}

        {credential.status === 'activa' &&
          isInternal &&
          (isOwnAccount ? (
            <span className="text-xs italic text-gray-500 dark:text-gray-400">
              Tu cuenta — no revocable desde acá
            </span>
          ) : (
            <button
              onClick={() => onRevoke(credential)}
              className="rounded-lg bg-alert px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              Revocar acceso ahora
            </button>
          ))}

        {credential.status === 'activa' && !isInternal && credential.member_id && (
          <button
            onClick={() => onSuggest(credential)}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            Generar sugerencia y marcar pendiente
          </button>
        )}

        {credential.status !== 'activa' && (
          <button onClick={() => onRestore(credential)} className={SECONDARY_BUTTON}>
            {isInternal ? 'Restaurar acceso' : 'Confirmar contraseña'}
          </button>
        )}
      </div>
    </div>
  );
}
