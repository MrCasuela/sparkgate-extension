import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CredentialRow } from './CredentialRow';
import { credential } from '../test/fixtures';
import type { Credential } from '../types/dashboard';

function renderRow(c: Credential, isOwnAccount = false) {
  const handlers = {
    onReveal: vi.fn(),
    onSaveSecret: vi.fn(),
    onReassign: vi.fn(),
    onRevoke: vi.fn(),
    onSuggest: vi.fn(),
    onRestore: vi.fn(),
  };
  render(<CredentialRow credential={c} isOwnAccount={isOwnAccount} {...handlers} />);
  return handlers;
}

describe('CredentialRow', () => {
  it('una externa con contraseña se puede ver, cambiar y reasignar', () => {
    renderRow(credential());
    expect(screen.getByText('Ver contraseña')).toBeInTheDocument();
    expect(screen.getByText('Cambiar contraseña')).toBeInTheDocument();
    expect(screen.getByText('Reasignar')).toBeInTheDocument();
  });

  it('sin contraseña guardada no hay «Ver», hay «Guardar», y se avisa', () => {
    renderRow(credential({ has_secret: false, secret_updated_at: null }));
    expect(screen.queryByText('Ver contraseña')).toBeNull();
    expect(screen.getByText('Guardar contraseña')).toBeInTheDocument();
    expect(screen.getByText('Sin contraseña guardada')).toBeInTheDocument();
  });

  it('una interna no se reasigna: pasársela al reemplazo sería darle la identidad del anterior', () => {
    renderRow(credential({ type: 'interna', supabase_user_id: 'u1' }));
    expect(screen.queryByText('Reasignar')).toBeNull();
    expect(screen.getByText('Revocar acceso ahora')).toBeInTheDocument();
  });

  it('la cuenta propia del administrador no se puede revocar', () => {
    renderRow(credential({ type: 'interna', supabase_user_id: 'admin-1' }), true);
    expect(screen.queryByText('Revocar acceso ahora')).toBeNull();
    expect(screen.getByText(/no revocable desde acá/)).toBeInTheDocument();
  });

  it('muestra «Rotar pendiente» solo cuando el backend lo pide', () => {
    const { unmount } = render(
      <CredentialRow
        credential={credential({ rotation_required: true })}
        isOwnAccount={false}
        onReveal={vi.fn()}
        onSaveSecret={vi.fn()}
        onReassign={vi.fn()}
        onRevoke={vi.fn()}
        onSuggest={vi.fn()}
        onRestore={vi.fn()}
      />,
    );
    expect(screen.getByText('Rotar pendiente')).toBeInTheDocument();
    unmount();
    renderRow(credential());
    expect(screen.queryByText('Rotar pendiente')).toBeNull();
  });

  it('una credencial del pool no ofrece «Generar sugerencia»: no hay a quién sugerírsela', () => {
    renderRow(credential({ member_id: null }));
    expect(screen.queryByText(/Generar sugerencia/)).toBeNull();
    expect(screen.getByText('Reasignar')).toBeInTheDocument();
  });

  it('una externa pendiente ofrece «Confirmar contraseña», no «Restaurar acceso»', () => {
    // Tras «Generar sugerencia» la cuenta espera que el admin aplique la contraseña a mano
    // en el servicio: lo que se hace después es confirmarla, no restaurar un acceso.
    renderRow(credential({ status: 'pendiente_aplicacion_manual' }));
    expect(screen.getByText('Confirmar contraseña')).toBeInTheDocument();
    expect(screen.queryByText('Restaurar acceso')).toBeNull();
    expect(screen.queryByText('Cambiar contraseña')).toBeNull();
  });

  it('una interna revocada sigue ofreciendo «Restaurar acceso» (desbanear)', () => {
    renderRow(credential({ type: 'interna', supabase_user_id: 'u1', status: 'revocada' }));
    expect(screen.getByText('Restaurar acceso')).toBeInTheDocument();
    expect(screen.queryByText('Confirmar contraseña')).toBeNull();
  });

  it('el botón dispara onRestore con la credencial', async () => {
    const c = credential({ status: 'pendiente_aplicacion_manual' });
    const handlers = renderRow(c);
    screen.getByText('Confirmar contraseña').click();
    expect(handlers.onRestore).toHaveBeenCalledWith(c);
  });
});
