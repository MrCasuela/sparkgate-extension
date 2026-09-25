import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VaultScreen } from './VaultScreen';
import * as mfaApi from '../api/mfa';

vi.mock('../api/vault');
vi.mock('../api/me');
vi.mock('../api/mfa');

const mfa = vi.mocked(mfaApi);

beforeEach(() => {
  vi.resetAllMocks();
  mfa.getMfaStatus.mockResolvedValue({ enrolled: false, pending: false, confirmed_at: null, last_used_at: null, locked_until: null });
});

describe('VaultScreen — el trabajador configura su segundo factor (HU18)', () => {
  it('tiene una pestaña «Seguridad» junto a las demás', () => {
    render(<VaultScreen onLogout={async () => {}} />);
    expect(screen.getByRole('tab', { name: 'Seguridad' })).toBeInTheDocument();
    for (const name of ['Guardar', 'Mías', 'Empresa', 'Accesos']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
  });

  it('el trabajador también lo necesita: retirar lo que la empresa le asignó exige el factor', async () => {
    render(<VaultScreen onLogout={async () => {}} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Seguridad' }));

    expect(await screen.findByText('Configurar segundo factor')).toBeInTheDocument();
    expect(mfa.getMfaStatus).toHaveBeenCalled();
  });

  it('no consulta el estado del factor hasta que se abre la pestaña', () => {
    render(<VaultScreen onLogout={async () => {}} />);
    expect(mfa.getMfaStatus).not.toHaveBeenCalled();
  });
});
