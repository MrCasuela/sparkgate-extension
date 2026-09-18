import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from './App';
import { setJwt, setUserId, setTypeAccount, clearAuth } from '../utils/storage';

const FUTURE_EXP = 4_000_000_000;

function makeJwt(exp: number, metadata?: Record<string, unknown>): string {
  const enc = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payload: Record<string, unknown> = { sub: 'u1', exp };
  if (metadata) payload.user_metadata = metadata;
  return `${enc({ alg: 'HS256' })}.${enc(payload)}.sig`;
}

describe('App — HU15 interfaz simple y clara pa usuario no técnico', () => {
  beforeEach(async () => {
    await clearAuth();
  });

  it('renders without crashing and lands on a single, unambiguous screen', async () => {
    render(<App />);

    // No token en storage (mock vacío) → debe resolver a la pantalla de auth,
    // no quedarse colgado en loading ni mostrar dos pantallas a la vez.
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Correo electrónico')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Contraseña')).toBeInTheDocument();
  });

  it('exposes a single primary action, not a cluttered form', async () => {
    render(<App />);
    await waitFor(() => screen.getByPlaceholderText('Correo electrónico'));

    // Interfaz simple = un solo submit visible en el tab inicial, no un
    // dashboard con múltiples acciones compitiendo por atención.
    const buttons = screen.getAllByRole('button');
    const submitLike = buttons.filter((b) => b.getAttribute('type') === 'submit');
    expect(submitLike.length).toBe(1);
  });

  it('shows AuthScreen when stored JWT is expired, not the panel', async () => {
    await setJwt(makeJwt(1_600_000_000)); // exp pasado
    await setUserId('u1');

    render(<App />);

    // Token vencido ≠ logged-in: el popup debe volver al login y limpiar storage.
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Correo electrónico')).toBeInTheDocument();
    });
  });
});


/**
 * HU21 AC4 de punta a punta: el prop isEnterprise recorre useAuth → App →
 * Navigator por la raíz real, sin mockear el hook.
 */
describe('App — la puerta al panel depende del tipo de cuenta (HU21 AC4)', () => {
  beforeEach(async () => {
    await clearAuth();
  });

  it('muestra el panel con un JWT de cuenta empresa', async () => {
    await setJwt(makeJwt(FUTURE_EXP, { type_account: 'enterprise' }));
    await setUserId('u1');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Panel de administración')).toBeInTheDocument();
    });
  });

  it('no lo muestra con un JWT de cuenta personal', async () => {
    await setJwt(makeJwt(FUTURE_EXP, { type_account: 'personal' }));
    await setUserId('u1');

    render(<App />);

    // Esperamos a que el popup esté cargado antes de afirmar la ausencia, si no
    // el test pasaría simplemente porque todavía no renderizó nada.
    await waitFor(() => expect(screen.getAllByText('Generar').length).toBeGreaterThan(0));
    expect(screen.queryByText('Panel de administración')).toBeNull();
  });

  it('cae al valor guardado cuando el token no trae el claim', async () => {
    // Es el caso de un GoTrue que no incluya user_metadata en el access token.
    await setJwt(makeJwt(FUTURE_EXP));
    await setUserId('u1');
    await setTypeAccount('enterprise');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Panel de administración')).toBeInTheDocument();
    });
  });
});
