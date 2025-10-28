import React from 'react';

export const Input = ({ className = '', ...props }) => (
  <input
  className={`block w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/20 placeholder:text-slate-400 placeholder:opacity-60 dark:placeholder:text-slate-500 dark:placeholder:opacity-40 ${className}`}
    {...props}
  />
);

export default Input;
