import { useState } from 'react';

interface PasswordDisplayProps {
  password: string;
  entropyBits?: number;
}

export function PasswordDisplay({ password, entropyBits }: PasswordDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboad not available
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={password}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-text outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-darkText"
        />
        <button
          onClick={handleCopy}
          className="min-w-[72px] rounded-lg bg-primary px-3 py-2 text-sm text-white hover:opacity-90"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      {entropyBits !== undefined && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Entropía: H={entropyBits.toFixed(1)} bits
        </p>
      )}
    </div>
  );
}
