import React from 'react';

export function Textarea({ className = '', ...props }) {
  return <textarea className={`w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 ${className}`} {...props} />;
}

export default Textarea;
