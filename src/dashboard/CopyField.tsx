import { useState } from 'react';

interface CopyFieldProps {
  value: string;
  label?: string;
}

/** Contraseña de solo lectura con botón de copiar. Guarda su propio estado de "copiado". */
export function CopyField({ value, label = 'Contraseña' }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // portapapeles no disponible: la contraseña sigue visible para copiarla a mano
    }
  };

  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={value}
          aria-label={label}
          className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800"
        />
        <button
          onClick={copy}
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          {copied ? 'Copiado ✓' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}
