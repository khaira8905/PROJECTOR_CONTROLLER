import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Focus the first form field, or the dialog itself.
    const first =
      panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panelRef.current?.querySelector<HTMLElement>('input, textarea, select');
    (first ?? panelRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="ec-backdrop-in absolute inset-0 bg-console-950/70 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'ec-card ec-card-raised ec-modal-in relative flex max-h-[90vh] w-full flex-col rounded-2xl shadow-2xl outline-none',
          size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl',
        )}
      >
        <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-white">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
