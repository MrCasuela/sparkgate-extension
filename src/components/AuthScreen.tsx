import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorAlert } from './ErrorAlert';
import type { UseAuthReturn } from '../hooks/useAuth';

type Tab = 'login' | 'register';

interface AuthScreenProps {
  login: UseAuthReturn['login'];
  register: UseAuthReturn['register'];
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

export function AuthScreen({
  login,
  register,
  loading,
  error,
  clearError,
}: AuthScreenProps) {
  const { dark, toggleDark } = useTheme();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
    } catch {
      // error state handled by hook
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (password !== confirmPassword) {
      // Use a temporary error display
      return;
    }
    try {
      await register(email, password);
      setRegisterSuccess(true);
      setTab('login');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch {
      // error state handled by hook
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-bg text-text dark:bg-darkBg dark:text-darkText">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h1 className="text-lg font-bold text-primary dark:text-white">SparkGate</h1>
        <button
          onClick={toggleDark}
          className="rounded-lg p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Cambiar modo oscuro"
        >
          {dark ? 'Claro' : 'Oscuro'}
        </button>
      </div>

      {/* Plan badge */}
      <div className="mx-4 mt-3 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
        <span className="text-xs font-medium text-primary dark:text-white">
          Plan: <span className="font-bold">Gratuito</span>
        </span>
        <button
          disabled
          className="cursor-not-allowed rounded bg-primary px-3 py-1 text-xs text-white opacity-50"
          title="Próximamente"
        >
          Upgrade
        </button>
      </div>

      {/* Tabs */}
      <div className="mx-4 mt-4 flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        <button
          onClick={() => { setTab('login'); clearError(); }}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === 'login'
              ? 'bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Iniciar Sesión
        </button>
        <button
          onClick={() => { setTab('register'); clearError(); }}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === 'register'
              ? 'bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Registrarse
        </button>
      </div>

      {/* Form */}
      <form
        onSubmit={tab === 'login' ? handleLogin : handleRegister}
        className="mx-4 mt-4 flex flex-col gap-3"
      >
        {registerSuccess && (
          <div className="rounded-lg bg-positive/10 p-3 text-sm text-positive">
            Registro exitoso. Ahora puedes iniciar sesión.
          </div>
        )}

        {error && <ErrorAlert message={error} onDismiss={clearError} />}

        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-darkText"
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-darkText"
        />

        {tab === 'register' && (
          <input
            type="password"
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-darkText"
          />
        )}

        {password !== confirmPassword && tab === 'register' && confirmPassword && (
          <p className="text-xs text-alert">Las contraseñas no coinciden</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <LoadingSpinner small />
          ) : tab === 'login' ? (
            'Iniciar Sesión'
          ) : (
            'Crear Cuenta'
          )}
        </button>
      </form>
    </div>
  );
}
