import type { Credential, Member } from '../types/dashboard';

export function credential(overrides: Partial<Credential> = {}): Credential {
  return {
    id: 'cred-1',
    type: 'externa',
    service_name: 'Google Workspace',
    status: 'activa',
    updated_at: '2026-09-18T12:00:00Z',
    supabase_user_id: null,
    member_id: 'member-1',
    username: null,
    secret_updated_at: '2026-09-18T12:00:00Z',
    has_secret: true,
    rotation_required: false,
    ...overrides,
  };
}

export function member(overrides: Partial<Member> = {}): Member {
  return {
    id: 'member-1',
    full_name: 'Bruno Vega',
    email: 'bruno@pyme.cl',
    role_title: null,
    supabase_user_id: null,
    credentials: [],
    ...overrides,
  };
}

/** JWT sin verificar, como los que guarda la extensión: solo importa exp y user_metadata. */
export function makeJwt(metadata: Record<string, unknown> = { type_account: 'enterprise' }): string {
  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${enc({ alg: 'HS256' })}.${enc({ sub: 'admin-1', exp: 4_000_000_000, user_metadata: metadata })}.sig`;
}
