import { del, post } from './client';
import type { AccountType, LoginResponse, RegisterResponse } from '../types/auth';

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return post<LoginResponse>('/api/v1/auth/login', { email, password });
}

export async function register(
  email: string,
  password: string,
  typeAccount: AccountType = 'personal',
  organizationName?: string,
): Promise<RegisterResponse> {
  return post<RegisterResponse>('/api/v1/auth/register', {
    email,
    password,
    type_account: typeAccount,
    ...(organizationName ? { organization_name: organizationName } : {}),
  });
}

export async function logout(): Promise<void> {
  await post<{ message: string }>('/api/v1/auth/logout');
}

export async function deleteAccount(confirmEmail: string, password: string): Promise<void> {
  await del<void>('/api/v1/auth/account', { confirm_email: confirmEmail, password });
}
