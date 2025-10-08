import React, { useEffect, useRef } from 'react';

// A richer, backwards-compatible Modal component.
// Props:
// - title: string
// - open: boolean
// - onClose: fn
// - children: body
// - footer: optional node rendered in footer slot
// - size: 'sm' | 'md' | 'lg' | 'full' (default 'md')
export default function Modal({ title, children, open, onClose, footer = null, size = 'md' }) {
  const panelRef = useRef(null);
  const previousActiveRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    previousActiveRef.current = document.activeElement;

    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    document.addEventListener('keydown', onKey);

    // focus the first focusable element in the panel
    setTimeout(() => {
      const el = panelRef.current && panelRef.current.querySelector('input,button,select,textarea,a[href]');
      if (el) el.focus();
    }, 10);

    // trap tab focus inside the modal
    const onTab = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = panelRef.current.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onTab);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keydown', onTab);
      // restore focus
      try { if (previousActiveRef.current) previousActiveRef.current.focus(); } catch (e) {}
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = {
    sm: 'modal-sm',
    md: 'modal-md',
    lg: 'modal-lg',
    full: 'modal-full'
  }[size] || 'modal-md';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div className={`modal-panel cozy ${sizeClass}`} ref={panelRef} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="modal-close" aria-label="Close" onClick={() => onClose && onClose()}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && (
          <div className="modal-footer">{footer}</div>
        )}
      </div>
    </div>
  );
}
