import React from 'react';

export const Label = ({ className = '', ...props }) => (
  <label className={`block text-sm font-bold text-slate-800 dark:text-slate-100 ${className}`} {...props} />
);

export default Label;
