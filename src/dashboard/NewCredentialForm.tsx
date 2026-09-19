import { useState } from 'react';
import type { CreateCredentialRequest, Member } from '../types/dashboard';
import { ErrorAlert } from '../components/ErrorAlert';

interface NewCredentialFormProps {
  members: Member[];
  submitting: boolean;
  error: string | null;
  onDismissError: () => void;
  onSubmit: (payload: CreateCredentialRequest) => Promise<boolean>;
}

const INPUT =
  'flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800';

/** Registra una cuenta externa de la organización (Google Workspace, Dropbox, ...). */
export function NewCredentialForm({ members, submitting, error, onDismissError, onSubmit }: NewCredentialFormProps) {
  const [form, setForm] = useState({ service_name: '', username: '', password: '', member_id: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onSubmit({
      service_name: form.service_name,
      member_id: form.member_id || null,
      ...(form.username ? { username: form.username } : {}),
      ...(form.password ? { password: form.password } : {}),
    });
    if (ok) setForm({ service_name: '', username: '', password: '', member_id: '' });
  };

  return (
    <section className="mb-6 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <h2 className="mb-1 text-lg font-semibold">Registrar cuenta de la empresa</h2>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Una cuenta externa (Google Workspace, un panel de publicidad...). La contraseña queda cifrada y
        pertenece a la empresa: sobrevive a quien la use hoy.
      </p>
      {error && (
        <div className="mb-3">
          <ErrorAlert message={error} onDismiss={onDismissError} />
        </div>
      )}
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <input
          type="text"
          required
          maxLength={120}
          aria-label="Servicio"
          placeholder="Servicio (ej. Google Workspace)"
          value={form.service_name}
          onChange={(e) => setForm((f) => ({ ...f, service_name: e.target.value }))}
          className={INPUT}
        />
        <input
          type="text"
          maxLength={200}
          aria-label="Usuario"
          placeholder="Usuario (opcional)"
          value={form.username}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          className={INPUT}
        />
        <input
          type="text"
          maxLength={256}
          aria-label="Contraseña"
          placeholder="Contraseña (opcional)"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          className={`${INPUT} font-mono`}
        />
        <select
          aria-label="Asignar a"
          value={form.member_id}
          onChange={(e) => setForm((f) => ({ ...f, member_id: e.target.value }))}
          className={INPUT}
        >
          <option value="">Sin asignar (pool)</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Registrando...' : 'Registrar cuenta'}
        </button>
      </form>
    </section>
  );
}
