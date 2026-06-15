import { useState, useCallback } from 'react';
import * as passwordsApi from '../api/passwords';
import type {
  PasswordGenerateRequest,
  PasswordGenerateResponse,
  PasswordEvaluateRequest,
  PasswordEvaluateResponse,
} from '../types/passwords';

export function usePassword() {
  const [generating, setGenerating] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [generateResult, setGenerateResult] = useState<PasswordGenerateResponse | null>(null);
  const [evaluateResult, setEvaluateResult] = useState<PasswordEvaluateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doGenerate = useCallback(async (params: PasswordGenerateRequest) => {
    setGenerating(true);
    setError(null);
    setGenerateResult(null);
    try {
      const res = await passwordsApi.generate(params);
      setGenerateResult(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al generar';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }, []);

  const doEvaluate = useCallback(async (params: PasswordEvaluateRequest) => {
    setEvaluating(true);
    setError(null);
    setEvaluateResult(null);
    try {
      const res = await passwordsApi.evaluate(params);
      setEvaluateResult(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al evaluar';
      setError(msg);
    } finally {
      setEvaluating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setGenerateResult(null);
    setEvaluateResult(null);
    setError(null);
  }, []);

  return {
    generating,
    evaluating,
    generateResult,
    evaluateResult,
    error,
    doGenerate,
    doEvaluate,
    reset,
  };
}
