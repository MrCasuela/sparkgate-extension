import { describe, it, expect } from 'vitest';
import { ACTION_LABEL, auditMemberLabel } from './labels';

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
