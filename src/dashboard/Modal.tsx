import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function Modal({ title, subtitle, children }: ModalProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-label={title}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
        {subtitle && <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
