import React from 'react';

export function Alert({ children, className = '', variant = 'info', ...props }) {
  const base = 'p-3 rounded-md shadow-sm flex items-start gap-3';
  let tone = 'bg-blue-50 text-blue-800 border border-blue-100';
  if (variant === 'danger') tone = 'bg-red-50 text-red-800 border border-red-100';
  if (variant === 'success') tone = 'bg-green-50 text-green-800 border border-green-100';
  return (
    <div role="alert" className={`${base} ${tone} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function AlertDescription({ children, className = '' }) {
  return <div className={`text-sm ${className}`}>{children}</div>;
}

export default Alert;
