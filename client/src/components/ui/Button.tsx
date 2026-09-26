import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

// Look and states live in styles/console.css (.ec-btn-*): a slight lift on hover, a press
// that sinks, and a disabled state that reads as unavailable rather than just faded.
const variants: Record<Variant, string> = {
  primary: 'ec-btn ec-btn-primary font-semibold',
  secondary: 'ec-btn ec-btn-secondary',
  ghost: 'ec-btn ec-btn-ghost',
  danger: 'ec-btn ec-btn-danger font-semibold',
  success: 'ec-btn ec-btn-success font-semibold',
  warning: 'ec-btn ec-btn-warning font-semibold',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] font-medium gap-1.5 rounded-[5px]',
  md: 'h-10 px-4 text-sm font-medium gap-2 rounded-md',
  lg: 'h-12 px-5 text-[15px] gap-2.5 rounded-md',
  icon: 'h-10 w-10 rounded-md',
  'icon-sm': 'h-8 w-8 rounded-[5px]',
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
