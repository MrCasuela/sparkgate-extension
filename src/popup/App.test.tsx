import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App — HU15 interfaz simple y clara pa usuario no técnico', () => {
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
});
