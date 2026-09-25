import { describe, it, expect } from 'vitest';
import { ACTION_LABEL, DENIED_REASON_LABEL, auditActionLabel, auditMemberLabel, deniedReasonLabel } from './labels';

/**
 * Las acciones que el backend puede escribir en dashboard_audit_log
 * (sparkgate-api/sql/dashboard_schema.sql, dashboard_audit_log_action_check).
 * Si el backend suma una y acá no se etiqueta, el panel muestra el identificador
 * crudo. Cuando cambie el CHECK, cambia esta lista.
 */
const BACKEND_ACTIONS = [
  'crear_trabajador',
  'revocar_interna',
  'sugerir_externa',
  'restaurar_interna',
  'restaurar_externa',
  'listar_vault_miembro',
  'consultar_vault_miembro',
  'consultar_vault_miembro_denegado',
  'crear_credencial_externa',
  'reasignar_credencial',
  'guardar_secreto',
  'guardar_secreto_fallido',
  'consultar_secreto',
  'consultar_secreto_denegado',
  'consultar_secreto_asignado',
  'revocar_interna_denegado',
  'sugerir_externa_denegado',
  'guardar_secreto_denegado',
];

describe('ACTION_LABEL', () => {
  it.each(BACKEND_ACTIONS)('etiqueta la acción %s', (action) => {
    expect(ACTION_LABEL[action]).toBeTruthy();
    expect(ACTION_LABEL[action]).not.toBe(action);
  });

  it('no etiqueta acciones que el backend no escribe', () => {
    expect(Object.keys(ACTION_LABEL).sort()).toEqual([...BACKEND_ACTIONS].sort());
  });
});

describe('auditMemberLabel', () => {
  const names = new Map([
    ['m1', 'Bruno Vega'],
    ['m2', 'Carla Soto'],
  ]);

  it('un evento sin integrante (pool) no inventa uno', () => {
    expect(auditMemberLabel({ action: 'guardar_secreto', member_id: null, target_member_id: null }, names)).toBe('—');
  });

  it('una reasignación dice de quién a quién', () => {
    expect(
      auditMemberLabel({ action: 'reasignar_credencial', member_id: 'm1', target_member_id: 'm2' }, names),
    ).toBe('Bruno Vega → Carla Soto');
  });

  it('desde y hacia el pool se dice «Sin asignar»', () => {
    expect(
      auditMemberLabel({ action: 'reasignar_credencial', member_id: null, target_member_id: 'm2' }, names),
    ).toBe('Sin asignar → Carla Soto');
    expect(
      auditMemberLabel({ action: 'reasignar_credencial', member_id: 'm1', target_member_id: null }, names),
    ).toBe('Bruno Vega → Sin asignar');
  });

  it('un integrante que ya no existe no se muestra como UUID ni como guion', () => {
    expect(auditMemberLabel({ action: 'revocar_interna', member_id: 'gone', target_member_id: null }, names)).toBe(
      'Integrante eliminado',
    );
  });
});

/** Los motivos que el backend escribe en payload->>'denied_reason' (sparkgate-api, totp_service + secret_access). */
const BACKEND_DENIED_REASONS = ['totp_no_enrolado', 'totp_invalido', 'totp_reutilizado', 'totp_bloqueado', 'integridad'];

describe('deniedReasonLabel', () => {
  it.each(BACKEND_DENIED_REASONS)('explica el motivo %s en lenguaje de persona', (reason) => {
    expect(deniedReasonLabel(reason)).toBeTruthy();
    expect(deniedReasonLabel(reason)).not.toBe(reason);
  });

  it('no etiqueta motivos que el backend no escribe', () => {
    expect(Object.keys(DENIED_REASON_LABEL).sort()).toEqual([...BACKEND_DENIED_REASONS].sort());
  });

  it('sin motivo (una entrada normal o anterior a HU18) no muestra nada', () => {
    expect(deniedReasonLabel(null)).toBeNull();
    expect(deniedReasonLabel(undefined)).toBeNull();
    expect(deniedReasonLabel('')).toBeNull();
  });

  it('un motivo que el panel no conoce se muestra tal cual en vez de esconderse', () => {
    expect(deniedReasonLabel('motivo_nuevo')).toBe('motivo_nuevo');
  });
});

describe('auditActionLabel', () => {
  it('una entrada normal es solo su acción', () => {
    expect(auditActionLabel({ action: 'consultar_secreto', denied_reason: null })).toBe('Vio la contraseña de una cuenta');
  });

  it('una denegación dice qué se intentó y por qué falló', () => {
    expect(auditActionLabel({ action: 'revocar_interna_denegado', denied_reason: 'totp_invalido' })).toBe(
      'Intento fallido de revocar un acceso — código incorrecto, ausente o vencido',
    );
  });

  it('una denegación sin motivo (entrada anterior) sigue mostrando la acción', () => {
    expect(auditActionLabel({ action: 'consultar_secreto_denegado' })).toBe('Intento fallido de ver una contraseña');
  });
});
