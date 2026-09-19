import { useState } from 'react';
import type { Credential } from '../types/dashboard';
import { ErrorAlert } from '../components/ErrorAlert';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './labels';
import { Modal } from './Modal';

export type ConfirmKind = 'revoke' | 'suggest';

interface ConfirmActionModalProps {
  kind: ConfirmKind;
  memberName: string;
  credential: Credential;
  submitting: boolean;
  error: string | null;
  /** customPassword undefined = que el backend genere la contraseña. */
  onConfirm: (customPassword?: string) => void;
  onClose: () => void;
}

/**
 * Revocar o sugerir. Antes este modal generaba la contraseña en el navegador y se
 * la mostraba a sí mismo: el backend nunca la tuvo. Ahora la genera él (o usa la
 * que se escriba acá), la guarda cifrada y la devuelve; lo que se muestra después
 * es lo que devolvió, que es la única forma de que lo mostrado sea lo guardado.
 */
export function ConfirmActionModal({
  kind,
  memberName,
  credential,
  submitting,
  error,
  onConfirm,
  onClose,
}: ConfirmActionModalProps) {
  const [custom, setCustom] = useState('');
  const tooShort = custom.length > 0 && custom.length < MIN_PASSWORD_LENGTH;

  return (
    <Modal
      title={kind === 'revoke' ? 'Revocar acceso' : 'Generar sugerencia'}
      subtitle={`${memberName} — ${credential.service_name}`}
    >
      {error && (
        <div className="mb-3">
          <ErrorAlert message={error} />
        </div>
      )}

      <p className="mb-3 text-sm">
        {kind === 'revoke'
          ? 'SparkGate genera una contraseña nueva, la aplica a la cuenta y la guarda cifrada. La cuenta queda bloqueada: la sesión que tenga abierta deja de funcionar en su próxima petición.'
          : 'Es una cuenta externa: SparkGate no puede cambiarla en el servicio. Genera una contraseña sugerida y la guarda cifrada; la cuenta queda «Pendiente» hasta que la apliques a mano y confirmes la contraseña.'}
      </p>

      <label htmlFor="custom-password" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
        Usar una contraseña propia (opcional)
      </label>
      <input
        id="custom-password"
        type="text"
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        minLength={MIN_PASSWORD_LENGTH}
        maxLength={MAX_PASSWORD_LENGTH}
        placeholder="Vacío: la genera SparkGate"
        className="mb-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800"
      />
      {tooShort && <p className="mb-2 text-xs text-alert">Mínimo {MIN_PASSWORD_LENGTH} caracteres.</p>}

      <div className="mt-4 flex gap-2">
        <button
          onClick={onClose}
          disabled={submitting}
          className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-semibold hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          Cancelar
        </button>
        <button
          onClick={() => onConfirm(custom || undefined)}
          disabled={submitting || tooShort}
          className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Confirmando...' : 'Confirmar'}
        </button>
      </div>
    </Modal>
  );
}
