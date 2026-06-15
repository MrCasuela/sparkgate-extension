import { getJwt, clearAuth } from '../utils/storage';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const jwt = await getJwt();
  const headers: Record<string, string> = {};

  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`;
  }

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      await clearAuth();
    }
    let detail = 'Error desconocido';
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore parse error
    }
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<T>;
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function post<T>(
  path: string,
  body?: unknown,
  isForm = false,
): Promise<T> {
  const options: RequestInit = { method: 'POST' };

  if (isForm) {
    const formData = body as Record<string, string>;
    options.body = new URLSearchParams(formData).toString();
    options.headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  } else if (body !== undefined) {
    options.body = JSON.stringify(body);
    options.headers = {
      'Content-Type': 'application/json',
    };
  }

  return request<T>(path, options);
}

export { BASE_URL };
