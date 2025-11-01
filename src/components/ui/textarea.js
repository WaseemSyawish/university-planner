import React from 'react';

export function Textarea({ className = '', ...props }) {
  const base = 'w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-400/40';
  const placeholderStyle = 'placeholder:text-slate-400 placeholder:opacity-60 dark:placeholder:text-slate-500 dark:placeholder:opacity-40';
  return <textarea className={`${base} ${placeholderStyle} ${className}`} {...props} />;
}

export default Textarea;
