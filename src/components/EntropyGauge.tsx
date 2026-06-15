interface EntropyGaugeProps {
  bits: number;
  threshold?: number;
}

export function EntropyGauge({ bits, threshold = 60 }: EntropyGaugeProps) {
  const pct = Math.min((bits / threshold) * 100, 100);
  const safe = bits >= threshold;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">
          Entropía: <strong>{bits.toFixed(1)} bits</strong>
        </span>
        <span className={safe ? 'font-semibold text-positive' : 'font-semibold text-alert'}>
          {safe ? 'Segura' : 'Débil'}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={`h-full rounded-full transition-all ${
            safe ? 'bg-positive' : 'bg-alert'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-400">
        Umbral: {threshold} bits
      </p>
    </div>
  );
}
