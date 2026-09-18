import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorAlert } from './ErrorAlert';
import type { UseAuthReturn } from '../hooks/useAuth';
import { ApiError } from '../api/client';
import type { AccountType } from '../types/auth';

type Tab = 'login' | 'register';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
  const [typeAccount, setTypeAccount] = useState<AccountType>('personal');
  const [organizationName, setOrganizationName] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [emailFormatError, setEmailFormatError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

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
    setInfoMessage(null);

    if (!EMAIL_RE.test(email)) {
      setEmailFormatError('Formato de correo electrónico inválido');
      return;
    }
    setEmailFormatError(null);

    if (password !== confirmPassword) {
      return;
    }
    try {
      const res = await register(
        email,
        password,
        typeAccount,
        typeAccount === 'enterprise' ? organizationName : undefined,
      );
      if (res.access_token) {
        // Auto-login: App will switch to the main panel now that isAuthenticated is true.
        return;
      }
      setRegisterSuccess(true);
      setTab('login');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setOrganizationName('');
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 409) {
        clearError();
        setInfoMessage(e.detail);
        setTab('login');
        setPassword('');
        setConfirmPassword('');
      }
      // other errors handled by hook via `error`
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
          onClick={() => { setTab('login'); clearError(); setInfoMessage(null); setEmailFormatError(null); }}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === 'login'
              ? 'bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Iniciar Sesión
        </button>
        <button
          onClick={() => { setTab('register'); clearError(); setInfoMessage(null); setEmailFormatError(null); }}
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

        {infoMessage && (
          <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary dark:text-white">
            {infoMessage}
          </div>
        )}

        {error && <ErrorAlert message={error} onDismiss={clearError} />}

        {tab === 'register' && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Tipo de cuenta
            </span>
            <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
              {(['personal', 'enterprise'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTypeAccount(option)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    typeAccount === option
                      ? 'bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  {option === 'personal' ? 'Cuenta personal' : 'Cuenta empresa'}
                </button>
              ))}
            </div>
            {typeAccount === 'enterprise' && (
              <input
                type="text"
                placeholder="Nombre de la empresa"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
                minLength={2}
                maxLength={120}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-darkText"
              />
            )}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailFormatError(null); }}
            required
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-darkText"
          />
          {emailFormatError && tab === 'register' && (
            <p className="text-xs text-alert">{emailFormatError}</p>
          )}
        </div>

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
