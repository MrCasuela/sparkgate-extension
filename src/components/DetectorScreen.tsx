import { useState } from 'react';
import { usePassword } from '../hooks/usePassword';
import { EntropyGauge } from './EntropyGauge';
import { SuggestionList } from './SuggestionList';
import { ErrorAlert } from './ErrorAlert';
import { LoadingSpinner } from './LoadingSpinner';

export function DetectorScreen() {
  const { doEvaluate, evaluating, evaluateResult, error, reset } = usePassword();
  const [input, setInput] = useState('');

  const handleEvaluate = () => {
    if (!input.trim()) return;
    reset();
    doEvaluate({ password: input });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Ingresa una contraseña existente para evaluar su seguridad.
      </p>

      {/* Input + button */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pega tu contraseña aquí"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-darkText"
        />
        <button
          onClick={handleEvaluate}
          disabled={evaluating || !input.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {evaluating ? <LoadingSpinner small /> : 'Evaluar'}
        </button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={reset} />}

      {/* Results */}
      {evaluateResult && (
        <div className="flex flex-col gap-3">
          {/* Card 1: Entropy */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
            <h3 className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              Entropía
            </h3>
            <EntropyGauge bits={evaluateResult.entropy_bits} />
          </div>

          {/* Card 2: AI Analysis */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
            <h3 className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              Análisis IA
            </h3>
            <div className="flex flex-col gap-2">
              {/* Score bar */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Score:</span>
                <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-full rounded-full transition-all ${
                      evaluateResult.ai_score >= 60 ? 'bg-positive' : 'bg-alert'
                    }`}
                    style={{ width: `${evaluateResult.ai_score}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-text dark:text-darkText">
                  {evaluateResult.ai_score}/100
                </span>
              </div>

              {/* Feedback */}
              {evaluateResult.ai_feedback && (
                <p className="text-xs leading-relaxed text-text dark:text-darkText">
                  {evaluateResult.ai_feedback}
                </p>
              )}

              {/* Suggestions */}
              <SuggestionList suggestions={evaluateResult.ai_suggestions} />
            </div>
          </div>

          {/* Card 3: HIBP */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
            <h3 className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              Filtraciones conocidas
            </h3>
            {evaluateResult.is_compromised ? (
              <div className="flex items-center gap-2 text-alert">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-alert text-[10px] font-bold text-white">!</span>
              <span className="text-xs font-medium">
                Apareció en {evaluateResult.pwned_count} filtraciones
              </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-positive">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-positive text-[10px] font-bold text-white">✓</span>
              <span className="text-xs font-medium">No comprometida</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
