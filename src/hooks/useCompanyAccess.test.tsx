import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCompanyCredentials } from './useCompanyAccess';
import * as meApi from '../api/me';
import { ApiError } from '../api/client';

vi.mock('../api/me');
vi.mock('../api/vault');
const api = vi.mocked(meApi);

beforeEach(() => vi.resetAllMocks());

describe('useCompanyCredentials.reveal — el segundo factor del trabajador (HU18)', () => {
  it('manda el código junto al id de la credencial', async () => {
    const secret = { id: 'c1', service_name: 'G', type: 'externa' as const, username: null, password: 'x', notes: null, secret_updated_at: null };
    api.revealAssignedCredential.mockResolvedValue(secret);
    const { result } = renderHook(() => useCompanyCredentials());

    await expect(result.current.reveal('c1', '123456')).resolves.toEqual(secret);

    expect(api.revealAssignedCredential).toHaveBeenCalledWith('c1', '123456');
  });

  it('NO atrapa el error: lo recibe el modal que pidió el código, con su `code` intacto', async () => {
    const rechazo = new ApiError(403, 'El código de verificación no es válido o ya expiró.', 'totp_invalido');
    api.revealAssignedCredential.mockRejectedValue(rechazo);
    const { result } = renderHook(() => useCompanyCredentials());

    await expect(result.current.reveal('c1', '000000')).rejects.toBe(rechazo);
    // Y tampoco lo deja en un banner de la pestaña, donde se perdería de vista.
    expect(result.current.error).toBeNull();
  });
});
