import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardApp } from './DashboardApp';
import * as dashboardApi from '../api/dashboard';
import * as passwordsApi from '../api/passwords';
import * as mfaApi from '../api/mfa';
import { setJwt, setUserId, clearAuth } from '../utils/storage';
import { credential, member, makeJwt } from '../test/fixtures';
import type { AuditLogEntry, CredentialActionResponse } from '../types/dashboard';
import { ApiError } from '../api/client';

vi.mock('../api/dashboard');
vi.mock('../api/passwords');
vi.mock('../api/mfa');

const api = vi.mocked(dashboardApi);
const passwords = vi.mocked(passwordsApi);
const mfa = vi.mocked(mfaApi);

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

/** El código del segundo factor (HU18): lo piden las seis operaciones sobre un secreto ajeno. */
async function typeCode(code = '123456') {
  await userEvent.type(screen.getByLabelText(/código de tu app/i), code);
}

const NO_ENROLADO = 'Esta operación requiere un segundo factor y tu cuenta no tiene uno configurado.';
const INVALIDO = 'El código de verificación no es válido o ya expiró.';

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
    await typeCode();
    await userEvent.click(screen.getByText('Confirmar'));

    // Sin contraseña propia: el backend la genera. Ni una llamada a /passwords/generate.
    await waitFor(() => expect(api.revokeInternal).toHaveBeenCalledWith('int-1', undefined, '123456'));
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
    await typeCode();
    await userEvent.click(screen.getByText('Confirmar'));

    await waitFor(() => expect(api.suggestExternal).toHaveBeenCalledWith('ext-1', 'Mi-Propia-Clave-1!', '123456'));
  });

  it('si el backend no pudo guardarla, la respuesta se presenta como la única copia', async () => {
    api.revokeInternal.mockResolvedValue(actionResponse({ applied_password: 'Sola#Copia#12345', secret_stored: false }));
    await renderPanel();

    await userEvent.click(screen.getByText('Revocar acceso ahora'));
    await typeCode();
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
    await typeCode();
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
    await typeCode();
    await userEvent.click(screen.getByText('Continuar'));

    const dialog = await screen.findByRole('dialog', { name: 'SparkGate' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/iniciar sesión como Bruno Vega/);
    expect(within(dialog).getByLabelText('Contraseña')).toHaveValue('Vigente#De#La#Cuenta1');
  });

  it('tras la sugerencia, la externa pendiente se confirma con «Confirmar contraseña»', async () => {
    const pending = { ...EXTERNAL, status: 'pendiente_aplicacion_manual' as const };
    api.getMembers.mockResolvedValue([member({ credentials: [INTERNAL, pending] })]);
    api.restoreCredential.mockResolvedValue(actionResponse({ credential: { ...EXTERNAL, status: 'activa' } }));
    await renderPanel();

    expect(screen.queryByText('Restaurar acceso')).toBeNull();
    await userEvent.click(screen.getByText('Confirmar contraseña'));

    const confirm = await screen.findByRole('dialog', { name: 'Confirmar contraseña' });
    expect(confirm.textContent).toMatch(/ya aplicaste la contraseña sugerida en Google Workspace/);
    await userEvent.click(within(confirm).getByText('Ya la apliqué'));

    await waitFor(() => expect(api.restoreCredential).toHaveBeenCalledWith('ext-1'));
    expect(await screen.findByRole('dialog', { name: 'Contraseña confirmada' })).toBeInTheDocument();
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

describe('DashboardApp — el segundo factor propio (HU18)', () => {
  it('el encabezado ofrece configurar el segundo factor y abre el enrolamiento', async () => {
    mfa.getMfaStatus.mockResolvedValue({ enrolled: false, pending: false, confirmed_at: null, last_used_at: null, locked_until: null });
    await renderPanel();

    expect(screen.queryByRole('dialog', { name: 'Segundo factor de verificación' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Segundo factor' }));

    const dialog = await screen.findByRole('dialog', { name: 'Segundo factor de verificación' });
    expect(await within(dialog).findByText('Configurar segundo factor')).toBeInTheDocument();
  });

  it('se cierra con «Cerrar» y no pide nada al backend hasta que se abre', async () => {
    mfa.getMfaStatus.mockResolvedValue({ enrolled: true, pending: false, confirmed_at: '2026-09-19T12:00:00Z', last_used_at: null, locked_until: null });
    await renderPanel();
    expect(mfa.getMfaStatus).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Segundo factor' }));
    await screen.findByText('Activo');
    await userEvent.click(screen.getByText('Cerrar'));

    expect(screen.queryByRole('dialog', { name: 'Segundo factor de verificación' })).not.toBeInTheDocument();
  });
});

describe('DashboardApp — el segundo factor en las operaciones sobre secretos ajenos (HU18)', () => {
  it('revocar no se puede confirmar sin el código, y el backend no recibe nada mientras tanto', async () => {
    await renderPanel();

    await userEvent.click(screen.getByText('Revocar acceso ahora'));

    expect(screen.getByText('Confirmar')).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/código de tu app/i), '12345');
    expect(screen.getByText('Confirmar')).toBeDisabled();
    expect(api.revokeInternal).not.toHaveBeenCalled();
  });

  it('un código incorrecto en revocar muestra el motivo, deja el modal abierto y borra el código', async () => {
    api.revokeInternal.mockRejectedValue(new ApiError(403, INVALIDO, 'totp_invalido'));
    await renderPanel();

    await userEvent.click(screen.getByText('Revocar acceso ahora'));
    await typeCode('000000');
    await userEvent.click(screen.getByText('Confirmar'));

    expect(await screen.findByText(INVALIDO)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Revocar acceso' })).toBeInTheDocument();
    expect(screen.getByLabelText(/código de tu app/i)).toHaveValue('');
    expect(screen.queryByRole('dialog', { name: 'Acceso revocado' })).not.toBeInTheDocument();
    expect(screen.queryByText('Configurar segundo factor')).not.toBeInTheDocument();
  });

  it('sin segundo factor configurado, revocar lleva a configurarlo (no dice «código incorrecto»)', async () => {
    api.revokeInternal.mockRejectedValue(new ApiError(403, NO_ENROLADO, 'totp_no_enrolado'));
    mfa.getMfaStatus.mockResolvedValue({ enrolled: false, pending: false, confirmed_at: null, last_used_at: null, locked_until: null });
    await renderPanel();

    await userEvent.click(screen.getByText('Revocar acceso ahora'));
    await typeCode();
    await userEvent.click(screen.getByText('Confirmar'));
    await userEvent.click(await screen.findByText('Configurar segundo factor'));

    // El modal de la acción cede el paso al del enrolamiento.
    expect(screen.queryByRole('dialog', { name: 'Revocar acceso' })).not.toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Segundo factor de verificación' })).toBeInTheDocument();
  });

  it('sugerir también pide el código y lo manda', async () => {
    api.suggestExternal.mockResolvedValue(
      actionResponse({ credential: { ...EXTERNAL, status: 'pendiente_aplicacion_manual' }, suggested_password: 'Sugerida#Por#El#Backend1' }),
    );
    await renderPanel();

    await userEvent.click(screen.getByText(/Generar sugerencia y marcar pendiente/));
    expect(screen.getByText('Confirmar')).toBeDisabled();
    await typeCode('654321');
    await userEvent.click(screen.getByText('Confirmar'));

    await waitFor(() => expect(api.suggestExternal).toHaveBeenCalledWith('ext-1', undefined, '654321'));
  });

  it('guardar una contraseña pide el código: guardarla ES rotarla', async () => {
    api.saveCredentialSecret.mockResolvedValue({ credential: EXTERNAL, admin_api_success: true, secret_stored: true });
    await renderPanel();

    await userEvent.click(screen.getAllByText(/Cambiar contraseña|Guardar contraseña/)[0]);
    const dialog = screen.getByRole('dialog', { name: /contraseña/i });
    await userEvent.type(within(dialog).getByLabelText('Contraseña'), 'Nueva#Clave#Larga1');
    expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeDisabled();
    await typeCode();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(api.saveCredentialSecret).toHaveBeenCalledWith('int-1', expect.objectContaining({ password: 'Nueva#Clave#Larga1' }), '123456'),
    );
  });

  it('un código malo al guardar deja el formulario con lo escrito y muestra el motivo', async () => {
    api.saveCredentialSecret.mockRejectedValue(new ApiError(403, INVALIDO, 'totp_invalido'));
    await renderPanel();

    await userEvent.click(screen.getAllByText(/Cambiar contraseña|Guardar contraseña/)[0]);
    const dialog = screen.getByRole('dialog', { name: /contraseña/i });
    await userEvent.type(within(dialog).getByLabelText('Contraseña'), 'Nueva#Clave#Larga1');
    await typeCode('000000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(INVALIDO)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Contraseña')).toHaveValue('Nueva#Clave#Larga1');
    expect(screen.getByLabelText(/código de tu app/i)).toHaveValue('');
  });

  it('ver la contraseña de una credencial: el botón abre el modal del código y NO llama al backend', async () => {
    await renderPanel();

    await userEvent.click(screen.getAllByText('Ver contraseña')[1]);

    expect(screen.getByRole('dialog', { name: 'Ver contraseña' })).toBeInTheDocument();
    expect(api.revealCredentialSecret).not.toHaveBeenCalled();
  });

  it('ver la contraseña manda el código, y un código rechazado no muestra nada del secreto', async () => {
    api.revealCredentialSecret.mockRejectedValue(new ApiError(403, INVALIDO, 'totp_invalido'));
    await renderPanel();

    await userEvent.click(screen.getAllByText('Ver contraseña')[1]);
    await typeCode('000000');
    await userEvent.click(screen.getByText('Continuar'));

    await waitFor(() => expect(api.revealCredentialSecret).toHaveBeenCalledWith('ext-1', '000000'));
    expect(await screen.findByText(INVALIDO)).toBeInTheDocument();
    // Ni el diálogo del secreto ni su campo: solo sigue el modal del código.
    expect(screen.queryByRole('dialog', { name: 'Google Workspace' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('sin factor, ver una contraseña ofrece configurarlo y abre el enrolamiento', async () => {
    api.revealCredentialSecret.mockRejectedValue(new ApiError(403, NO_ENROLADO, 'totp_no_enrolado'));
    mfa.getMfaStatus.mockResolvedValue({ enrolled: false, pending: false, confirmed_at: null, last_used_at: null, locked_until: null });
    await renderPanel();

    await userEvent.click(screen.getAllByText('Ver contraseña')[1]);
    await typeCode();
    await userEvent.click(screen.getByText('Continuar'));
    await userEvent.click(await screen.findByText('Configurar segundo factor'));

    expect(await screen.findByRole('dialog', { name: 'Segundo factor de verificación' })).toBeInTheDocument();
  });

  it('ver la bóveda personal de un integrante también pide el código, y avisa que es un dato personal', async () => {
    api.getMemberVault.mockResolvedValue([
      { id: 'item-1', service_name: 'Netflix', username: 'bruno@x.cl', created_at: '2026-09-18T12:00:00Z', updated_at: '2026-09-18T12:00:00Z' },
    ]);
    api.revealMemberVaultItem.mockResolvedValue({ id: 'item-1', service_name: 'Netflix', username: 'bruno@x.cl', password: 'Clave#Personal#1', notes: null });
    await renderPanel();

    await userEvent.click(screen.getByText(/Ver bóveda personal/));
    await screen.findByText('Netflix');
    const buttons = screen.getAllByText('Ver contraseña', { selector: 'button' });
    await userEvent.click(buttons[buttons.length - 1]); // el del ítem de la bóveda: va después de las filas
    // Abrir la bóveda lista metadata; descifrar un ítem es lo que pide el código.
    expect(api.revealMemberVaultItem).not.toHaveBeenCalled();
    expect(screen.getByText(/dato personal del trabajador/)).toBeInTheDocument();

    await typeCode('112233');
    await userEvent.click(screen.getByText('Continuar'));

    await waitFor(() => expect(api.revealMemberVaultItem).toHaveBeenCalledWith('member-1', 'item-1', '112233'));
    const revealed = await screen.findByRole('dialog', { name: 'Netflix' });
    expect(within(revealed).getByLabelText('Contraseña')).toHaveValue('Clave#Personal#1');
  });

  it('restaurar y reasignar NO piden el código: el backend no lo exige', async () => {
    const pending = { ...EXTERNAL, status: 'pendiente_aplicacion_manual' as const };
    api.getMembers.mockResolvedValue([member({ credentials: [INTERNAL, pending] })]);
    api.restoreCredential.mockResolvedValue(actionResponse({ credential: { ...EXTERNAL, status: 'activa' } }));
    await renderPanel();

    await userEvent.click(screen.getByText('Confirmar contraseña', { selector: 'button' }));
    await userEvent.click(screen.getByText('Ya la apliqué'));

    await waitFor(() => expect(api.restoreCredential).toHaveBeenCalledWith('ext-1'));
    expect(screen.queryByLabelText(/código de tu app/i)).not.toBeInTheDocument();
  });
});

function auditEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: crypto.randomUUID(),
    actor_email: 'admin@pyme.cl',
    actor_user_id: 'admin-1',
    member_id: 'member-1',
    target_member_id: null,
    credential_id: 'int-1',
    credential_type: 'interna',
    vault_item_id: null,
    action: 'revocar_interna',
    denied_reason: null,
    created_at: '2026-09-19T12:00:00Z',
    ...overrides,
  };
}

describe('DashboardApp — la auditoría muestra los intentos rechazados por el segundo factor (HU18 AC4)', () => {
  it('una denegación dice qué se intentó y POR QUÉ falló, en lenguaje de persona', async () => {
    api.getAuditLog.mockResolvedValue([
      auditEntry({ action: 'revocar_interna_denegado', denied_reason: 'totp_invalido' }),
      auditEntry({ action: 'consultar_secreto_denegado', denied_reason: 'totp_no_enrolado', credential_id: 'ext-1', credential_type: 'externa' }),
    ]);
    await renderPanel();

    const table = await screen.findByRole('table');
    expect(within(table).getByText(/Intento fallido de revocar un acceso — código incorrecto, ausente o vencido/)).toBeInTheDocument();
    expect(within(table).getByText(/Intento fallido de ver una contraseña — no tenía un segundo factor configurado/)).toBeInTheDocument();
  });

  it('una entrada normal no muestra ningún motivo, y nunca aparece un identificador crudo', async () => {
    api.getAuditLog.mockResolvedValue([auditEntry({ action: 'revocar_interna' })]);
    await renderPanel();

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Revocó acceso')).toBeInTheDocument();
    expect(table.textContent).not.toContain('totp_');
    expect(table.textContent).not.toContain('_denegado');
  });

  it('las tres acciones *_denegado nuevas tienen etiqueta: la tabla no muestra el identificador del backend', async () => {
    api.getAuditLog.mockResolvedValue([
      auditEntry({ action: 'revocar_interna_denegado', denied_reason: 'totp_reutilizado' }),
      auditEntry({ action: 'sugerir_externa_denegado', denied_reason: 'totp_bloqueado' }),
      auditEntry({ action: 'guardar_secreto_denegado', denied_reason: 'totp_invalido' }),
    ]);
    await renderPanel();

    const table = await screen.findByRole('table');
    expect(table.textContent).not.toMatch(/(revocar_interna|sugerir_externa|guardar_secreto)_denegado/);
  });

  it('el CSV exporta el motivo en su propia columna', async () => {
    api.getAuditLog.mockResolvedValue([
      auditEntry({ action: 'revocar_interna_denegado', denied_reason: 'totp_reutilizado' }),
      auditEntry({ action: 'revocar_interna', denied_reason: null }),
    ]);
    // jsdom no implementa createObjectURL/revokeObjectURL: se definen y se quitan al terminar.
    let captured: Blob | null = null;
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        captured = blob;
        return 'blob:audit';
      },
      revokeObjectURL: () => {},
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await renderPanel();

    await userEvent.click(await screen.findByText('Exportar CSV'));

    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(captured as unknown as Blob);
    });
    const [header, denied, normal] = text.split('\n');
    expect(header).toBe('Fecha,Actor,Integrante,Cuenta,Tipo,Acción,Motivo');
    expect(denied).toContain('el código ya se había usado');
    expect(normal.endsWith(',')).toBe(true); // sin motivo: la celda va vacía
    expect(text).not.toContain('totp_');
    delete (URL as unknown as Record<string, unknown>).createObjectURL;
    delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
  });
});

