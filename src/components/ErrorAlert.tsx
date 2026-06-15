interface ErrorAlertProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorAlert({ message, onDismiss }: ErrorAlertProps) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-alert/10 p-3 text-sm text-alert">
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-alert hover:text-alert/80"
          aria-label="Cerrar"
        >
          ✕
        </button>
      )}
    </div>
  );
}
