import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Navigator } from './Navigator';

const ADMIN_BUTTON = 'Panel de administración';

/**
 * HU21 AC4. Antes el botón se renderizaba sin ningún guard: un empleado veía la
 * puerta y el backend le contestaba 403. Navigator recibe todo por props, así
 * que alcanza con renderizarlo — no hace falta mockear hooks.
 */
describe('Navigator — el panel solo se ofrece a cuentas de empresa', () => {
  it('no muestra la puerta al panel en una cuenta personal', () => {
    render(<Navigator onLogout={async () => {}} isEnterprise={false} />);
    expect(screen.queryByText(ADMIN_BUTTON)).toBeNull();
  });

  it('la muestra en una cuenta de empresa', () => {
    render(<Navigator onLogout={async () => {}} isEnterprise />);
    expect(screen.getByText(ADMIN_BUTTON)).toBeInTheDocument();
  });

  it('las tres pestañas siguen disponibles en ambos casos', () => {
    // El gateo es de la puerta al panel, no de las funciones del popup: una
    // cuenta de empresa también genera y evalúa contraseñas.
    // getAllByText porque "Generar" también es el botón del generador.
    const { unmount } = render(<Navigator onLogout={async () => {}} isEnterprise={false} />);
    expect(screen.getAllByText('Generar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Detectar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bóveda').length).toBeGreaterThan(0);
    unmount();

    render(<Navigator onLogout={async () => {}} isEnterprise />);
    expect(screen.getAllByText('Generar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bóveda').length).toBeGreaterThan(0);
  });
});
