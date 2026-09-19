import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardApp } from './DashboardApp';
import * as dashboardApi from '../api/dashboard';
import * as passwordsApi from '../api/passwords';
import { setJwt, setUserId, clearAuth } from '../utils/storage';
import { credential, member, makeJwt } from '../test/fixtures';
import type { CredentialActionResponse } from '../types/dashboard';

vi.mock('../api/dashboard');
vi.mock('../api/passwords');

const api = vi.mocked(dashboardApi);
const passwords = vi.mocked(passwordsApi);

const INTERNAL = credential({ id: 'int-1', type: 'interna', service_name: 'SparkGate', supabase_user_id: 'worker-1', member_id: 'member-1' });
const EXTERNAL = credential({ id: 'ext-1', service_name: 'Google Workspace' });

function actionResponse(overrides: Partial<CredentialActionResponse> = {}): CredentialActionResponse {
  return {
    credential: { ...INTERNAL, status: 'revocada' },
    admin_api_success: true,
    applied_password: null,
    suggested_password: null,
    secret_stored: true,
    rotation_suggested: [],
    ...overrides,
  };
}

async function renderPanel() {
  await setJwt(makeJwt());
  await setUserId('admin-1');
  render(<DashboardApp />);
  await screen.findByText('Bruno Vega', { selector: 'span' });
}

beforeEach(async () => {
  vi.resetAllMocks();
  await clearAuth();
  api.getMembers.mockResolvedValue([member({ credentials: [INTERNAL, EXTERNAL] })]);
  api.getUnassignedCredentials.mockResolvedValue([]);
  api.getAuditLog.mockResolvedValue([]);
});

describe('DashboardApp — el panel muestra lo que devuelve el backend (B2)', () => {
  it('revocar: no genera la contraseña en el navegador y muestra la que devolvió el backend', async () => {
    api.revokeInternal.mockResolvedValue(actionResponse({ applied_password: 'Aplicada#Por#El#Backend' }));
    await renderPanel();

    await userEvent.click(screen.getByText('Revocar acceso ahora'));
    await userEvent.click(screen.getByText('Confirmar'));

    // Sin contraseña propia: el backend la genera. Ni una llamada a /passwords/generate.
    await waitFor(() => expect(api.revokeInternal).toHaveBeenCalledWith('int-1', undefined));
    expect(passwords.generate).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog', { name: 'Acceso revocado' });
    expect(within(dialog).getByLabelText('Contraseña')).toHaveValue('Aplicada#Por#El#Backend');
    expect(within(dialog).getByText(/Quedó guardada cifrada/)).toBeInTheDocument();
  });

  it('una contraseña propia se envía tal cual', async () => {
    api.suggestExternal.mockResolvedValue(
      actionResponse({ credential: { ...EXTERNAL, status: 'pendiente_aplicacion_manual' }, suggested_password: 'Mi-Propia-Clave-1!' }),
    );
    await renderPanel();

    await userEvent.click(screen.getByText(/Generar sugerencia y marcar pendiente/));
    await userEvent.type(screen.getByLabelText(/contraseña propia/i), 'Mi-Propia-Clave-1!');
    await userEvent.click(screen.getByText('Confirmar'));

    await waitFor(() => expect(api.suggestExternal).toHaveBeenCalledWith('ext-1', 'Mi-Propia-Clave-1!'));
  });

  it('si el backend no pudo guardarla, la respuesta se presenta como la única copia', async () => {
    api.revokeInternal.mockResolvedValue(actionResponse({ applied_password: 'Sola#Copia#12345', secret_stored: false }));
    await renderPanel();

    await userEvent.click(screen.getByText('Revocar acceso ahora'));
    await userEvent.click(screen.getByText('Confirmar'));

    const dialog = await screen.findByRole('dialog', { name: 'Acceso revocado' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/única copia/);
  });

  it('tras revocar, las credenciales a rotar quedan listadas en el resultado', async () => {
    api.revokeInternal.mockResolvedValue(
      actionResponse({
        applied_password: 'Aplicada#Por#El#Backend',
        rotation_suggested: [{ credential_id: 'ext-1', service_name: 'Google Workspace', type: 'externa', member_name: 'Bruno Vega' }],
      }),
    );
    await renderPanel();

    await userEvent.click(screen.getByText('Revocar acceso ahora'));
    await userEvent.click(screen.getByText('Confirmar'));

    expect(await screen.findByText(/Google Workspace — la conoce Bruno Vega/)).toBeInTheDocument();
  });

  it('ver la contraseña de una interna muestra la advertencia de suplantación', async () => {
    api.revealCredentialSecret.mockResolvedValue({
      id: 'int-1', service_name: 'SparkGate', type: 'interna', username: null,
      password: 'Vigente#De#La#Cuenta1', notes: null, secret_updated_at: null,
    });
    await renderPanel();

    // El primer «Ver contraseña» es el de la interna (primera fila del integrante).
    await userEvent.click(screen.getAllByText('Ver contraseña')[0]);

    const dialog = await screen.findByRole('dialog', { name: 'SparkGate' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/iniciar sesión como Bruno Vega/);
    expect(within(dialog).getByLabelText('Contraseña')).toHaveValue('Vigente#De#La#Cuenta1');
  });

  it('las cuentas sin asignar aparecen en su propia sección', async () => {
    api.getUnassignedCredentials.mockResolvedValue([
      credential({ id: 'pool-1', service_name: 'Google Ads (cuenta compartida)', member_id: null }),
    ]);
    await renderPanel();
    expect(await screen.findByText('Google Ads (cuenta compartida)')).toBeInTheDocument();
    expect(screen.getByText('Cuentas sin asignar')).toBeInTheDocument();
  });

  it('el alta de trabajador ya no dice que la contraseña no se guarda', async () => {
    api.createMember.mockResolvedValue({
      member: member({ id: 'm2', full_name: 'Diego Ríos', email: 'diego@pyme.cl' }),
      temporary_password: 'Temporal#12345678',
      secret_stored: true,
    });
    await renderPanel();

    await userEvent.type(screen.getByPlaceholderText('Nombre completo'), 'Diego Ríos');
    await userEvent.type(screen.getByPlaceholderText('Correo electrónico'), 'diego@pyme.cl');
    await userEvent.click(screen.getByText('Crear cuenta'));

    const dialog = await screen.findByRole('dialog', { name: 'Trabajador dado de alta' });
    expect(within(dialog).getByLabelText('Contraseña temporal')).toHaveValue('Temporal#12345678');
    expect(dialog.textContent).not.toMatch(/no se guarda en ningún lado/i);
    expect(dialog.textContent).toMatch(/guardada cifrada/);
  });
});
