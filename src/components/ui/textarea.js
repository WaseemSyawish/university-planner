import React from 'react';

export function Textarea({ className = '', ...props }) {
  const base = 'w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500';
  const placeholderStyle = 'placeholder:text-slate-400 placeholder:opacity-60 dark:placeholder:text-slate-500 dark:placeholder:opacity-40';
  return <textarea className={`${base} ${placeholderStyle} ${className}`} {...props} />;
}

export default Textarea;
