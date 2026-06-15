import { useState } from 'react';
import { usePassword } from '../hooks/usePassword';
import { ErrorAlert } from './ErrorAlert';
import { PasswordDisplay } from './PasswordDisplay';
import { EntropyGauge } from './EntropyGauge';
import { LoadingSpinner } from './LoadingSpinner';

export function AlphanumericTab() {
  const { doGenerate, generating, generateResult, error, reset } = usePassword();
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useDigits, setUseDigits] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);

  const handleGenerate = () => {
    reset();
    doGenerate({
      length,
      mode: 'random',
      use_lower: useLower,
      use_upper: useUpper,
      use_digits: useDigits,
      use_symbols: useSymbols,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Slider */}
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

      {/* Toggles */}
      <div className="flex flex-wrap gap-2">
        <Toggle label="Mayúsculas" checked={useUpper} onChange={setUseUpper} />
        <Toggle label="Minúsculas" checked={useLower} onChange={setUseLower} />
        <Toggle label="Dígitos" checked={useDigits} onChange={setUseDigits} />
        <Toggle label="Símbolos" checked={useSymbols} onChange={setUseSymbols} />
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {generating ? <LoadingSpinner small /> : 'Generar'}
      </button>

      {/* Error */}
      {error && <ErrorAlert message={error} onDismiss={reset} />}

      {/* Result */}
      {generateResult && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
          <PasswordDisplay
            password={generateResult.generated_password}
            entropyBits={generateResult.entropy_bits}
          />
          <EntropyGauge bits={generateResult.entropy_bits} />
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs dark:bg-gray-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary"
      />
      {label}
    </label>
  );
}
