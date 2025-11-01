import React from 'react';

export const Input = ({ className = '', ...props }) => (
  <input
    className={`block w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-slate-400 placeholder:opacity-60 dark:placeholder:text-slate-500 dark:placeholder:opacity-40 ${className}`}
    {...props}
  />
);

export default Input;
