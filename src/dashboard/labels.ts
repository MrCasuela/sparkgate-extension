import type { Credential } from '../types/dashboard';

export const STATUS_LABEL: Record<Credential['status'], string> = {
  activa: 'Activa',
  revocada: 'Revocada',
  pendiente_aplicacion_manual: 'Pendiente',
};

export const STATUS_CLASS: Record<Credential['status'], string> = {
  activa: 'bg-positive/10 text-positive',
  revocada: 'bg-alert/10 text-alert',
  pendiente_aplicacion_manual: 'bg-primary/10 text-primary dark:text-white',
};

/** Una etiqueta por cada acción que el backend puede escribir en dashboard_audit_log. */
export const ACTION_LABEL: Record<string, string> = {
  revocar_interna: 'Revocó acceso',
  sugerir_externa: 'Generó sugerencia',
  restaurar_interna: 'Restauró acceso',
  restaurar_externa: 'Confirmó la contraseña aplicada',
  crear_trabajador: 'Dio de alta a un trabajador',
  listar_vault_miembro: 'Listó la bóveda del trabajador',
  consultar_vault_miembro: 'Abrió una credencial del trabajador',
  consultar_vault_miembro_denegado: 'Intento fallido sobre la bóveda del trabajador',
  crear_credencial_externa: 'Registró una cuenta externa',
  reasignar_credencial: 'Reasignó una cuenta',
  guardar_secreto: 'Guardó una contraseña',
  guardar_secreto_fallido: 'No pudo guardar una contraseña',
  consultar_secreto: 'Vio la contraseña de una cuenta',
  consultar_secreto_denegado: 'Intento fallido de ver una contraseña',
  consultar_secreto_asignado: 'Un integrante retiró su credencial asignada',
  // HU18: el segundo factor rechazó la operación. Hoy el backend las escribe con `denied_reason`.
  revocar_interna_denegado: 'Intento fallido de revocar un acceso',
  sugerir_externa_denegado: 'Intento fallido de generar una sugerencia',
  guardar_secreto_denegado: 'Intento fallido de guardar una contraseña',
};

/** Por qué se rechazó (payload->>'denied_reason' en dashboard_audit_log). Siempre un identificador, nunca un código. */
export const DENIED_REASON_LABEL: Record<string, string> = {
  totp_no_enrolado: 'no tenía un segundo factor configurado',
  totp_invalido: 'código incorrecto, ausente o vencido',
  totp_reutilizado: 'el código ya se había usado',
  totp_bloqueado: 'cuenta bloqueada por intentos fallidos',
  integridad: 'la credencial no pasó la verificación de integridad',
};

/** El motivo legible de un rechazo, o null si la entrada no fue rechazada. Un motivo desconocido se muestra tal cual. */
export function deniedReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return DENIED_REASON_LABEL[reason] ?? reason;
}

/** «Intento fallido de revocar un acceso» + su motivo, cuando lo hay. */
export function auditActionLabel(entry: { action: string; denied_reason?: string | null }): string {
  const label = ACTION_LABEL[entry.action] ?? entry.action;
  const reason = deniedReasonLabel(entry.denied_reason);
  return reason ? `${label} — ${reason}` : label;
}

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 64;

interface AuditEntryLike {
  action: string;
  member_id: string | null;
  target_member_id: string | null;
}

/**
 * Qué mostrar en la columna "Integrante". Un id que ya no está entre los integrantes
 * es alguien dado de baja de la organización: se dice, en vez de dejar un UUID o un
 * guion que parece un evento sin integrante.
 */
export function auditMemberLabel(
  entry: AuditEntryLike,
  memberNames: ReadonlyMap<string, string>,
): string {
  const name = (id: string | null): string | null => (id === null ? null : (memberNames.get(id) ?? 'Integrante eliminado'));

  if (entry.action === 'reasignar_credencial') {
    return `${name(entry.member_id) ?? 'Sin asignar'} → ${name(entry.target_member_id) ?? 'Sin asignar'}`;
  }
  return name(entry.member_id) ?? '—';
}
