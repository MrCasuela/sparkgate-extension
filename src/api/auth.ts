import { post } from './client';
import type { LoginResponse, RegisterResponse } from '../types/auth';

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return post<LoginResponse>('/api/v1/auth/login', { email, password });
}

export async function register(
  email: string,
  password: string,
): Promise<RegisterResponse> {
  return post<RegisterResponse>('/api/v1/auth/register', { email, password });
}

export async function logout(): Promise<void> {
  await post<{ message: string }>('/api/v1/auth/logout');
}
