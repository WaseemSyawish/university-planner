import React, { useState, useRef, useEffect } from 'react';

// Minimal accessible custom select to replace native <select> where styling of options matters.
// Features: keyboard navigation (up/down/enter/escape), click outside to close, basic aria attributes.
// Not a drop-in for all HTML select features (no form submission integration). Use for UI selection.

export default function CustomSelect({ options = [], value = '', onChange = () => {}, placeholder = 'Select...', className = '', id }) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    if (!open) setHighlighted(-1);
  }, [open]);

  const onToggle = () => setOpen(v => !v);
  const handleSelect = (opt) => {
    onChange(opt.value);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlighted(h => Math.min(h + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && highlighted >= 0) {
        handleSelect(options[highlighted]);
      } else {
        setOpen(true);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const selected = options.find(o => String(o.value) === String(value));

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`} id={id}>
      <div>
        <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={onToggle} onKeyDown={handleKeyDown}
          className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-left flex justify-between items-center">
          <span className={`${selected ? 'text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}`}>{selected ? selected.label : placeholder}</span>
          <svg className="ml-2 h-4 w-4 text-gray-500 dark:text-slate-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 12a1 1 0 01-.707-.293l-3-3a1 1 0 111.414-1.414L10 9.586l2.293-2.293a1 1 0 111.414 1.414l-3 3A1 1 0 0110 12z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {open && (
        <ul role="listbox" tabIndex={-1} className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg max-h-64 overflow-auto">
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400">No options</li>
          ) : options.map((opt, idx) => (
            <li key={opt.value} role="option" aria-selected={String(opt.value) === String(value)}
              onMouseEnter={() => setHighlighted(idx)}
              onMouseLeave={() => setHighlighted(-1)}
              onClick={() => handleSelect(opt)}
              className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${String(opt.value) === String(value) ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : highlighted === idx ? 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-100' : 'text-gray-800 dark:text-slate-100'}`}>
              <span>{opt.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
