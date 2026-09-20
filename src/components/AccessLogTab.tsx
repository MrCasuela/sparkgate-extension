import { LoadingSpinner } from './LoadingSpinner';
import type { VaultAuditEntry } from '../types/vault';

interface AccessLogTabProps {
  entries: VaultAuditEntry[];
  loading: boolean;
}

/** Una etiqueta por cada acción que el backend puede escribir en vault_audit_log. */
export const VAULT_ACTION_LABEL: Record<string, string> = {
  guardar: 'Guardaste una credencial',
  listar: 'Abriste tu bóveda',
  consultar: 'Viste una credencial',
  consultar_denegado: 'Intento fallido de ver una credencial',
  eliminar: 'Eliminaste una credencial',
  eliminar_denegado: 'Intento fallido de eliminar una credencial',
  eliminar_todo: 'Vaciaste tu bóveda',
  eliminar_cuenta: 'Eliminaste tu cuenta',
  listar_admin: 'Tu empresa listó tu bóveda',
  consultar_admin: 'Tu empresa abrió una credencial tuya',
  consultar_admin_denegado: 'Intento fallido de tu empresa sobre tu bóveda',
  consultar_credencial_interna_admin: 'Tu empresa retiró la contraseña de tu cuenta SparkGate',
  // HU18: el ciclo de vida de TU segundo factor. Lo ves acá porque es tu cuenta: si alguien lo toca, te enterás.
  mfa_enrolar: 'Empezaste a configurar tu segundo factor',
  mfa_activar: 'Activaste tu segundo factor',
  mfa_desactivar: 'Desactivaste tu segundo factor',
  mfa_denegado: 'Intento fallido con tu segundo factor',
};

/**
 * Lo hizo tu empresa y no vos. `actor_user_id` viene solo cuando quien consultó no
 * fue el dueño (HU21 AC7); es un UUID, así que no se puede mostrar un nombre: se
 * dice "tu empresa", que es lo que ese id representa.
 */
export function isCompanyAccess(entry: VaultAuditEntry): boolean {
  return entry.actor_user_id !== null;
}

/**
 * La mitigación de privacidad de HU21: la empresa puede abrir tu bóveda, y esta es la
 * pantalla donde te enterás. Antes GET /vault/audit existía pero ninguna pantalla lo
 * mostraba, así que la mitigación solo se alcanzaba por API cruda.
 */
export function AccessLogTab({ entries, loading }: AccessLogTabProps) {
  if (loading) {
    return <LoadingSpinner message="Cargando el historial..." small />;
  }

  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
        Todavía no hay accesos registrados.
      </p>
    );
  }

  const fromCompany = entries.filter(isCompanyAccess).length;

  return (
    <div className="flex flex-col gap-2">
      <p
        className={`rounded-lg p-2 text-xs ${
          fromCompany > 0
            ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
        }`}
      >
        {fromCompany === 0
          ? 'Tu empresa no accedió a tu bóveda.'
          : fromCompany === 1
            ? 'Tu empresa accedió 1 vez a tu bóveda.'
            : `Tu empresa accedió ${fromCompany} veces a tu bóveda.`}
      </p>
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => {
          const company = isCompanyAccess(entry);
          return (
            <li
              key={entry.id}
              className={`rounded-lg border px-3 py-2 text-xs ${
                company
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
                  : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{VAULT_ACTION_LABEL[entry.action] ?? entry.action}</span>
                {entry.result !== 'ok' && (
                  <span className="rounded bg-alert/10 px-1.5 py-0.5 text-alert">
                    {entry.result === 'denegado' ? 'Denegado' : 'Error'}
                  </span>
                )}
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                {new Date(entry.created_at).toLocaleString('es-CL')}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
