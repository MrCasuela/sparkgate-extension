import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { AuthScreen } from '../components/AuthScreen';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MfaEnrollment } from '../components/MfaEnrollment';
import { ErrorAlert } from '../components/ErrorAlert';
import { ApiError } from '../api/client';
import { useStepUpPrompt } from '../hooks/useStepUpPrompt';
import { stepUpFailure, type StepUpKind } from '../utils/stepUp';
import * as dashboardApi from '../api/dashboard';
import * as passwordsApi from '../api/passwords';
import type {
  AuditLogEntry,
  CreateCredentialRequest,
  CreateMemberResponse,
  Credential,
  CredentialSecret,
  CredentialSecretRequest,
  Member,
} from '../types/dashboard';
import type { VaultItem, VaultSecret } from '../types/vault';
import { ActionResultModal, type ActionResult } from './ActionResultModal';
import { ConfirmActionModal, type ConfirmKind } from './ConfirmActionModal';
import { CopyField } from './CopyField';
import { CredentialRow } from './CredentialRow';
import { ACTION_LABEL, auditMemberLabel } from './labels';
import { Modal } from './Modal';
import { NewCredentialForm } from './NewCredentialForm';
import { ReassignModal } from './ReassignModal';
import { SaveSecretModal } from './SaveSecretModal';
import { SecretRevealModal } from './SecretRevealModal';

interface PendingAction {
  kind: ConfirmKind;
  memberName: string;
  credential: Credential;
}

interface RestoreConfirm {
  memberName: string;
  credential: Credential;
}

interface RevealedCredential {
  secret: CredentialSecret;
  holderName: string | null;
}

interface CredentialTarget {
  credential: Credential;
  holderName: string | null;
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

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function errorText(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/** El error de una acción que pide el segundo factor: si fue el factor, también QUÉ hay que hacer (V20: el detail, tal cual). */
function failureOf(e: unknown, fallback: string): { message: string; kind: StepUpKind | null } {
  const step = stepUpFailure(e);
  return { message: step?.message ?? errorText(e, fallback), kind: step?.kind ?? null };
}

export function DashboardApp() {
  const { isAuthenticated, userId, loading, login, register, error, clearError, logout } = useAuth();
  const { dark, toggleDark } = useTheme();

  const [members, setMembers] = useState<Member[] | null>(null);
  const [pool, setPool] = useState<Credential[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [forbiddenDetail, setForbiddenDetail] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Segundo factor (HU18): configurar, activar o desactivar el propio.
  const [showMfa, setShowMfa] = useState(false);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmErrorKind, setConfirmErrorKind] = useState<StepUpKind | null>(null);

  const [restoreConfirm, setRestoreConfirm] = useState<RestoreConfirm | null>(null);
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);

  const [actionResult, setActionResult] = useState<ActionResult | null>(null);

  // Contraseña guardada de una credencial de la organización (etapa C)
  const [revealedCredential, setRevealedCredential] = useState<RevealedCredential | null>(null);
  const [saveTarget, setSaveTarget] = useState<CredentialTarget | null>(null);
  const [saveSubmitting, setSaveSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrorKind, setSaveErrorKind] = useState<StepUpKind | null>(null);
  const [reassignTarget, setReassignTarget] = useState<Credential | null>(null);
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [creatingCredential, setCreatingCredential] = useState(false);
  const [createCredentialError, setCreateCredentialError] = useState<string | null>(null);

  // Alta de trabajador (HU21 AC2)
  const [newMemberForm, setNewMemberForm] = useState({ full_name: '', email: '', role_title: '' });
  const [creatingMember, setCreatingMember] = useState(false);
  const [createMemberError, setCreateMemberError] = useState<string | null>(null);
  const [newMemberResult, setNewMemberResult] = useState<CreateMemberResponse | null>(null);

  // Bóveda por integrante (HU21 AC5/AC6). Carga perezosa al expandir.
  const [vaultByMember, setVaultByMember] = useState<Record<string, VaultState>>({});
  const [revealedSecret, setRevealedSecret] = useState<RevealedSecret | null>(null);

  // Ver una contraseña ajena pide el segundo factor. Sin uno configurado, el modal lleva a configurarlo.
  const openMfa = useCallback(() => setShowMfa(true), []);
  const stepUp = useStepUpPrompt(openMfa);

  const loadData = useCallback(async () => {
    setForbidden(false);
    setForbiddenDetail(null);
    setLoadError(null);
    try {
      const [membersData, poolData, auditData] = await Promise.all([
        dashboardApi.getMembers(),
        dashboardApi.getUnassignedCredentials(),
        dashboardApi.getAuditLog(),
      ]);
      setMembers(membersData);
      setPool(poolData);
      setAuditLog(auditData);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 403) {
        setForbidden(true);
        setForbiddenDetail(e.detail);
      } else {
        setLoadError(errorText(e, 'Error al cargar el panel'));
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  const membersById = useMemo(() => {
    const map = new Map<string, Member>();
    members?.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const memberNames = useMemo(() => {
    const map = new Map<string, string>();
    members?.forEach((m) => map.set(m.id, m.full_name));
    return map;
  }, [members]);

  const credentialsById = useMemo(() => {
    const map = new Map<string, Credential>();
    members?.forEach((m) => m.credentials.forEach((c) => map.set(c.id, c)));
    pool.forEach((c) => map.set(c.id, c));
    return map;
  }, [members, pool]);

  const holderNameOf = (credential: Credential): string | null =>
    credential.member_id ? (membersById.get(credential.member_id)?.full_name ?? null) : null;

  const generatePassword = useCallback(async (): Promise<string | null> => {
    try {
      const res = await passwordsApi.generate({ mode: 'random', length: 20 });
      return res.generated_password;
    } catch (e: unknown) {
      setSaveError(errorText(e, 'No se pudo generar una contraseña'));
      return null;
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
      setCreateMemberError(errorText(err, 'No se pudo dar de alta al trabajador'));
    } finally {
      setCreatingMember(false);
    }
  };

  const handleCreateCredential = async (payload: CreateCredentialRequest): Promise<boolean> => {
    setCreateCredentialError(null);
    setCreatingCredential(true);
    try {
      await dashboardApi.createCredential(payload);
      await loadData();
      return true;
    } catch (err: unknown) {
      setCreateCredentialError(errorText(err, 'No se pudo registrar la cuenta'));
      return false;
    } finally {
      setCreatingCredential(false);
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
        [memberId]: { status: 'error', message: errorText(err, 'No se pudo cargar la bóveda') },
      }));
    }
  };

  const revealVaultItem = (member: Member, item: VaultItem) => {
    stepUp.ask({
      title: 'Ver contraseña del trabajador',
      subtitle: `${item.service_name} — bóveda de ${member.full_name}`,
      description:
        'Es un dato personal del trabajador. La consulta queda registrada en la auditoría de la empresa y también en la que él mismo ve. Confirmá con tu segundo factor.',
      run: async (code) => {
        const secret = await dashboardApi.revealMemberVaultItem(member.id, item.id, code);
        setRevealedSecret({ memberName: member.full_name, secret });
        // La lectura quedó registrada en los dos logs; refrescamos para que la
        // entrada aparezca sin recargar la página.
        await loadData();
      },
    });
  };

  const revealCredential = (credential: Credential) => {
    const holderName = holderNameOf(credential);
    stepUp.ask({
      title: 'Ver contraseña',
      subtitle: `${holderName ? `${holderName} — ` : ''}${credential.service_name}`,
      description: 'La consulta queda registrada en la auditoría de la empresa. Confirmá con tu segundo factor.',
      run: async (code) => {
        const secret = await dashboardApi.revealCredentialSecret(credential.id, code);
        setRevealedCredential({ secret, holderName });
        await loadData();
      },
    });
  };

  const openSaveSecret = (credential: Credential) => {
    setSaveError(null);
    setSaveErrorKind(null);
    setSaveTarget({ credential, holderName: holderNameOf(credential) });
  };

  const submitSaveSecret = async (payload: CredentialSecretRequest, code: string) => {
    if (!saveTarget) return;
    setSaveSubmitting(true);
    setSaveError(null);
    setSaveErrorKind(null);
    try {
      const res = await dashboardApi.saveCredentialSecret(saveTarget.credential.id, payload, code);
      setActionResult({
        kind: 'save',
        title: `${saveTarget.holderName ? `${saveTarget.holderName} — ` : ''}${saveTarget.credential.service_name}`,
        credential: res.credential,
        adminApiSuccess: res.admin_api_success,
        password: payload.password,
        secretStored: res.secret_stored,
        rotationSuggested: [],
      });
      setSaveTarget(null);
      await loadData();
    } catch (err: unknown) {
      const failure = failureOf(err, 'No se pudo guardar la contraseña');
      setSaveError(failure.message);
      setSaveErrorKind(failure.kind);
    } finally {
      setSaveSubmitting(false);
    }
  };

  const submitReassign = async (memberId: string | null) => {
    if (!reassignTarget) return;
    setReassignSubmitting(true);
    setReassignError(null);
    try {
      const res = await dashboardApi.reassignCredential(reassignTarget.id, memberId);
      setActionResult({
        kind: 'reassign',
        title: reassignTarget.service_name,
        credential: res.credential,
        adminApiSuccess: true,
        secretStored: null,
        rotationSuggested: res.rotation_suggested,
        reassignedTo: memberId ? (membersById.get(memberId)?.full_name ?? null) : null,
      });
      setReassignTarget(null);
      await loadData();
    } catch (err: unknown) {
      setReassignError(errorText(err, 'No se pudo reasignar la cuenta'));
    } finally {
      setReassignSubmitting(false);
    }
  };

  const openPendingAction = (kind: ConfirmKind, memberName: string, credential: Credential) => {
    setConfirmError(null);
    setConfirmErrorKind(null);
    setPendingAction({ kind, memberName, credential });
  };

  const confirmPendingAction = async (customPassword: string | undefined, code: string) => {
    if (!pendingAction) return;
    setConfirmSubmitting(true);
    setConfirmError(null);
    setConfirmErrorKind(null);
    try {
      const res =
        pendingAction.kind === 'revoke'
          ? await dashboardApi.revokeInternal(pendingAction.credential.id, customPassword, code)
          : await dashboardApi.suggestExternal(pendingAction.credential.id, customPassword, code);
      setActionResult({
        kind: pendingAction.kind,
        title: `${pendingAction.memberName} — ${pendingAction.credential.service_name}`,
        credential: res.credential,
        adminApiSuccess: res.admin_api_success,
        // La que devolvió el backend, no una generada acá.
        password: res.applied_password ?? res.suggested_password ?? undefined,
        secretStored: res.secret_stored,
        rotationSuggested: res.rotation_suggested,
      });
      setPendingAction(null);
      await loadData();
    } catch (e: unknown) {
      const failure = failureOf(e, 'No se pudo completar la acción');
      setConfirmError(failure.message);
      setConfirmErrorKind(failure.kind);
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const confirmRestore = async () => {
    if (!restoreConfirm) return;
    setRestoreSubmitting(true);
    try {
      const res = await dashboardApi.restoreCredential(restoreConfirm.credential.id);
      setActionResult({
        kind: 'restore',
        title: `${restoreConfirm.memberName} — ${restoreConfirm.credential.service_name}`,
        credential: res.credential,
        adminApiSuccess: res.admin_api_success,
        secretStored: null,
        rotationSuggested: [],
      });
      setRestoreConfirm(null);
      await loadData();
    } catch (e: unknown) {
      setLoadError(
        errorText(
          e,
          restoreConfirm.credential.type === 'interna'
            ? 'No se pudo restaurar el acceso'
            : 'No se pudo confirmar la contraseña',
        ),
      );
      setRestoreConfirm(null);
    } finally {
      setRestoreSubmitting(false);
    }
  };

  const filteredMembers = useMemo(() => {
    if (!members) return null;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.credentials.some(
          (c) => c.service_name.toLowerCase().includes(q) || (c.username ?? '').toLowerCase().includes(q),
        ),
    );
  }, [members, searchQuery]);

  /**
   * Qué mostrar en la columna "Cuenta". Una entrada puede referirse a una
   * credencial (que puede estar en el pool), a un ítem de bóveda (credential_id
   * null) o a nada (alta de trabajador).
   */
  const auditTargetLabel = (entry: AuditLogEntry): string => {
    if (entry.credential_id) {
      return credentialsById.get(entry.credential_id)?.service_name ?? entry.credential_id;
    }
    if (entry.vault_item_id) return `Bóveda · ${entry.vault_item_id.slice(0, 8)}`;
    return '—';
  };

  const auditActorLabel = (entry: AuditLogEntry): string => entry.actor_email ?? 'Cuenta eliminada';

  const exportAuditLogCsv = () => {
    if (!auditLog) return;
    const header = ['Fecha', 'Actor', 'Integrante', 'Cuenta', 'Tipo', 'Acción'];
    const rows = auditLog.map((entry) => [
      new Date(entry.created_at).toLocaleString('es-CL'),
      auditActorLabel(entry),
      auditMemberLabel(entry, memberNames),
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

  const rotationPending = [...(members?.flatMap((m) => m.credentials) ?? []), ...pool].filter(
    (c) => c.rotation_required,
  ).length;

  const renderCredential = (credential: Credential, memberName: string) => (
    <CredentialRow
      key={credential.id}
      credential={credential}
      isOwnAccount={credential.supabase_user_id === userId}
      onReveal={revealCredential}
      onSaveSecret={openSaveSecret}
      onReassign={(c) => {
        setReassignError(null);
        setReassignTarget(c);
      }}
      onRevoke={(c) => openPendingAction('revoke', memberName, c)}
      onSuggest={(c) => openPendingAction('suggest', memberName, c)}
      onRestore={(c) => setRestoreConfirm({ memberName, credential: c })}
    />
  );

  return (
    <div className="min-h-screen bg-bg text-text dark:bg-darkBg dark:text-darkText">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <h1 className="text-xl font-bold text-primary dark:text-white">
          SparkGate — Panel de administración
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMfa(true)}
            className="rounded-lg px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Segundo factor
          </button>
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

        {members && rotationPending > 0 && (
          <p
            role="status"
            className="mb-4 rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
          >
            {rotationPending === 1
              ? '1 contraseña conviene rotarla'
              : `${rotationPending} contraseñas conviene rotarlas`}
            : alguien que ya no debería conocerlas las conoce. Buscá «Rotar pendiente» y guardá una
            contraseña nueva.
          </p>
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
          <NewCredentialForm
            members={members}
            submitting={creatingCredential}
            error={createCredentialError}
            onDismissError={() => setCreateCredentialError(null)}
            onSubmit={handleCreateCredential}
          />
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
                  {member.credentials.map((credential) => renderCredential(credential, member.full_name))}
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
                            onClick={() => revealVaultItem(member, item)}
                            className="rounded-lg border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition-opacity hover:bg-primary/10 disabled:opacity-50 dark:text-white"
                          >
                            Ver contraseña
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

        {/* El pool: cuentas de la empresa que nadie tiene hoy. No aparecen en
            ningún integrante, y sin esta sección serían invisibles. */}
        {members && (
          <section className="mt-6 flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Cuentas sin asignar</h2>
            {pool.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No hay cuentas sin asignar. Una cuenta vuelve acá cuando la devolvés desde «Reasignar».
              </p>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                {pool.map((credential) => renderCredential(credential, 'Sin asignar'))}
              </div>
            )}
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
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Integrante</th>
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
                      <td className="px-3 py-2">{auditActorLabel(entry)}</td>
                      <td className="px-3 py-2">{auditMemberLabel(entry, memberNames)}</td>
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
        <ConfirmActionModal
          kind={pendingAction.kind}
          memberName={pendingAction.memberName}
          credential={pendingAction.credential}
          submitting={confirmSubmitting}
          error={confirmError}
          errorKind={confirmErrorKind}
          onConfirm={confirmPendingAction}
          onClose={() => setPendingAction(null)}
          onEnroll={() => {
            setPendingAction(null);
            setShowMfa(true);
          }}
        />
      )}

      {restoreConfirm && (
        <Modal
          title={restoreConfirm.credential.type === 'interna' ? 'Restaurar acceso' : 'Confirmar contraseña'}
        >
          <p className="mb-4 text-sm">
            {restoreConfirm.credential.type === 'interna'
              ? `${restoreConfirm.memberName} — ${restoreConfirm.credential.service_name} volverá a estado "Activa" y la cuenta se desbanea de inmediato.`
              : `Confirmá que ya aplicaste la contraseña sugerida en ${restoreConfirm.credential.service_name} (${restoreConfirm.memberName}). La cuenta vuelve a estado "Activa".`}
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
              {restoreSubmitting
                ? restoreConfirm.credential.type === 'interna'
                  ? 'Restaurando...'
                  : 'Confirmando...'
                : restoreConfirm.credential.type === 'interna'
                  ? 'Confirmar'
                  : 'Ya la apliqué'}
            </button>
          </div>
        </Modal>
      )}

      {stepUp.modal}

      {showMfa && (
        <Modal
          title="Segundo factor de verificación"
          subtitle="Se pide un código de tu app de autenticación para ver o rotar contraseñas que no son tuyas."
        >
          <MfaEnrollment />
          <button
            onClick={() => setShowMfa(false)}
            className="mt-4 w-full rounded-lg border border-gray-300 py-2 text-sm font-semibold hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            Cerrar
          </button>
        </Modal>
      )}

      {actionResult && <ActionResultModal result={actionResult} onClose={() => setActionResult(null)} />}

      {saveTarget && (
        <SaveSecretModal
          credential={saveTarget.credential}
          holderName={saveTarget.holderName}
          submitting={saveSubmitting}
          error={saveError}
          errorKind={saveErrorKind}
          onGenerate={generatePassword}
          onSubmit={submitSaveSecret}
          onClose={() => setSaveTarget(null)}
          onEnroll={() => {
            setSaveTarget(null);
            setShowMfa(true);
          }}
        />
      )}

      {reassignTarget && members && (
        <ReassignModal
          credential={reassignTarget}
          members={members}
          submitting={reassignSubmitting}
          error={reassignError}
          onSubmit={submitReassign}
          onClose={() => setReassignTarget(null)}
        />
      )}

      {revealedCredential && (
        <SecretRevealModal
          secret={revealedCredential.secret}
          holderName={revealedCredential.holderName}
          onClose={() => setRevealedCredential(null)}
        />
      )}

      {/* Contraseña temporal del trabajador recién creado (HU21 AC2). El backend
          la guarda cifrada como la vigente de su cuenta interna; si no pudo, esta
          respuesta es la única copia y hay que decirlo. */}
      {newMemberResult && (
        <Modal
          title="Trabajador dado de alta"
          subtitle={`${newMemberResult.member.full_name} — ${newMemberResult.member.email}`}
        >
          <CopyField value={newMemberResult.temporary_password} label="Contraseña temporal" />
          {newMemberResult.secret_stored ? (
            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              Quedó guardada cifrada como la contraseña vigente de su cuenta: podés volver a verla con «Ver
              contraseña» mientras él no la cambie. Entregásela ahora.
            </p>
          ) : (
            <p role="alert" className="mb-4 rounded-lg bg-alert/10 p-3 text-xs font-medium text-alert">
              NO se pudo guardar en SparkGate: esta es la única copia. Entregásela ahora al trabajador y
              anotala.
            </p>
          )}
          <button
            onClick={() => setNewMemberResult(null)}
            className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Cerrar
          </button>
        </Modal>
      )}

      {/* Credencial de la bóveda personal del trabajador (HU21 AC6). El aviso no
          es decorativo: es la contrapartida de que la empresa pueda leer datos
          personales, y el trabajador ve esta misma consulta en su auditoría. */}
      {revealedSecret && (
        <Modal
          title={revealedSecret.secret.service_name}
          subtitle={`Bóveda de ${revealedSecret.memberName}${revealedSecret.secret.username ? ` — ${revealedSecret.secret.username}` : ''}`}
        >
          <CopyField value={revealedSecret.secret.password} />
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
        </Modal>
      )}
    </div>
  );
}
