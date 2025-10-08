import React, { useEffect } from 'react';

export default function Notification({ type = 'info', message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => onClose && onClose(), 5000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`px-3 py-2 rounded-lg shadow-md text-sm ${type === 'success' ? 'bg-green-600 text-white' : type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
