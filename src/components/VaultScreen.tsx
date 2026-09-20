import { useEffect, useState } from 'react';
import { useVault } from '../hooks/useVault';
import { useAccessLog, useCompanyCredentials } from '../hooks/useCompanyAccess';
import { SaveCredentialTab } from './SaveCredentialTab';
import { CredentialListTab } from './CredentialListTab';
import { CompanyCredentialsTab } from './CompanyCredentialsTab';
import { AccessLogTab } from './AccessLogTab';
import { MfaEnrollment } from './MfaEnrollment';
import { DangerZone } from './DangerZone';
import { ErrorAlert } from './ErrorAlert';

type InnerTab = 'save' | 'list' | 'company' | 'access' | 'security';

const TABS: { id: InnerTab; label: string; title: string }[] = [
  { id: 'save', label: 'Guardar', title: 'Guardar una credencial' },
  { id: 'list', label: 'Mías', title: 'Mis credenciales' },
  { id: 'company', label: 'Empresa', title: 'Cuentas que te asignó tu empresa' },
  { id: 'access', label: 'Accesos', title: 'Quién accedió a tu bóveda' },
  { id: 'security', label: 'Seguridad', title: 'Segundo factor de verificación' },
];

interface VaultScreenProps {
  onLogout: () => Promise<void>;
}

export function VaultScreen({ onLogout }: VaultScreenProps) {
  const [tab, setTab] = useState<InnerTab>('save');
  const vault = useVault();
  const company = useCompanyCredentials();
  const accessLog = useAccessLog();

  useEffect(() => {
    if (tab === 'list') vault.refresh();
    if (tab === 'company') company.refresh();
    if (tab === 'access') accessLog.refresh();
  }, [tab, vault.refresh, company.refresh, accessLog.refresh]);

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tabs */}
      <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800" role="tablist">
        {TABS.map(({ id, label, title }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            title={title}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              tab === id
                ? 'bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {vault.moduleUnavailable && (
        <ErrorAlert message="El módulo de bóveda no está operativo: falta la clave maestra. Intenta más tarde." />
      )}
      {vault.error && !vault.moduleUnavailable && (
        <ErrorAlert message={vault.error} onDismiss={vault.clearError} />
      )}

      {tab === 'company' && company.error && (
        <ErrorAlert message={company.error} onDismiss={company.clearError} />
      )}
      {tab === 'access' && accessLog.error && <ErrorAlert message={accessLog.error} />}

      {tab === 'save' && (
        <SaveCredentialTab
          saving={vault.saving}
          onSave={async (payload) => {
            const ok = await vault.saveItem(payload);
            if (ok) setTab('list');
            return ok;
          }}
        />
      )}
      {tab === 'list' && (
        <CredentialListTab
          items={vault.items}
          loading={vault.loadingList}
          onGetSecret={vault.getSecret}
          onDelete={vault.deleteItem}
        />
      )}
      {tab === 'company' && (
        <CompanyCredentialsTab items={company.items} loading={company.loading} onReveal={company.reveal} />
      )}
      {tab === 'access' && <AccessLogTab entries={accessLog.entries} loading={accessLog.loading} />}
      {tab === 'security' && <MfaEnrollment />}

      <DangerZone onPurge={vault.purgeAll} onLogout={onLogout} />
    </div>
  );
}
