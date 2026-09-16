import { useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import type { VaultItemCreate } from '../types/vault';

interface SaveCredentialTabProps {
  saving: boolean;
  onSave: (payload: VaultItemCreate) => Promise<boolean>;
}

const inputClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-darkText';

export function SaveCredentialTab({ saving, onSave }: SaveCredentialTabProps) {
  const [serviceName, setServiceName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');

  const canSave = serviceName.trim() !== '' && password !== '';

  const handleSave = async () => {
    if (!canSave) return;
    const ok = await onSave({
      service_name: serviceName.trim(),
      username: username.trim() || undefined,
      password,
      notes: notes.trim() || undefined,
    });
    if (ok) {
      setServiceName('');
      setUsername('');
      setPassword('');
      setNotes('');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Se cifra en el servidor antes de guardarse. Solo tú puedes consultarla.
      </p>
      <input
        type="text"
        value={serviceName}
        onChange={(e) => setServiceName(e.target.value)}
        placeholder="Servicio (ej. GitHub)"
        className={inputClass}
      />
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Usuario (opcional)"
        className={inputClass}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contraseña"
        className={inputClass}
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas (opcional)"
        rows={2}
        className={`resize-none ${inputClass}`}
      />
      <button
        onClick={handleSave}
        disabled={saving || !canSave}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? <LoadingSpinner small /> : 'Guardar credencial'}
      </button>
    </div>
  );
}
