import React from 'react';

export function Button({ children, className = '', variant, size, ...props }) {
  // map some simple variants to DaisyUI tokens
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all';
  const sizeClass = size === 'icon' ? 'h-9 w-9 p-0' : 'h-11 px-4';
  const variantClass = className || (variant === 'outline' ? 'border-2 border-slate-200 bg-white' : 'bg-primary text-white');
  return (
    <button className={`${base} ${sizeClass} ${variantClass}`} {...props}>
      {children}
    </button>
  );
}

export default Button;
