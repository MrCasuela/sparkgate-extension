import { useState } from 'react';
import { AlphanumericTab } from './AlphanumericTab';
import { MemorableTab } from './MemorableTab';

type InnerTab = 'alphanumeric' | 'memorable';

export function GeneratorScreen() {
  const [tab, setTab] = useState<InnerTab>('alphanumeric');

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tabs */}
      <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        <button
          onClick={() => setTab('alphanumeric')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            tab === 'alphanumeric'
              ? 'bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Alfanumérico
        </button>
        <button
          onClick={() => setTab('memorable')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            tab === 'memorable'
              ? 'bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Memorable
        </button>
      </div>

      {tab === 'alphanumeric' ? <AlphanumericTab /> : <MemorableTab />}
    </div>
  );
}
