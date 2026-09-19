import type { Credential, RotationSuggestion } from '../types/dashboard';
import { CopyField } from './CopyField';
import { Modal } from './Modal';

export type ResultKind = 'revoke' | 'suggest' | 'restore' | 'reassign' | 'save';

export interface ActionResult {
  kind: ResultKind;
  title: string;
  credential: Credential;
  adminApiSuccess: boolean;
  /** La contraseña que devolvió el backend (aplicada o sugerida). */
  password?: string;
  /** null = no aplica (restore, reassign). */
  secretStored: boolean | null;
  rotationSuggested: RotationSuggestion[];
  /** A quién se le pasó (reassign); null = pool. */
  reassignedTo?: string | null;
}

interface ActionResultModalProps {
  result: ActionResult;
  onClose: () => void;
}

const TITLE: Record<ResultKind, string> = {
  revoke: 'Acceso revocado',
  suggest: 'Sugerencia generada',
  restore: 'Acceso restaurado',
  reassign: 'Cuenta reasignada',
  save: 'Contraseña guardada',
};

export function ActionResultModal({ result, onClose }: ActionResultModalProps) {
  const { kind, credential } = result;

  return (
    <Modal
      title={kind === 'restore' && credential.type === 'externa' ? 'Contraseña confirmada' : TITLE[kind]}
      subtitle={result.title}
    >
      {kind === 'revoke' && (
        <p className="mb-3 text-sm">
          {result.adminApiSuccess
            ? 'Contraseña aplicada y cuenta bloqueada. La sesión que tuviera abierta deja de funcionar en su próxima petición.'
            : 'No se pudo confirmar el cambio con Supabase — revisá el log del backend. La credencial quedó marcada como revocada, pero no hay una contraseña nueva que mostrar.'}
        </p>
      )}
      {kind === 'suggest' && (
        <p className="mb-3 text-sm">
          Es una cuenta externa: aplicá esta contraseña a mano en el servicio y después confirmala desde «Confirmar contraseña».
        </p>
      )}
      {kind === 'restore' && (
        <p className="mb-3 text-sm">
          {credential.type === 'interna'
            ? result.adminApiSuccess
              ? 'Cuenta desbaneada — ya puede volver a iniciar sesión con la última contraseña aplicada.'
              : 'No se pudo confirmar el desbaneo con Supabase — revisá el log del backend.'
            : 'La cuenta vuelve a estar Activa: la contraseña guardada es la que quedó aplicada en el servicio.'}
        </p>
      )}
      {kind === 'reassign' && (
        <p className="mb-3 text-sm">
          {result.reassignedTo
            ? `Ahora la tiene ${result.reassignedTo} y la verá en su pantalla «De mi empresa».`
            : 'Volvió al pool sin asignar: nadie la ve hasta que la reasignes.'}
        </p>
      )}
      {kind === 'save' && (
        <p className="mb-3 text-sm">
          {credential.type === 'interna' && result.adminApiSuccess
            ? 'Guardada y aplicada a la cuenta.'
            : 'Guardada cifrada.'}
        </p>
      )}

      {result.password && (
        <>
          <CopyField value={result.password} />
          {result.secretStored ? (
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Quedó guardada cifrada en SparkGate: podés volver a verla con «Ver contraseña».
            </p>
          ) : (
            <p role="alert" className="mb-3 rounded-lg bg-alert/10 p-3 text-xs font-medium text-alert">
              NO se pudo guardar en SparkGate: esta es la única copia. Anotala ahora, o volvé a guardarla
              con «Cambiar contraseña» antes de cerrar.
            </p>
          )}
        </>
      )}

      {result.rotationSuggested.length > 0 && (
        <div className="mb-3 rounded-lg bg-amber-100 p-3 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          <p className="mb-1 font-semibold">Conviene cambiar estas contraseñas:</p>
          <ul className="list-inside list-disc">
            {result.rotationSuggested.map((s) => (
              <li key={s.credential_id}>
                {s.service_name}
                {s.member_name ? ` — la conoce ${s.member_name}` : ''}
              </li>
            ))}
          </ul>
          <p className="mt-1">Quedaron marcadas «Rotar pendiente» hasta que guardes una nueva.</p>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Cerrar
      </button>
    </Modal>
  );
}
