import { useAuth } from '../hooks/useAuth';
import { AuthScreen } from '../components/AuthScreen';
import { Navigator } from '../components/Navigator';
import { LoadingSpinner } from '../components/LoadingSpinner';

function App() {
  const {
    isAuthenticated,
    loading,
    login,
    register,
    error,
    clearError,
    logout,
  } = useAuth();

  if (loading) {
    return (
      <div className="flex h-[500px] w-[360px] items-center justify-center bg-bg dark:bg-darkBg">
        <LoadingSpinner message="Cargando..." />
      </div>
    );
  }

  return (
    <div className="h-[500px] w-[360px] overflow-hidden bg-bg dark:bg-darkBg">
      {isAuthenticated ? (
        <Navigator onLogout={logout} />
      ) : (
        <AuthScreen
          login={login}
          register={register}
          loading={loading}
          error={error}
          clearError={clearError}
        />
      )}
    </div>
  );
}

export default App;
