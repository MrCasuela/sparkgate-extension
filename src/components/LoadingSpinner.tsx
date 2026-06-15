interface LoadingSpinnerProps {
  message?: string;
  small?: boolean;
}

export function LoadingSpinner({ message, small }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${small ? 'py-0' : 'py-8'}`}>
      <div
        className={`animate-spin rounded-full border-4 border-primary border-t-transparent ${
          small ? 'h-4 w-4 border-2' : 'h-8 w-8'
        }`}
      />
      {message && (
        <p className={`text-sm text-text dark:text-darkText ${small ? 'text-xs' : ''}`}>
          {message}
        </p>
      )}
    </div>
  );
}
