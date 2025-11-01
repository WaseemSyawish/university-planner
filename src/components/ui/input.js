import React from 'react';

export function Input({ className = '', ...props }) {
  // Add subtle placeholder styling so placeholder text appears more muted
  // and less visually heavy compared to actual input value.
  // Use simple, low-contrast styles and ensure text is readable in dark mode.
  const base = 'w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-400/40';
  // Muted placeholders for both themes
  const placeholderStyle = 'placeholder:text-slate-400 placeholder:opacity-60 dark:placeholder:text-slate-500 dark:placeholder:opacity-40';
  return <input className={`${base} ${placeholderStyle} ${className}`} {...props} />;
}

export default Input;
