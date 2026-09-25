import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  primary: 'ec-btn-primary font-semibold',
  secondary: 'bg-console-700 text-slate-200 hover:bg-console-600 active:bg-console-500 border border-[var(--line-strong)]',
  ghost: 'text-slate-300 hover:bg-console-700 hover:text-white active:bg-console-600',
  danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 font-semibold',
  success: 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400 active:bg-emerald-600 font-semibold',
  warning: 'bg-amber-400 text-amber-950 hover:bg-amber-300 active:bg-amber-500 font-semibold',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] font-medium gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm font-medium gap-2 rounded-lg',
  lg: 'h-14 px-6 text-base gap-2.5 rounded-xl',
  icon: 'h-10 w-10 rounded-lg',
  'icon-sm': 'h-8 w-8 rounded-md',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'group/btn inline-flex shrink-0 items-center justify-center whitespace-nowrap select-none',
        // A small, quick press: feels physical without slowing anything down.
        'transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.98]',
        'disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
});
