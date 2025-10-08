import React from 'react';

// Minimal Select wrapper matching the small API used in calendar.js
export const Select = ({ children, value, onValueChange, className = '' }) => (
  <select value={value} onChange={(e) => onValueChange && onValueChange(e.target.value)} className={`block w-full rounded-xl border-2 border-slate-200 px-3 py-2 ${className}`}>
    {children}
  </select>
);

export const SelectTrigger = ({ children, className = '', ...props }) => (
  <div className={className} {...props}>{children}</div>
);
export const SelectContent = ({ children, className = '' }) => (
  <div className={className}>{children}</div>
);
export const SelectItem = ({ children, value, className = '' }) => (
  <option value={value} className={className}>{children}</option>
);
export const SelectValue = () => null;

export default Select;
