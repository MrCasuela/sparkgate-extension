import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SecretRevealModal } from './SecretRevealModal';
import type { CredentialSecret } from '../types/dashboard';

function secret(overrides: Partial<CredentialSecret> = {}): CredentialSecret {
  return {
    id: 'c1',
    service_name: 'Google Workspace',
    type: 'externa',
    username: 'ws@pyme.cl',
    password: 'Clave-Real#1',
    notes: null,
    secret_updated_at: null,
    ...overrides,
  };
}

describe('SecretRevealModal — R-HU21-5 (suplantación)', () => {
  it('en una cuenta interna avisa que la empresa puede iniciar sesión como el trabajador', () => {
    render(<SecretRevealModal secret={secret({ type: 'interna' })} holderName="Ana Pérez" onClose={() => {}} />);
    const warning = screen.getByRole('alert');
    expect(warning).toHaveTextContent(/puede\s+iniciar sesión como Ana Pérez/);
    expect(warning).toHaveTextContent(/a nombre\s+suyo, no de la empresa/);
  });

  it('en una cuenta externa no hay aviso de suplantación: solo que la consulta se registró', () => {
    render(<SecretRevealModal secret={secret()} holderName="Bruno Vega" onClose={() => {}} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/Esta consulta quedó registrada/)).toBeInTheDocument();
  });

  it('muestra la contraseña y, si nadie la tiene, lo dice', () => {
    render(<SecretRevealModal secret={secret()} holderName={null} onClose={() => {}} />);
    expect(screen.getByLabelText('Contraseña')).toHaveValue('Clave-Real#1');
    expect(screen.getByText(/Sin asignar/)).toBeInTheDocument();
  });
});
