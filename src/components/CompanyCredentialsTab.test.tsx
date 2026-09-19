import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CompanyCredentialsTab } from './CompanyCredentialsTab';
import type { AssignedCredential } from '../types/me';
import type { CredentialSecret } from '../types/dashboard';

function assigned(overrides: Partial<AssignedCredential> = {}): AssignedCredential {
  return {
    id: 'c1',
    organization_name: 'PYME Demo',
    service_name: 'Google Workspace',
    type: 'externa',
    username: 'ws@pyme.cl',
    status: 'activa',
    secret_updated_at: '2026-09-18T12:00:00Z',
    updated_at: '2026-09-18T12:00:00Z',
    has_secret: true,
    ...overrides,
  };
}

const SECRET: CredentialSecret = {
  id: 'c1',
  service_name: 'Google Workspace',
  type: 'externa',
  username: 'ws@pyme.cl',
  password: 'Clave-De-La-Empresa#1',
  notes: null,
  secret_updated_at: null,
};

describe('CompanyCredentialsTab', () => {
  it('lista lo asignado con el nombre de la empresa y sin ninguna contraseña', () => {
    render(<CompanyCredentialsTab items={[assigned()]} loading={false} onReveal={vi.fn()} />);
    expect(screen.getByText('Google Workspace')).toBeInTheDocument();
    expect(screen.getByText(/PYME Demo/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Contraseña de/)).toBeNull();
  });

  it('avisa por adelantado que retirar una contraseña queda registrado en la empresa', () => {
    render(<CompanyCredentialsTab items={[assigned()]} loading={false} onReveal={vi.fn()} />);
    expect(screen.getByText(/la empresa lo ve en su registro/)).toBeInTheDocument();
  });

  it('la contraseña solo se pide al presionar «Ver contraseña», no al listar', async () => {
    const onReveal = vi.fn().mockResolvedValue(SECRET);
    render(<CompanyCredentialsTab items={[assigned()]} loading={false} onReveal={onReveal} />);
    expect(onReveal).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Ver contraseña'));

    expect(onReveal).toHaveBeenCalledWith('c1');
    expect(await screen.findByLabelText('Contraseña de Google Workspace')).toHaveValue('Clave-De-La-Empresa#1');
    expect(screen.getByText('Ocultar')).toBeInTheDocument();
  });

  it('si el backend la niega (null) no se muestra nada', async () => {
    const onReveal = vi.fn().mockResolvedValue(null);
    render(<CompanyCredentialsTab items={[assigned()]} loading={false} onReveal={onReveal} />);
    await userEvent.click(screen.getByText('Ver contraseña'));
    expect(screen.queryByLabelText(/Contraseña de/)).toBeNull();
  });

  it('una credencial que no está activa no ofrece retirarla', () => {
    render(
      <CompanyCredentialsTab
        items={[assigned({ status: 'pendiente_aplicacion_manual' })]}
        loading={false}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.queryByText('Ver contraseña')).toBeNull();
    expect(screen.getByText('No disponible ahora')).toBeInTheDocument();
  });

  it('sin contraseña guardada lo dice en vez de ofrecer un botón que dará 404', () => {
    render(<CompanyCredentialsTab items={[assigned({ has_secret: false })]} loading={false} onReveal={vi.fn()} />);
    expect(screen.queryByText('Ver contraseña')).toBeNull();
    expect(screen.getByText('Sin contraseña guardada')).toBeInTheDocument();
  });

  it('sin nada asignado lo dice', () => {
    render(<CompanyCredentialsTab items={[]} loading={false} onReveal={vi.fn()} />);
    expect(screen.getByText('Tu empresa no te asignó ninguna cuenta.')).toBeInTheDocument();
  });
});
