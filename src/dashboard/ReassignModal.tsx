import { useState } from 'react';
import type { Credential, Member } from '../types/dashboard';
import { ErrorAlert } from '../components/ErrorAlert';
import { Modal } from './Modal';

interface ReassignModalProps {
  credential: Credential;
  members: Member[];
  submitting: boolean;
  error: string | null;
  onSubmit: (memberId: string | null) => void;
  onClose: () => void;
}

const POOL = '';

export function ReassignModal({ credential, members, submitting, error, onSubmit, onClose }: ReassignModalProps) {
  const candidates = members.filter((m) => m.id !== credential.member_id);
  const [target, setTarget] = useState<string>(candidates[0]?.id ?? POOL);

  return (
    <Modal
      title="Reasignar cuenta"
      subtitle={`${credential.service_name}${credential.username ? ` — ${credential.username}` : ''}`}
    >
      {error && (
        <div className="mb-3">
          <ErrorAlert message={error} />
        </div>
      )}

      <label htmlFor="reassign-target" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
        Pasar a
      </label>
      <select
        id="reassign-target"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800"
      >
        {candidates.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name} — {m.email}
          </option>
        ))}
        {credential.member_id && <option value={POOL}>Nadie (devolver al pool sin asignar)</option>}
      </select>

      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        La contraseña guardada no cambia, y el nuevo portador la ve en su pantalla «De mi empresa».
        Quien la tenía ya la conoce: se te va a sugerir rotarla.
      </p>

      <div className="flex gap-2">
        <button
          onClick={onClose}
          disabled={submitting}
          className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-semibold hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          Cancelar
        </button>
        <button
          onClick={() => onSubmit(target === POOL ? null : target)}
          disabled={submitting || (candidates.length === 0 && !credential.member_id)}
          className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Reasignando...' : 'Reasignar'}
        </button>
      </div>
    </Modal>
  );
}
