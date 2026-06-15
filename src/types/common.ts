export interface ErrorResponse {
  detail: string;
}

export interface HealthResponse {
  status: string;
  ollama: boolean;
  supabase: boolean;
}
