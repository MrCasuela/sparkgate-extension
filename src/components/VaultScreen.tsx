import { useEffect, useState } from 'react';
import { useVault } from '../hooks/useVault';
import { SaveCredentialTab } from './SaveCredentialTab';
import { CredentialListTab } from './CredentialListTab';
import { DangerZone } from './DangerZone';
import { ErrorAlert } from './ErrorAlert';

type InnerTab = 'save' | 'list';

interface VaultScreenProps {
  onLogout: () => Promise<void>;
}

export function VaultScreen({ onLogout }: VaultScreenProps) {
  const [tab, setTab] = useState<InnerTab>('save');
  const vault = useVault();

  useEffect(() => {
    if (tab === 'list') {
      vault.refresh();
    }
  }, [tab, vault.refresh]);

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tabs */}
      <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        <button
          onClick={() => setTab('save')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            tab === 'save'
              ? 'bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Guardar
        </button>
        <button
          onClick={() => setTab('list')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            tab === 'list'
              ? 'bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Mis credenciales
        </button>
      </div>

      {vault.moduleUnavailable && (
        <ErrorAlert message="El módulo de bóveda no está operativo: falta la clave maestra. Intenta más tarde." />
      )}
      {vault.error && !vault.moduleUnavailable && (
        <ErrorAlert message={vault.error} onDismiss={vault.clearError} />
      )}

      {tab === 'save' ? (
        <SaveCredentialTab
          saving={vault.saving}
          onSave={async (payload) => {
            const ok = await vault.saveItem(payload);
            if (ok) setTab('list');
            return ok;
          }}
        />
      ) : (
        <CredentialListTab
          items={vault.items}
          loading={vault.loadingList}
          onGetSecret={vault.getSecret}
          onDelete={vault.deleteItem}
        />
      )}

      <DangerZone onPurge={vault.purgeAll} onLogout={onLogout} />
    </div>
  );
}
