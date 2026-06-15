import { useState } from 'react';
import { usePassword } from '../hooks/usePassword';
import { ErrorAlert } from './ErrorAlert';
import { PasswordDisplay } from './PasswordDisplay';
import { EntropyGauge } from './EntropyGauge';
import { LoadingSpinner } from './LoadingSpinner';

type Style = 'compound' | 'passphrase' | 'pattern';

const STYLE_LABELS: Record<Style, string> = {
  compound: 'Compuesta',
  passphrase: 'Frase',
  pattern: 'Patrón',
};

const THEMES = [
  { value: '', label: 'Ninguno' },
  { value: 'naturaleza', label: 'Naturaleza' },
  { value: 'animales', label: 'Animales' },
  { value: 'comida', label: 'Comida' },
  { value: 'colores', label: 'Colores' },
  { value: 'deportes', label: 'Deportes' },
  { value: 'tecnologia', label: 'Tecnología' },
  { value: 'musica', label: 'Música' },
  { value: 'viajes', label: 'Viajes' },
];

export function MemorableTab() {
  const { doGenerate, generating, generateResult, error, reset } = usePassword();
  const [length, setLength] = useState(24);
  const [style, setStyle] = useState<Style>('compound');
  const [wordCount, setWordCount] = useState(3);
  const [theme, setTheme] = useState('');
  const [personalWords, setPersonalWords] = useState('');

  const handleGenerate = () => {
    reset();
    const words = personalWords
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);
    doGenerate({
      length,
      mode: 'ai',
      style,
      word_count: wordCount,
      theme: theme || undefined,
      personal_words: words.length > 0 ? words : undefined,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Length slider */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Longitud: <span className="text-text dark:text-darkText">{length}</span>
        </label>
        <input
          type="range"
          min={12}
          max={64}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>12</span>
          <span>64</span>
        </div>
      </div>

      {/* Style selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Estilo</label>
        <div className="flex gap-1.5">
          {(Object.entries(STYLE_LABELS) as [Style, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStyle(key)}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                style === key
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Word count */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Cantidad de palabras: <span className="text-text dark:text-darkText">{wordCount}</span>
        </label>
        <input
          type="range"
          min={2}
          max={6}
          value={wordCount}
          onChange={(e) => setWordCount(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>2</span>
          <span>6</span>
        </div>
      </div>

      {/* Theme selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Temática</label>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-text outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-darkText"
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Personal words */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Palabras personalizadas
        </label>
        <input
          type="text"
          placeholder="ej: toby, luna, casa"
          value={personalWords}
          onChange={(e) => setPersonalWords(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-text outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-darkText"
        />
        <span className="text-[10px] text-gray-400">Separadas por coma</span>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {generating ? <LoadingSpinner small /> : 'Generar frase memorable'}
      </button>

      {error && <ErrorAlert message={error} onDismiss={reset} />}

      {generateResult && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
          <PasswordDisplay
            password={generateResult.generated_password}
            entropyBits={generateResult.entropy_bits}
          />
          <EntropyGauge bits={generateResult.entropy_bits} />

          {generateResult.explanation && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <p className="font-medium text-text dark:text-darkText">Explicación:</p>
              <p>{generateResult.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
