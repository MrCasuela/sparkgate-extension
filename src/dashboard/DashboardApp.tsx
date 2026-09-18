import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { AuthScreen } from '../components/AuthScreen';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorAlert } from '../components/ErrorAlert';
import { ApiError } from '../api/client';
import * as dashboardApi from '../api/dashboard';
import * as passwordsApi from '../api/passwords';
import type {
  AuditLogEntry,
  CreateMemberResponse,
  Credential,
  Member,
} from '../types/dashboard';
import type { VaultItem, VaultSecret } from '../types/vault';

const STATUS_LABEL: Record<Credential['status'], string> = {
  activa: 'Activa',
  revocada: 'Revocada',
  pendiente_aplicacion_manual: 'Pendiente',
};

const STATUS_CLASS: Record<Credential['status'], string> = {
  activa: 'bg-positive/10 text-positive',
  revocada: 'bg-alert/10 text-alert',
  pendiente_aplicacion_manual: 'bg-primary/10 text-primary dark:text-white',
};

const ACTION_LABEL: Record<string, string> = {
  revocar_interna: 'Revocó acceso',
  sugerir_externa: 'Generó sugerencia',
  restaurar_interna: 'Restauró acceso',
  restaurar_externa: 'Restauró estado',
  crear_trabajador: 'Dio de alta a un trabajador',
  listar_vault_miembro: 'Listó la bóveda del trabajador',
  consultar_vault_miembro: 'Abrió una credencial del trabajador',
  consultar_vault_miembro_denegado: 'Intento fallido sobre la bóveda del trabajador',
};

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 64;

interface PendingAction {
  kind: 'revoke' | 'suggest';
  memberName: string;
  credential: Credential;
}

interface RestoreConfirm {
  memberName: string;
  credential: Credential;
}

/** Estado de la bóveda de un integrante: perezoso, y con sus propios fallos. */
type VaultState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; items: VaultItem[] };

interface RevealedSecret {
  memberName: string;
  secret: VaultSecret;
}

interface ActionResult {
  kind: 'revoke' | 'suggest' | 'restore';
  serviceName: string;
  credential: Credential;
  adminApiSuccess: boolean;
  appliedPassword?: string;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function DashboardApp() {
  const { isAuthenticated, userId, loading, login, register, error, clearError, logout } = useAuth();
  const { dark, toggleDark } = useTheme();

  const [members, setMembers] = useState<Member[] | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [forbiddenDetail, setForbiddenDetail] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [passwordDraft, setPasswordDraft] = useState('');
  const [generatingSuggestion, setGeneratingSuggestion] = useState(false);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [restoreConfirm, setRestoreConfirm] = useState<RestoreConfirm | null>(null);
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);

  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Alta de trabajador (HU21 AC2)
  const [newMemberForm, setNewMemberForm] = useState({ full_name: '', email: '', role_title: '' });
  const [creatingMember, setCreatingMember] = useState(false);
  const [createMemberError, setCreateMemberError] = useState<string | null>(null);
  const [newMemberResult, setNewMemberResult] = useState<CreateMemberResponse | null>(null);

  // Bóveda por integrante (HU21 AC5/AC6). Carga perezosa al expandir.
  const [vaultByMember, setVaultByMember] = useState<Record<string, VaultState>>({});
  const [revealedSecret, setRevealedSecret] = useState<RevealedSecret | null>(null);
  const [revealingItemId, setRevealingItemId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setForbidden(false);
    setForbiddenDetail(null);
    setLoadError(null);
    try {
      const [membersData, auditData] = await Promise.all([
        dashboardApi.getMembers(),
        dashboardApi.getAuditLog(),
      ]);
      setMembers(membersData);
      setAuditLog(auditData);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 403) {
        setForbidden(true);
        setForbiddenDetail(e.detail);
      } else {
        setLoadError(e instanceof Error ? e.message : 'Error al cargar el panel');
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  const generateSuggestion = useCallback(async () => {
    setGeneratingSuggestion(true);
    setConfirmError(null);
    try {
      const res = await passwordsApi.generate({ mode: 'random', length: 20 });
      setPasswordDraft(res.generated_password);
    } catch (e: unknown) {
      setConfirmError(e instanceof Error ? e.message : 'No se pudo generar una sugerencia');
    } finally {
      setGeneratingSuggestion(false);
    }
  }, []);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMemberError(null);
    setCreatingMember(true);
    try {
      const res = await dashboardApi.createMember({
        full_name: newMemberForm.full_name,
        email: newMemberForm.email,
        ...(newMemberForm.role_title ? { role_title: newMemberForm.role_title } : {}),
      });
      setNewMemberResult(res);
      setNewMemberForm({ full_name: '', email: '', role_title: '' });
      await loadData();
    } catch (err: unknown) {
      setCreateMemberError(
        err instanceof Error ? err.message : 'No se pudo dar de alta al trabajador',
      );
    } finally {
      setCreatingMember(false);
    }
  };

  const toggleMemberVault = async (memberId: string) => {
    if (vaultByMember[memberId]) {
      setVaultByMember((prev) => {
        const next = { ...prev };
        delete next[memberId];
        return next;
      });
      return;
    }
    setVaultByMember((prev) => ({ ...prev, [memberId]: { status: 'loading' } }));
    try {
      const items = await dashboardApi.getMemberVault(memberId);
      setVaultByMember((prev) => ({ ...prev, [memberId]: { status: 'loaded', items } }));
    } catch (err: unknown) {
      setVaultByMember((prev) => ({
        ...prev,
        [memberId]: {
          status: 'error',
          message: err instanceof Error ? err.message : 'No se pudo cargar la bóveda',
        },
      }));
    }
  };

  const revealVaultItem = async (member: Member, itemId: string) => {
    setRevealingItemId(itemId);
    try {
      const secret = await dashboardApi.revealMemberVaultItem(member.id, itemId);
      setRevealedSecret({ memberName: member.full_name, secret });
      // La lectura quedó registrada en los dos logs; refrescamos para que la
      // entrada aparezca sin recargar la página.
      await loadData();
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error ? err.message : 'No se pudo abrir la credencial del trabajador',
      );
    } finally {
      setRevealingItemId(null);
    }
  };

  const openPendingAction = (kind: PendingAction['kind'], memberName: string, credential: Credential) => {
    setConfirmError(null);
    setPasswordDraft('');
    setPendingAction({ kind, memberName, credential });
    generateSuggestion();
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    setConfirmSubmitting(true);
    setConfirmError(null);
    try {
      const res =
        pendingAction.kind === 'revoke'
          ? await dashboardApi.revokeInternal(pendingAction.credential.id, passwordDraft)
          : await dashboardApi.suggestExternal(pendingAction.credential.id, passwordDraft);
      setCopied(false);
      setActionResult({
        kind: pendingAction.kind,
        serviceName: `${pendingAction.memberName} — ${pendingAction.credential.service_name}`,
        credential: res.credential,
        adminApiSuccess: res.admin_api_success,
        appliedPassword: passwordDraft,
      });
      setPendingAction(null);
      await loadData();
    } catch (e: unknown) {
      setConfirmError(e instanceof Error ? e.message : 'No se pudo completar la acción');
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const confirmRestore = async () => {
    if (!restoreConfirm) return;
    setRestoreSubmitting(true);
    try {
      const res = await dashboardApi.restoreCredential(restoreConfirm.credential.id);
      setCopied(false);
      setActionResult({
        kind: 'restore',
        serviceName: `${restoreConfirm.memberName} — ${restoreConfirm.credential.service_name}`,
        credential: res.credential,
        adminApiSuccess: res.admin_api_success,
      });
      setRestoreConfirm(null);
      await loadData();
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'No se pudo restaurar el acceso');
      setRestoreConfirm(null);
    } finally {
      setRestoreSubmitting(false);
    }
  };

  const membersById = useMemo(() => {
    const map = new Map<string, Member>();
    members?.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const credentialsById = useMemo(() => {
    const map = new Map<string, Credential & { memberName: string }>();
    members?.forEach((m) => m.credentials.forEach((c) => map.set(c.id, { ...c, memberName: m.full_name })));
    return map;
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (!members) return null;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.credentials.some((c) => c.service_name.toLowerCase().includes(q)),
    );
  }, [members, searchQuery]);

  /**
   * Qué mostrar en la columna "Cuenta". Desde HU21 una entrada puede referirse
   * a un ítem de bóveda en vez de a una credencial de gobernanza, y entonces
   * credential_id viene en null.
   */
  const auditTargetLabel = (entry: AuditLogEntry): string => {
    if (entry.credential_id) {
      return credentialsById.get(entry.credential_id)?.service_name ?? entry.credential_id;
    }
    if (entry.vault_item_id) return `Bóveda · ${entry.vault_item_id.slice(0, 8)}`;
    return '—';
  };

  const exportAuditLogCsv = () => {
    if (!auditLog) return;
    const header = ['Fecha', 'Admin', 'Miembro', 'Cuenta', 'Tipo', 'Acción'];
    const rows = auditLog.map((entry) => [
      new Date(entry.created_at).toLocaleString('es-CL'),
      entry.actor_email,
      membersById.get(entry.member_id)?.full_name ?? entry.member_id,
      auditTargetLabel(entry),
      entry.credential_type === 'interna'
        ? 'Interna'
        : entry.credential_type === 'externa'
          ? 'Externa'
          : 'Bóveda',
      ACTION_LABEL[entry.action] ?? entry.action,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg dark:bg-darkBg">
        <LoadingSpinner message="Cargando..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto min-h-screen max-w-sm bg-bg dark:bg-darkBg">
        <AuthScreen
          login={login}
          register={register}
          loading={loading}
          error={error}
          clearError={clearError}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text dark:bg-darkBg dark:text-darkText">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <h1 className="text-xl font-bold text-primary dark:text-white">
          SparkGate — Panel de administración
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDark}
            className="rounded-lg p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Cambiar modo oscuro"
          >
            {dark ? 'Claro' : 'Oscuro'}
          </button>
          <button
            onClick={logout}
            className="rounded-lg px-3 py-1.5 text-sm text-alert hover:bg-alert/10"
          >
            Salir
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6">
        {forbidden && (
          <ErrorAlert
            message={
              forbiddenDetail ?? 'Este panel es exclusivo de las cuentas de empresa.'
            }
          />
        )}
        {loadError && <ErrorAlert message={loadError} onDismiss={() => setLoadError(null)} />}

        {!forbidden && members === null && !loadError && (
          <LoadingSpinner message="Cargando organización..." />
        )}

        {members && (
          <section className="mb-6 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <h2 className="mb-3 text-lg font-semibold">Agregar trabajador</h2>
            {createMemberError && (
              <div className="mb-3">
                <ErrorAlert
                  message={createMemberError}
                  onDismiss={() => setCreateMemberError(null)}
                />
              </div>
            )}
            <form onSubmit={handleCreateMember} className="flex flex-wrap items-end gap-3">
              <input
                type="text"
                required
                maxLength={120}
                placeholder="Nombre completo"
                value={newMemberForm.full_name}
                onChange={(e) =>
                  setNewMemberForm((f) => ({ ...f, full_name: e.target.value }))
                }
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800"
              />
              <input
                type="email"
                required
                placeholder="Correo electrónico"
                value={newMemberForm.email}
                onChange={(e) => setNewMemberForm((f) => ({ ...f, email: e.target.value }))}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800"
              />
              <input
                type="text"
                maxLength={120}
                placeholder="Cargo (opcional)"
                value={newMemberForm.role_title}
                onChange={(e) =>
                  setNewMemberForm((f) => ({ ...f, role_title: e.target.value }))
                }
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800"
              />
              <button
                type="submit"
                disabled={creatingMember}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingMember ? 'Creando...' : 'Crear cuenta'}
              </button>
            </form>
          </section>
        )}

        {members && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Miembros del equipo</h2>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, email o servicio..."
                className="w-64 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
            {filteredMembers?.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin resultados para "{searchQuery}".</p>
            )}
            {filteredMembers?.map((member) => (
              <div
                key={member.id}
                className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
              >
                <div className="mb-3 flex items-baseline justify-between">
                  <div>
                    <span className="font-semibold">{member.full_name}</span>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      {member.email}
                      {member.role_title ? ` · ${member.role_title}` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {member.credentials.map((credential) => (
                    <div
                      key={credential.id}
                      className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium dark:bg-gray-700">
                          {credential.type === 'interna' ? 'Interna' : 'Externa'}
                        </span>
                        <span className="text-sm">{credential.service_name}</span>
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[credential.status]}`}
                        >
                          {STATUS_LABEL[credential.status]}
                        </span>
                      </div>

                      {credential.status === 'activa' &&
                        credential.type === 'interna' &&
                        (credential.supabase_user_id === userId ? (
                          <span className="text-xs italic text-gray-500 dark:text-gray-400">
                            Tu cuenta — no revocable desde acá
                          </span>
                        ) : (
                          <button
                            onClick={() => openPendingAction('revoke', member.full_name, credential)}
                            className="rounded-lg bg-alert px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                          >
                            Revocar acceso ahora
                          </button>
                        ))}

                      {credential.status === 'activa' && credential.type === 'externa' && (
                        <button
                          onClick={() => openPendingAction('suggest', member.full_name, credential)}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        >
                          Generar sugerencia y marcar pendiente
                        </button>
                      )}

                      {credential.status !== 'activa' && (
                        <button
                          onClick={() => setRestoreConfirm({ memberName: member.full_name, credential })}
                          className="rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition-opacity hover:bg-primary/10 dark:text-white"
                        >
                          Restaurar acceso
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bóveda personal del trabajador (HU21 AC5/AC6). Carga
                    perezosa: no se pide hasta que alguien la abre, y cada
                    apertura queda registrada en la auditoría que él mismo ve. */}
                <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                  <button
                    onClick={() => toggleMemberVault(member.id)}
                    className="text-xs font-semibold text-primary hover:underline dark:text-white"
                  >
                    {vaultByMember[member.id] ? 'Ocultar' : 'Ver'} bóveda personal
                  </button>

                  {vaultByMember[member.id]?.status === 'loading' && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Cargando bóveda...
                    </p>
                  )}

                  {vaultByMember[member.id]?.status === 'error' && (
                    <p className="mt-2 text-xs text-alert">
                      {(vaultByMember[member.id] as { message: string }).message}
                    </p>
                  )}

                  {vaultByMember[member.id]?.status === 'loaded' && (
                    <div className="mt-2 flex flex-col gap-2">
                      {(vaultByMember[member.id] as { items: VaultItem[] }).items.length === 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {member.supabase_user_id
                            ? 'Este integrante no guardó credenciales en su bóveda.'
                            : 'Este integrante no tiene una cuenta SparkGate vinculada.'}
                        </p>
                      )}
                      {(vaultByMember[member.id] as { items: VaultItem[] }).items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800"
                        >
                          <div className="text-xs">
                            <span className="font-medium">{item.service_name}</span>
                            {item.username && (
                              <span className="ml-2 text-gray-500 dark:text-gray-400">
                                {item.username}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => revealVaultItem(member, item.id)}
                            disabled={revealingItemId === item.id}
                            className="rounded-lg border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition-opacity hover:bg-primary/10 disabled:opacity-50 dark:text-white"
                          >
                            {revealingItemId === item.id ? 'Abriendo...' : 'Ver contraseña'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {auditLog && (
          <section className="mt-8 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Log de auditoría</h2>
              <button
                onClick={exportAuditLogCsv}
                disabled={auditLog.length === 0}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                Exportar CSV
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Admin</th>
                    <th className="px-3 py-2">Miembro</th>
                    <th className="px-3 py-2">Cuenta</th>
                    <th className="px-3 py-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-center text-gray-500">
                        Sin acciones registradas todavía.
                      </td>
                    </tr>
                  )}
                  {auditLog.map((entry) => (
                    <tr key={entry.id} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-3 py-2">{new Date(entry.created_at).toLocaleString('es-CL')}</td>
                      <td className="px-3 py-2">{entry.actor_email}</td>
                      <td className="px-3 py-2">{membersById.get(entry.member_id)?.full_name ?? '—'}</td>
                      <td className="px-3 py-2">{auditTargetLabel(entry)}</td>
                      <td className="px-3 py-2">{ACTION_LABEL[entry.action] ?? entry.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {pendingAction && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
            <h3 className="mb-2 text-lg font-semibold">
              {pendingAction.kind === 'revoke' ? 'Revocar acceso' : 'Generar sugerencia'}
            </h3>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              {pendingAction.memberName} — {pendingAction.credential.service_name}
            </p>

            {confirmError && <ErrorAlert message={confirmError} onDismiss={() => setConfirmError(null)} />}

            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Contraseña {pendingAction.kind === 'revoke' ? 'a aplicar' : 'sugerida'}
            </label>
            <div className="mb-1 flex items-center gap-2">
              <input
                type="text"
                value={passwordDraft}
                onChange={(e) => setPasswordDraft(e.target.value)}
                disabled={generatingSuggestion}
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_LENGTH}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800"
              />
              <button
                onClick={generateSuggestion}
                disabled={generatingSuggestion}
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                {generatingSuggestion ? '...' : 'Regenerar'}
              </button>
            </div>
            {passwordDraft.length > 0 && passwordDraft.length < MIN_PASSWORD_LENGTH && (
              <p className="mb-2 text-xs text-alert">Mínimo {MIN_PASSWORD_LENGTH} caracteres.</p>
            )}

            <p className="mb-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
              {pendingAction.kind === 'revoke'
                ? 'Esta contraseña se aplica de verdad a la cuenta y la sesión se bloquea de inmediato para logins/refresh futuros; un access token ya emitido sigue válido hasta expirar (~1h).'
                : 'Esta cuenta es externa: SparkGate no puede aplicar el cambio automáticamente. Copiá esta sugerencia y aplicala manualmente en el servicio.'}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setPendingAction(null)}
                disabled={confirmSubmitting}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-semibold hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPendingAction}
                disabled={
                  confirmSubmitting || generatingSuggestion || passwordDraft.length < MIN_PASSWORD_LENGTH
                }
                className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmSubmitting ? 'Confirmando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {restoreConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
            <h3 className="mb-2 text-lg font-semibold">Restaurar acceso</h3>
            <p className="mb-4 text-sm">
              {restoreConfirm.memberName} — {restoreConfirm.credential.service_name} volverá a estado "Activa"
              {restoreConfirm.credential.type === 'interna' ? ' y la cuenta se desbanea de inmediato.' : '.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setRestoreConfirm(null)}
                disabled={restoreSubmitting}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-semibold hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRestore}
                disabled={restoreSubmitting}
                className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {restoreSubmitting ? 'Restaurando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionResult && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
            <h3 className="mb-2 text-lg font-semibold">
              {actionResult.kind === 'revoke' && 'Acceso revocado'}
              {actionResult.kind === 'suggest' && 'Sugerencia generada'}
              {actionResult.kind === 'restore' && 'Acceso restaurado'}
            </h3>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{actionResult.serviceName}</p>

            {actionResult.kind === 'revoke' && (
              <p className="mb-3 text-sm">
                {actionResult.adminApiSuccess
                  ? 'Password aplicado y sesión bloqueada de inmediato para logins/refresh futuros. Un access token ya emitido sigue válido hasta expirar (~1h).'
                  : 'No se pudo confirmar el cambio con Supabase — revisá el log del backend.'}
              </p>
            )}
            {actionResult.kind === 'suggest' && (
              <p className="mb-3 text-sm">
                Esta cuenta es externa: SparkGate no puede aplicar el cambio automáticamente. Copiá la
                contraseña y aplicala manualmente en el servicio.
              </p>
            )}
            {actionResult.kind === 'restore' && (
              <p className="mb-3 text-sm">
                {actionResult.credential.type === 'interna'
                  ? actionResult.adminApiSuccess
                    ? 'Cuenta desbaneada — ya puede volver a iniciar sesión con el último password aplicado.'
                    : 'No se pudo confirmar el desbaneo con Supabase — revisá el log del backend.'
                  : 'Estado vuelto a Activa.'}
              </p>
            )}

            {actionResult.appliedPassword && (
              <>
                <div className="mb-1 flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-800">
                  <code className="text-sm">{actionResult.appliedPassword}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(actionResult.appliedPassword!);
                      setCopied(true);
                    }}
                    className="rounded bg-primary px-2 py-1 text-xs font-semibold text-white hover:opacity-90"
                  >
                    {copied ? 'Copiado ✓' : 'Copiar'}
                  </button>
                </div>
                {copied && (
                  <p className="mb-2 text-xs font-medium text-positive">Contraseña copiada al portapapeles.</p>
                )}
                <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                  Esta contraseña no se guarda en ningún lado — anotala ahora si la necesitás.
                </p>
              </>
            )}

            <button
              onClick={() => setActionResult(null)}
              className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Contraseña temporal del trabajador recién creado (HU21 AC2). Mismo
          contrato que el modal de revocación: se muestra una vez y no se
          guarda en ningún lado. */}
      {newMemberResult && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
            <h3 className="mb-2 text-lg font-semibold">Trabajador dado de alta</h3>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              {newMemberResult.member.full_name} — {newMemberResult.member.email}
            </p>

            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Contraseña temporal
            </label>
            <div className="mb-1 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={newMemberResult.temporary_password}
                className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newMemberResult.temporary_password);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                Copiar
              </button>
            </div>
            {copied && (
              <p className="mb-2 text-xs font-medium text-positive">
                Contraseña copiada al portapapeles.
              </p>
            )}
            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              Esta contraseña no se guarda en ningún lado — entregásela ahora al trabajador.
            </p>

            <button
              onClick={() => setNewMemberResult(null)}
              className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Credencial del trabajador descifrada (HU21 AC6). El aviso no es
          decorativo: es la contrapartida de que la empresa pueda leer datos
          personales, y el trabajador ve esta misma consulta en su auditoría. */}
      {revealedSecret && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
            <h3 className="mb-2 text-lg font-semibold">
              {revealedSecret.secret.service_name}
            </h3>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              Bóveda de {revealedSecret.memberName}
              {revealedSecret.secret.username && ` — ${revealedSecret.secret.username}`}
            </p>

            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Contraseña
            </label>
            <div className="mb-3 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={revealedSecret.secret.password}
                className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(revealedSecret.secret.password);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                Copiar
              </button>
            </div>
            {copied && (
              <p className="mb-2 text-xs font-medium text-positive">
                Contraseña copiada al portapapeles.
              </p>
            )}

            {revealedSecret.secret.notes && (
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                Notas: {revealedSecret.secret.notes}
              </p>
            )}

            <p className="mb-4 rounded-lg bg-primary/10 p-3 text-xs text-primary dark:text-white">
              Es un dato personal del trabajador. Esta consulta quedó registrada
              en la auditoría de la empresa y también en la que él mismo puede
              ver desde su bóveda.
            </p>

            <button
              onClick={() => setRevealedSecret(null)}
              className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
