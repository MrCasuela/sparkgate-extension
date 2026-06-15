import { post } from './client';
import type {
  PasswordEvaluateRequest,
  PasswordEvaluateResponse,
  PasswordGenerateRequest,
  PasswordGenerateResponse,
} from '../types/passwords';

export async function evaluate(
  data: PasswordEvaluateRequest,
): Promise<PasswordEvaluateResponse> {
  return post<PasswordEvaluateResponse>('/api/v1/passwords/evaluate', data);
}

export async function generate(
  data: PasswordGenerateRequest,
): Promise<PasswordGenerateResponse> {
  return post<PasswordGenerateResponse>('/api/v1/passwords/generate', data);
}
