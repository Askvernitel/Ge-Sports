import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'destructive';

const base =
  'inline-flex items-center justify-center font-sans text-sm font-semibold px-[18px] py-[12px] cursor-pointer ' +
  'transition-[background-color,border-color,color,transform,box-shadow] duration-200 ' +
  'hover:-translate-y-px ' +
  // A small recoil kick on press/release rather than a plain scale — a
  // slight tilt down-and-back like a trigger pull, snapping past neutral
  // on release via the overshoot easing curve instead of a flat ease-out.
  'active:translate-y-0 active:scale-[0.97] active:-rotate-1 ' +
  '[transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100 disabled:active:rotate-0';

const variants: Record<Variant, string> = {
  primary: 'bg-zone text-ground border border-zone hover:bg-[#4d8cb3] hover:shadow-[0_4px_16px_rgba(62,124,163,0.35)]',
  secondary: 'bg-transparent text-bone border border-lichen hover:bg-panel-hover hover:border-bone',
  destructive: 'bg-transparent text-flare border border-flare hover:bg-[#2a1a17] hover:shadow-[0_4px_16px_rgba(193,59,42,0.25)]',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({ variant = 'primary', className, children, ...rest }: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${className ?? ''}`} {...rest}>
      {children}
    </button>
  );
}

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  to: string;
  children: ReactNode;
}

export function LinkButton({ variant = 'primary', to, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link to={to} className={`${base} ${variants[variant]} ${className ?? ''}`} {...rest}>
      {children}
    </Link>
  );
}
