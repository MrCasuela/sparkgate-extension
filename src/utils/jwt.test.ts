import { describe, it, expect } from 'vitest';
import { getJwtExpiry, isJwtExpired, getJwtAccountType } from './jwt';

function makeJwt(payload: Record<string, unknown>, header = { alg: 'HS256', typ: 'JWT' }): string {
  const enc = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${enc(header)}.${enc(payload)}.signature`;
}

describe('jwt — decode de expiración sin verificar firma', () => {
  it('devuelve el timestamp exp del payload', () => {
    expect(getJwtExpiry(makeJwt({ sub: 'u1', exp: 2_000_000_000 }))).toBe(2_000_000_000);
  });

  it('devuelve null si falta exp', () => {
    expect(getJwtExpiry(makeJwt({ sub: 'u1' }))).toBeNull();
  });

  it('devuelve null si el token está malformado', () => {
    expect(getJwtExpiry('not-a-jwt')).toBeNull();
    expect(getJwtExpiry('a..b')).toBeNull();
  });

  it('isJwtExpired: pasado → true, futuro → false', () => {
    const now = 1_700_000_000_000;
    expect(isJwtExpired(makeJwt({ exp: 1_600_000_000 }), now)).toBe(true);
    expect(isJwtExpired(makeJwt({ exp: 1_800_000_000 }), now)).toBe(false);
    expect(isJwtExpired(makeJwt({}), now)).toBe(false);
  });
});

describe('getJwtAccountType — gateo del panel (HU21 AC4)', () => {
  it('lee enterprise y personal del claim user_metadata', () => {
    expect(getJwtAccountType(makeJwt({ user_metadata: { type_account: 'enterprise' } })))
      .toBe('enterprise');
    expect(getJwtAccountType(makeJwt({ user_metadata: { type_account: 'personal' } })))
      .toBe('personal');
  });

  it('devuelve null si el token no trae el claim, para que el llamador use el respaldo', () => {
    expect(getJwtAccountType(makeJwt({ sub: 'u1' }))).toBeNull();
    expect(getJwtAccountType(makeJwt({ user_metadata: {} }))).toBeNull();
  });

  it('descarta un valor desconocido en vez de propagarlo', () => {
    expect(getJwtAccountType(makeJwt({ user_metadata: { type_account: 'superadmin' } })))
      .toBeNull();
  });

  it('devuelve null con un token malformado', () => {
    expect(getJwtAccountType('not-a-jwt')).toBeNull();
  });
});
