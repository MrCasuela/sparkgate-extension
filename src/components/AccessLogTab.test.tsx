import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AccessLogTab, VAULT_ACTION_LABEL, isCompanyAccess } from './AccessLogTab';
import type { VaultAuditEntry } from '../types/vault';

function entry(overrides: Partial<VaultAuditEntry> = {}): VaultAuditEntry {
  return {
    id: crypto.randomUUID(),
    user_id: 'worker-1',
    item_id: null,
    action: 'guardar',
    result: 'ok',
    actor_user_id: null,
    created_at: '2026-09-18T12:00:00Z',
    ...overrides,
  };
}

/** Acciones que el backend puede escribir en vault_audit_log (sql/vault_schema.sql). */
const BACKEND_VAULT_ACTIONS = [
  'guardar',
  'listar',
  'consultar',
  'consultar_denegado',
  'eliminar',
  'eliminar_denegado',
  'eliminar_todo',
  'eliminar_cuenta',
  'listar_admin',
  'consultar_admin',
  'consultar_admin_denegado',
  'consultar_credencial_interna_admin',
];

describe('AccessLogTab — la mitigación de privacidad de HU21', () => {
  it('etiqueta cada acción que el backend puede escribir', () => {
    expect(Object.keys(VAULT_ACTION_LABEL).sort()).toEqual([...BACKEND_VAULT_ACTIONS].sort());
  });

  it('un acceso con actor_user_id es de la empresa; sin él, es propio', () => {
    expect(isCompanyAccess(entry({ actor_user_id: 'admin-1' }))).toBe(true);
    expect(isCompanyAccess(entry())).toBe(false);
  });

  it('resume cuántas veces accedió la empresa', () => {
    render(
      <AccessLogTab
        entries={[
          entry({ action: 'consultar_admin', actor_user_id: 'admin-1' }),
          entry({ action: 'listar_admin', actor_user_id: 'admin-1' }),
          entry({ action: 'guardar' }),
        ]}
        loading={false}
      />,
    );
    expect(screen.getByText('Tu empresa accedió 2 veces a tu bóveda.')).toBeInTheDocument();
    expect(screen.getByText('Tu empresa abrió una credencial tuya')).toBeInTheDocument();
  });

  it('cuando la empresa no accedió, lo dice', () => {
    render(<AccessLogTab entries={[entry()]} loading={false} />);
    expect(screen.getByText('Tu empresa no accedió a tu bóveda.')).toBeInTheDocument();
  });

  it('el retiro de la contraseña interna se le cuenta al trabajador', () => {
    render(
      <AccessLogTab
        entries={[entry({ action: 'consultar_credencial_interna_admin', actor_user_id: 'admin-1' })]}
        loading={false}
      />,
    );
    expect(screen.getByText('Tu empresa retiró la contraseña de tu cuenta SparkGate')).toBeInTheDocument();
    expect(screen.getByText('Tu empresa accedió 1 vez a tu bóveda.')).toBeInTheDocument();
  });

  it('un acceso denegado se marca', () => {
    render(
      <AccessLogTab
        entries={[entry({ action: 'consultar_admin_denegado', result: 'denegado', actor_user_id: 'admin-1' })]}
        loading={false}
      />,
    );
    expect(screen.getByText('Denegado')).toBeInTheDocument();
  });

  it('sin entradas lo dice', () => {
    render(<AccessLogTab entries={[]} loading={false} />);
    expect(screen.getByText('Todavía no hay accesos registrados.')).toBeInTheDocument();
  });
});
