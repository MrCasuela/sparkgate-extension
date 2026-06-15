import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { GeneratorScreen } from './GeneratorScreen';
import { DetectorScreen } from './DetectorScreen';

type Tab = 'generator' | 'detector';

interface NavigatorProps {
  onLogout: () => Promise<void>;
}

export function Navigator({ onLogout }: NavigatorProps) {
  const { dark, toggleDark } = useTheme();
  const [tab, setTab] = useState<Tab>('generator');

  return (
    <div className="flex h-full w-full flex-col bg-bg text-text dark:bg-darkBg dark:text-darkText">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h1 className="text-lg font-bold text-primary dark:text-white">SparkGate</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDark}
            className="rounded-lg p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Cambiar modo oscuro"
          >
            {dark ? 'Claro' : 'Oscuro'}
          </button>
          <button
            onClick={onLogout}
            className="rounded-lg px-3 py-1.5 text-sm text-alert hover:bg-alert/10"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-4 mt-3 flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        <button
          onClick={() => setTab('generator')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === 'generator'
              ? 'bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Generar
        </button>
        <button
          onClick={() => setTab('detector')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === 'detector'
              ? 'bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Detectar
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tab === 'generator' ? <GeneratorScreen /> : <DetectorScreen />}
      </div>
    </div>
  );
}
