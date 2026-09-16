import { useEffect, useState } from 'react';
import * as authApi from '../api/auth';
import { getJwt } from '../utils/storage';
import { getJwtEmail } from '../utils/jwt';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorAlert } from './ErrorAlert';

interface DangerZoneProps {
  onPurge: () => Promise<number | null>;
  onLogout: () => Promise<void>;
}

export function DangerZone({ onPurge, onLogout }: DangerZoneProps) {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const [confirmingPurge, setConfirmingPurge] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const jwt = await getJwt();
      setSessionEmail(jwt ? getJwtEmail(jwt) : null);
    })();
  }, []);

  // Same normalization the backend applies (DELETE /api/v1/auth/account):
  // strip() + lower() so a stray space or different casing doesn't block a
  // legitimate deletion, but a wrong email still does.
  const emailMatches =
    sessionEmail !== null && confirmEmail.trim().toLowerCase() === sessionEmail.trim().toLowerCase();

  const handlePurge = async () => {
    setPurging(true);
    const count = await onPurge();
    setPurging(false);
    setConfirmingPurge(false);
    if (count !== null) {
      setPurgeMessage(`Se eliminaron ${count} credenciales.`);
      setTimeout(() => setPurgeMessage(null), 3000);
    }
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setConfirmEmail('');
    setPassword('');
    setDeleteError(null);
  };

  const handleDeleteAccount = async () => {
    if (!emailMatches || !password) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await authApi.deleteAccount(confirmEmail.trim(), password);
      await onLogout();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al eliminar la cuenta';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border border-alert/30 p-3">
      <h3 className="text-xs font-semibold text-alert">Zona de riesgo</h3>

      {purgeMessage && <p className="text-xs text-positive">{purgeMessage}</p>}

      {!confirmingPurge ? (
        <button
          onClick={() => setConfirmingPurge(true)}
          className="text-left text-xs text-alert hover:underline"
        >
          Eliminar todas mis credenciales
        </button>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-alert">¿Eliminar todas tus credenciales guardadas?</span>
          <div className="flex gap-1">
            <button
              onClick={handlePurge}
              disabled={purging}
              className="rounded-lg bg-alert px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {purging ? <LoadingSpinner small /> : 'Sí, eliminar'}
            </button>
            <button
              onClick={() => setConfirmingPurge(false)}
              className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowDeleteModal(true)}
        className="text-left text-xs font-semibold text-alert hover:underline"
      >
        Eliminar mi cuenta
      </button>

      {showDeleteModal && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xs rounded-lg bg-white p-4 dark:bg-gray-800">
            <h4 className="mb-2 text-sm font-semibold text-alert">Eliminar cuenta</h4>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Esta acción es irreversible: se eliminan tus credenciales guardadas y tu cuenta
              {sessionEmail && (
                <>
                  {' '}(<span className="font-mono">{sessionEmail}</span>)
                </>
              )}
              . Escribe tu correo exactamente para confirmar.
            </p>
            {deleteError && <ErrorAlert message={deleteError} onDismiss={() => setDeleteError(null)} />}
            <input
              type="text"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="Tu correo"
              className="mb-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-900 dark:text-darkText"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-900 dark:text-darkText"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={closeDeleteModal}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={!emailMatches || !password || deleting}
                className="rounded-lg bg-alert px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? <LoadingSpinner small /> : 'Eliminar cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
