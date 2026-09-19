import type { CredentialSecret } from '../types/dashboard';
import { CopyField } from './CopyField';
import { Modal } from './Modal';

interface SecretRevealModalProps {
  secret: CredentialSecret;
  /** Quién tiene hoy la cuenta; null = sin asignar. */
  holderName: string | null;
  onClose: () => void;
}

/**
 * La contraseña guardada de una credencial de la organización (HU21 etapa C).
 *
 * El aviso de una cuenta interna no es decorativo: con su contraseña vigente la
 * empresa puede iniciar sesión como el trabajador, y esa sesión queda en SU
 * auditoría atribuida a él, no a la empresa (R-HU21-5). Lo que sí queda
 * registrado es que la contraseña se retiró.
 */
export function SecretRevealModal({ secret, holderName, onClose }: SecretRevealModalProps) {
  const isInternal = secret.type === 'interna';

  return (
    <Modal
      title={secret.service_name}
      subtitle={[holderName ? `De ${holderName}` : 'Sin asignar', secret.username].filter(Boolean).join(' — ')}
    >
      <CopyField value={secret.password} />

      {secret.notes && (
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Notas: {secret.notes}</p>
      )}

      {isInternal ? (
        <p role="alert" className="mb-4 rounded-lg bg-amber-100 p-3 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          Esta es la cuenta SparkGate de {holderName ?? 'esta persona'}. Con esta contraseña la empresa puede
          iniciar sesión como {holderName ?? 'ella'}, y esa sesión queda registrada en su historial a nombre
          suyo, no de la empresa. Que la contraseña se retiró sí queda registrado, y él lo ve en su
          auditoría.
        </p>
      ) : (
        <p className="mb-4 rounded-lg bg-primary/10 p-3 text-xs text-primary dark:text-white">
          Esta consulta quedó registrada en la auditoría de la empresa.
        </p>
      )}

      <button
        onClick={onClose}
        className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Cerrar
      </button>
    </Modal>
  );
}
