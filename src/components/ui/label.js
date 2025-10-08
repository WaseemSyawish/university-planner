import React from 'react';

export function Label({ children, className = '', ...props }) {
  return (
    <label className={`block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1 ${className}`} {...props}>
      {children}
    </label>
  );
}

export default Label;
