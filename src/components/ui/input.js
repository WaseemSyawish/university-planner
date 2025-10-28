import React from 'react';

export function Input({ className = '', ...props }) {
  // Add subtle placeholder styling so placeholder text appears more muted
  // and less visually heavy compared to actual input value.
  const base = 'w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500';
  // Light mode: muted slate; Dark mode: slightly lighter placeholder but still translucent
  // Use a greyer, more subtle placeholder in dark mode (less bright/less prominent)
  const placeholderStyle = 'placeholder:text-slate-400 placeholder:opacity-60 dark:placeholder:text-slate-500 dark:placeholder:opacity-40';
  return <input className={`${base} ${placeholderStyle} ${className}`} {...props} />;
}

export default Input;
