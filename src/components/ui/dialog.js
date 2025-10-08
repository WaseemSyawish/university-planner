import React, { useEffect, useState } from 'react';

export function Dialog({ children, open, onOpenChange = () => {}, className = '', animationDelay = 320, ...props }) {
  // animationDelay: milliseconds to keep mounted after `open` turns false so CSS close animation can run
  const [mounted, setMounted] = useState(Boolean(open));

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onOpenChange(false);
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) setMounted(true);
    else {
      // keep mounted briefly to allow close animation to run
      const t = setTimeout(() => setMounted(false), animationDelay);
      return () => clearTimeout(t);
    }
  }, [open, animationDelay]);

  if (!mounted) return null;

  // Prepare inline transition style to ensure animations are applied even if
  // stylesheet scoping or timing prevents keyframe rules from matching.
  const transitionStyle = {
    transition: 'opacity 260ms cubic-bezier(0.2, 0.9, 0.2, 1), transform 260ms cubic-bezier(0.2, 0.9, 0.2, 1)',
    opacity: open ? 1 : 0,
    transform: open ? 'translateY(0) scale(1)' : 'translateY(8px) scale(.995)'
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${className}`} {...props}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} aria-hidden="true"></div>
      <div className="relative z-10 w-full max-w-3xl px-4">
        {/* pass data-state attribute and a safe inline transition style down to children */}
        {React.Children.map(children, child => {
          if (!React.isValidElement(child)) return child;
          const childStyle = { ...(child.props && child.props.style ? child.props.style : {}), ...transitionStyle };
          return React.cloneElement(child, { 'data-state': open ? 'open' : 'closed', style: childStyle });
        })}
      </div>
    </div>
  );
}

export function DialogContent({ children, className = '', ...props }) {
  return (
    <div className={`cozy rounded-lg shadow-xl p-6 max-h-[90vh] overflow-auto ${className}`} {...props}>
      {children}
    </div>
  );
}

export function DialogHeader({ children, className = '' }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function DialogTitle({ children, className = '' }) {
  return <h3 className={`text-xl font-semibold ${className}`}>{children}</h3>;
}

export default Dialog;
