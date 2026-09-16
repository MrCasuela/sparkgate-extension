export interface LoginResponse {
  access_token: string;
  user_id: string;
  premium?: boolean;
}

export interface RegisterResponse {
  message: string;
  user_id: string;
  plan: string;
  access_token?: string | null;
}

export interface DeleteAccountRequest {
  confirm_email: string;
  password: string;
}
