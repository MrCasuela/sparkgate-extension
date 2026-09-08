import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PasswordDisplay } from './PasswordDisplay';

describe('PasswordDisplay — HU08 copiar contraseña con un clic', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders the generated password in a read-only field', () => {
    render(<PasswordDisplay password="Casa#Azul72" />);
    const input = screen.getByDisplayValue('Casa#Azul72') as HTMLInputElement;
    expect(input).toHaveAttribute('readonly');
  });

  it('copies the password to the clipboard on button click', async () => {
    render(<PasswordDisplay password="Casa#Azul72" />);
    fireEvent.click(screen.getByRole('button', { name: /copiar/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Casa#Azul72');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copiado/i })).toBeInTheDocument();
    });
  });

  it('reverts the button label after the confirmation window', async () => {
    vi.useFakeTimers();
    render(<PasswordDisplay password="Casa#Azul72" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copiar/i }));
    });

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: /copiado/i })).toBeInTheDocument();
    });

    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByRole('button', { name: /^copiar$/i })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows entropy bits when provided', () => {
    render(<PasswordDisplay password="Casa#Azul72" entropyBits={65.3} />);
    expect(screen.getByText(/65\.3 bits/)).toBeInTheDocument();
  });

  it('does not crash if the clipboard API is unavailable', () => {
    Object.assign(navigator, { clipboard: undefined });
    render(<PasswordDisplay password="Casa#Azul72" />);
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: /copiar/i }));
    }).not.toThrow();
  });
});
