import type { AccountType } from '../utils/jwt';

export type { AccountType };

export interface LoginResponse {
  access_token: string;
  user_id: string;
  premium?: boolean;
  /** Respaldo no-JWT para el gateo del panel (HU21 AC4). */
  type_account?: AccountType;
}

export interface RegisterResponse {
  message: string;
  user_id: string;
  plan: string;
  access_token?: string | null;
  type_account?: AccountType;
}

export interface DeleteAccountRequest {
  confirm_email: string;
  password: string;
}
