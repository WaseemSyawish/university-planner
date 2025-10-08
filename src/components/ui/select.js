import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const SelectContext = createContext(null);

export function Select({ value, onValueChange, children, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const portalIdRef = useRef('select-portal-' + Math.random().toString(36).slice(2, 9));
  const [anchorRect, setAnchorRect] = useState(null);

  useEffect(() => {
    function onDoc(e) {
      const target = e.target;
      // don't close if click happened inside the trigger or inside the portaled content
      const clickedInTrigger = ref.current && ref.current.contains(target);
      const clickedInPortal = typeof target.closest === 'function' && target.closest(`[data-portal-id="${portalIdRef.current}"]`);
      if (!clickedInTrigger && !clickedInPortal) setOpen(false);
    }
    function updateRect() {
      if (ref.current) setAnchorRect(ref.current.getBoundingClientRect());
    }

  document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    const ro = new ResizeObserver(updateRect);
    if (ref.current) ro.observe(ref.current);
    updateRect();

    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      if (ref.current) ro.disconnect();
    };
  }, []);

  useEffect(() => {
    if (open && ref.current) setAnchorRect(ref.current.getBoundingClientRect());
  }, [open]);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, anchorRect, portalId: portalIdRef.current }}>
      <div ref={ref} className={`relative inline-block ${className}`}>{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ children, className = '', ...props }) {
  const ctx = useContext(SelectContext);
  if (!ctx) return null;

  return (
    <button
      type={props.type || "button"}
      onClick={() => ctx.setOpen(!ctx.open)}
      className={`inline-flex items-center gap-2 px-2 py-1 border rounded-md cozy text-sm dark:bg-transparent dark:border-white\/6 ${className}`}
      {...props}
    >
      <span className="flex items-center gap-2">{children}</span>
      <svg className="ml-2 h-3 w-3 text-gray-500 dark:text-slate-300" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function SelectValue({ children, className = '', placeholder }) {
  const ctx = useContext(SelectContext);
  if (!ctx) return null;
  const hasValue = Boolean(ctx.value)
  return (
    <span className={`select-value ${hasValue ? 'text-gray-800 dark:text-slate-100 font-medium' : 'text-gray-400 dark:text-slate-400'} ${className}`}>
      {hasValue ? (children || ctx.value) : (placeholder || children)}
    </span>
  );
}

export function SelectContent({ children, className = '', style = {} }) {
  const ctx = useContext(SelectContext);
  if (!ctx) return null;
  if (!ctx.open) return null;

  const rect = ctx.anchorRect || { top: 0, left: 0, width: 120, height: 36 };
  let left = rect.left + window.scrollX;
  const minWidth = Math.max(88, rect.width);
  // clamp horizontally to viewport
  const maxLeft = window.scrollX + Math.max(document.documentElement.clientWidth - minWidth - 12, 12);
  if (left > maxLeft) left = maxLeft;
  if (left < window.scrollX + 8) left = window.scrollX + 8;

  // compute top and flip above if needed
  const estimatedContentHeight = 260; // match maxHeight
  const spaceBelow = window.scrollY + document.documentElement.clientHeight - (rect.bottom + window.scrollY) - 8;
  let top = rect.bottom + window.scrollY + 6;
  if (spaceBelow < Math.min(estimatedContentHeight, window.innerHeight * 0.5)) {
    // not enough space below, try place above
    top = rect.top + window.scrollY - Math.min(estimatedContentHeight, window.innerHeight * 0.5) - 6;
    // if still too high, clamp
    if (top < window.scrollY + 8) top = window.scrollY + 8;
  }

    const content = (
    <div
      data-portal-id={ctx.portalId}
      className={`absolute cozy rounded-lg shadow-md border border-gray-100 dark:border-white\/6 dark:bg-[#071423] ${className}`}
      style={{ position: 'absolute', top: top + 'px', left: left + 'px', minWidth: minWidth + 'px', zIndex: 2147483000, pointerEvents: 'auto', maxHeight: '260px', overflow: 'auto', transition: 'opacity 120ms ease, transform 120ms ease', ...style }}
    >
      <div className="p-1">{children}</div>
    </div>
  );

  return createPortal(content, document.body);
}

export function SelectItem({ children, value, className = '', ...props }) {
  const ctx = useContext(SelectContext);
  if (!ctx) return null;
  return (
    <div
      onClick={(e) => {
        // stop immediate propagation to avoid closing parent popovers prematurely
        e && typeof e.stopPropagation === 'function' && e.stopPropagation();
        // pass the value through as-is
  // debug logging removed
  ctx.onValueChange?.(value);
        ctx.setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          ctx.onValueChange?.(value);
          ctx.setOpen(false);
        }
      }}
      role="button"
      tabIndex={0}
      data-value={value}
      className={`px-2 py-1.5 cursor-pointer rounded-md hover:bg-gray-50 text-sm flex items-center justify-between ${className}`}
      {...props}
    >
      <span className="text-sm text-gray-800">{children}</span>
      {ctx.value === value && (
        <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

export default Select;
