import { useEffect, useState } from 'react';
import type { Credential, CredentialSecretRequest } from '../types/dashboard';
import { StepUpAlert } from '../components/StepUpAlert';
import { TotpCodeField } from '../components/TotpCodeField';
import { isCompleteTotp, type StepUpKind } from '../utils/stepUp';
import { Modal } from './Modal';

interface SaveSecretModalProps {
  credential: Credential;
  holderName: string | null;
  submitting: boolean;
  error: string | null;
  /** Por qué falló, si fue el segundo factor: `enroll` ofrece configurarlo en vez de decir «código incorrecto». */
  errorKind?: StepUpKind | null;
  onGenerate: () => Promise<string | null>;
  /** `code` es el del segundo factor (HU18): guardar una contraseña nueva ES rotar. */
  onSubmit: (payload: CredentialSecretRequest, code: string) => void;
  onClose: () => void;
  onEnroll?: () => void;
}

export function SaveSecretModal({
  credential,
  holderName,
  submitting,
  error,
  errorKind,
  onGenerate,
  onSubmit,
  onClose,
  onEnroll,
}: SaveSecretModalProps) {
  const isInternal = credential.type === 'interna';
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(credential.username ?? '');
  const [notes, setNotes] = useState('');
  const [apply, setApply] = useState(isInternal);
  const [generating, setGenerating] = useState(false);
  const [code, setCode] = useState('');

  // Un código rechazado no sirve de nuevo (el backend lo cuenta como reutilizado): no se deja escrito.
  useEffect(() => {
    if (error) setCode('');
  }, [error]);

  const generate = async () => {
    setGenerating(true);
    const generated = await onGenerate();
    setGenerating(false);
    if (generated) setPassword(generated);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(
      {
        password,
        ...(!isInternal && username ? { username } : {}),
        ...(notes ? { notes } : {}),
        ...(isInternal ? { apply_to_account: apply } : {}),
      },
      code,
    );
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800';

  return (
    <Modal
      title={credential.has_secret ? 'Cambiar contraseña' : 'Guardar contraseña'}
      subtitle={`${holderName ? `${holderName} — ` : ''}${credential.service_name}`}
    >
      {error && <StepUpAlert message={error} kind={errorKind} onEnroll={onEnroll} />}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="secret-password" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Contraseña
          </label>
          <div className="flex items-center gap-2">
            <input
              id="secret-password"
              type="text"
              required
              maxLength={256}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} font-mono`}
            />
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              {generating ? '...' : 'Generar'}
            </button>
          </div>
        </div>

        {!isInternal && (
          <div>
            <label htmlFor="secret-username" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Usuario (opcional)
            </label>
            <input
              id="secret-username"
              type="text"
              maxLength={200}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label htmlFor="secret-notes" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Notas (opcional)
          </label>
          <input
            id="secret-notes"
            type="text"
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </div>

        {isInternal ? (
          <label className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={apply}
              onChange={(e) => setApply(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Aplicarla también a la cuenta de SparkGate. Es lo que hace que lo guardado sea la contraseña
              real. Sin marcar, solo se anota y deja de coincidir con la cuenta.
            </span>
          </label>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Es una cuenta externa: SparkGate no puede cambiarla en el servicio. Guardá acá la que ya
            aplicaste allá.
          </p>
        )}

        <div>
          <TotpCodeField id="save-totp" value={code} onChange={setCode} disabled={submitting} />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Guardar una contraseña nueva es rotarla: pide tu segundo factor. Cada código sirve una sola vez.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-semibold hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || password.length === 0 || !isCompleteTotp(code)}
            className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
