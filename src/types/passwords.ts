export interface PasswordEvaluateRequest {
  password: string;
  context?: string;
}

export interface PasswordEvaluateResponse {
  is_compromised: boolean;
  pwned_count: number;
  entropy_bits: number;
  entropy_threshold_met: boolean;
  ai_score: number;
  ai_feedback: string;
  ai_suggestions: string[];
}

export interface PasswordGenerateRequest {
  length: number;
  mode: 'ai' | 'random';
  context?: string;
  complexity_level?: string;
  use_lower?: boolean;
  use_upper?: boolean;
  use_digits?: boolean;
  use_symbols?: boolean;
  style?: 'compound' | 'passphrase' | 'pattern';
  word_count?: number;
  theme?: string;
  personal_words?: string[];
}

export interface PasswordGenerateResponse {
  generated_password: string;
  explanation: string;
  entropy_bits: number;
}
