import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CompanyCredentialsTab } from './CompanyCredentialsTab';
import { ApiError } from '../api/client';
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

  it('la contraseña solo se pide con el código del segundo factor, no al listar ni al presionar el botón', async () => {
    const onReveal = vi.fn().mockResolvedValue(SECRET);
    render(<CompanyCredentialsTab items={[assigned()]} loading={false} onReveal={onReveal} />);
    expect(onReveal).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Ver contraseña'));
    // Presionar el botón NO pide nada: abre el modal del código (V13: el secreto se pide on-demand).
    expect(onReveal).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Ver contraseña' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/código de tu app/i), '123456');
    await userEvent.click(screen.getByText('Continuar'));

    await waitFor(() => expect(onReveal).toHaveBeenCalledWith('c1', '123456'));
    expect(await screen.findByLabelText('Contraseña de Google Workspace')).toHaveValue('Clave-De-La-Empresa#1');
    expect(screen.getByText('Ocultar')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('si el backend rechaza el código, no se muestra nada y el motivo se ve en el modal', async () => {
    const onReveal = vi
      .fn()
      .mockRejectedValue(new ApiError(403, 'El código de verificación no es válido o ya expiró.', 'totp_invalido'));
    render(<CompanyCredentialsTab items={[assigned()]} loading={false} onReveal={onReveal} />);

    await userEvent.click(screen.getByText('Ver contraseña'));
    await userEvent.type(screen.getByLabelText(/código de tu app/i), '000000');
    await userEvent.click(screen.getByText('Continuar'));

    expect(await screen.findByText(/no es válido o ya expiró/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Contraseña de/)).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('un trabajador sin factor configurado es llevado a configurarlo, no se le dice «código incorrecto»', async () => {
    const onEnroll = vi.fn();
    const onReveal = vi
      .fn()
      .mockRejectedValue(new ApiError(403, 'Esta operación requiere un segundo factor y tu cuenta no tiene uno configurado.', 'totp_no_enrolado'));
    render(<CompanyCredentialsTab items={[assigned()]} loading={false} onReveal={onReveal} onEnroll={onEnroll} />);

    await userEvent.click(screen.getByText('Ver contraseña'));
    await userEvent.type(screen.getByLabelText(/código de tu app/i), '123456');
    await userEvent.click(screen.getByText('Continuar'));
    await userEvent.click(await screen.findByText('Configurar segundo factor'));

    expect(onEnroll).toHaveBeenCalledTimes(1);
  });

  it('un 403 que NO es del segundo factor (tu cuenta fue revocada) se muestra tal cual y no ofrece configurar nada', async () => {
    const onReveal = vi.fn().mockRejectedValue(new ApiError(403, 'Tu acceso a la organización fue revocado.'));
    render(<CompanyCredentialsTab items={[assigned()]} loading={false} onReveal={onReveal} onEnroll={vi.fn()} />);

    await userEvent.click(screen.getByText('Ver contraseña'));
    await userEvent.type(screen.getByLabelText(/código de tu app/i), '123456');
    await userEvent.click(screen.getByText('Continuar'));

    expect(await screen.findByText('Tu acceso a la organización fue revocado.')).toBeInTheDocument();
    expect(screen.queryByText('Configurar segundo factor')).not.toBeInTheDocument();
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
