import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ActionResultModal, type ActionResult } from './ActionResultModal';
import { credential } from '../test/fixtures';

function result(overrides: Partial<ActionResult> = {}): ActionResult {
  return {
    kind: 'revoke',
    title: 'Bruno Vega — SparkGate',
    credential: credential({ type: 'interna' }),
    adminApiSuccess: true,
    secretStored: true,
    rotationSuggested: [],
    ...overrides,
  };
}

/**
 * Antes este modal decía «Esta contraseña no se guarda en ningún lado» mostrando una
 * contraseña que el navegador había generado y el backend nunca tuvo (B2 del SPEC).
 */
describe('ActionResultModal', () => {
  it('muestra la contraseña que se le pasa y avisa que quedó guardada', () => {
    render(<ActionResultModal result={result({ password: 'Devuelta#Por#Backend1' })} onClose={() => {}} />);
    expect(screen.getByLabelText('Contraseña')).toHaveValue('Devuelta#Por#Backend1');
    expect(screen.getByText(/Quedó guardada cifrada/)).toBeInTheDocument();
    expect(screen.queryByText(/no se guarda en ningún lado/i)).toBeNull();
  });

  it('si no quedó guardada, dice que es la única copia y lo hace como alerta', () => {
    render(<ActionResultModal result={result({ password: 'Sola-1234567!', secretStored: false })} onClose={() => {}} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/única copia/);
    expect(screen.queryByText(/Quedó guardada cifrada/)).toBeNull();
  });

  it('un revoke que Auth no confirmó no muestra ninguna contraseña', () => {
    render(<ActionResultModal result={result({ adminApiSuccess: false, secretStored: false })} onClose={() => {}} />);
    expect(screen.queryByLabelText('Contraseña')).toBeNull();
    expect(screen.getByText(/No se pudo confirmar el cambio con Supabase/)).toBeInTheDocument();
  });

  it('no promete una ventana con el token vivo: banear lo invalida en la siguiente petición', () => {
    render(<ActionResultModal result={result({ password: 'x'.repeat(16) })} onClose={() => {}} />);
    expect(document.body.textContent).not.toMatch(/~1h|sigue válido/);
  });

  it('lista las contraseñas que conviene rotar y de quién es el conocimiento', () => {
    render(
      <ActionResultModal
        result={result({
          rotationSuggested: [
            { credential_id: 'c2', service_name: 'Google Workspace', type: 'externa', member_name: 'Bruno Vega' },
          ],
        })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Conviene cambiar estas contraseñas/)).toBeInTheDocument();
    expect(screen.getByText(/Google Workspace — la conoce Bruno Vega/)).toBeInTheDocument();
  });

  it('confirmar la contraseña de una externa no habla de «acceso restaurado»', () => {
    render(
      <ActionResultModal
        result={result({ kind: 'restore', credential: credential({ type: 'externa' }), secretStored: null })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Contraseña confirmada' })).toBeInTheDocument();
    expect(screen.queryByText('Acceso restaurado')).toBeNull();
  });

  it('restaurar una interna sigue diciendo «Acceso restaurado»', () => {
    render(
      <ActionResultModal
        result={result({ kind: 'restore', credential: credential({ type: 'interna' }), secretStored: null })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Acceso restaurado' })).toBeInTheDocument();
  });

  it('reasignar al pool dice que nadie la ve, y a alguien dice quién la verá', () => {
    const { rerender } = render(
      <ActionResultModal
        result={result({ kind: 'reassign', secretStored: null, reassignedTo: null })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/pool sin asignar/)).toBeInTheDocument();
    rerender(
      <ActionResultModal
        result={result({ kind: 'reassign', secretStored: null, reassignedTo: 'Carla Soto' })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Ahora la tiene Carla Soto/)).toBeInTheDocument();
  });
});
