import React from 'react';

export function Button({ children, className = '', variant = 'default', size = 'md', type = 'button', ...props }) {
  let classes = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  // base sizes
  if (size === 'sm') classes += ' px-3 py-1 text-sm';
  else if (size === 'icon') classes += ' p-2';
  else classes += ' px-4 py-2';

  // variants (simple mapping to Daisy/Tailwind look)
  if (variant === 'outline') classes += ' border border-gray-200 cozy text-gray-700 hover:bg-white\/6 dark:border-white\/6 dark:text-slate-200 dark:hover:bg-white\/6';
  else if (variant === 'destructive') classes += ' bg-red-600 text-white hover:bg-red-700';
  else if (variant === 'success') classes += ' bg-green-600 text-white hover:bg-green-700';
  else if (variant === 'warning') classes += ' bg-yellow-500 text-white hover:bg-yellow-600';
  else if (variant === 'ghost') classes += ' bg-transparent hover:bg-white\/6 dark:hover:bg-white\/6';
  else if (variant === 'link') classes += ' bg-transparent text-blue-600 underline';
  else classes += ' bg-purple-600 text-white hover:bg-purple-700 dark:bg-indigo-500 dark:hover:bg-indigo-600';

  return (
    <button type={type} className={`${classes} ${className}`} {...props}>
      {children}
    </button>
  );
}

export default Button;
