import React, { useEffect, useState, useRef } from 'react';

export default function CreateStepModal({ visible = true, onClose, children, ariaLabel, onEntered, onExited }) {
  const [show, setShow] = useState(false);
  const rootRef = useRef(null);
  const wrapperRef = useRef(null);
  const prevVisible = useRef(visible);
  const [reduceMotion, setReduceMotion] = useState(false);
  // animation tokens — adjust to match site design system
  const ANIM_DURATION_MS = 260; // tuned duration
  const ANIM_EASING = 'cubic-bezier(.2,.9,.25,1)';

  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReduceMotion(mq.matches);
      function onChange() { setReduceMotion(mq.matches); }
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else mq.addListener(onChange);
      return () => { if (mq.removeEventListener) mq.removeEventListener('change', onChange); else mq.removeListener(onChange); };
    } catch (e) {
      // ignore in older browsers
    }
  }, []);

  useEffect(() => {
    // When becoming visible, mount immediately so enter transition can run.
    // When becoming not visible, keep mounted until exit transition completes so
    // callers can rely on onExited to open the next step (deterministic sequencing).
    if (visible) setShow(true);
    // don't setShow(false) here on hide — wait for transitionend to complete
    prevVisible.current = visible;
  }, [visible]);

  // basic focus trap & escape handling
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose && onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

  // When reduced-motion is active, skip listening for transitionend

    if (reduceMotion) {
      // call callbacks synchronously to maintain sequencing and update mount state
      if (visible) {
        setShow(true);
        onEntered && onEntered();
      } else {
        onExited && onExited();
        setShow(false);
      }
      return;
    }

    function onTransition(e) {
      // only respond to transitions on transform or opacity
      if (e.propertyName !== 'transform' && e.propertyName !== 'opacity') return;
      // if we just entered
      if (visible) {
        onEntered && onEntered();
      } else {
        // finished exit
        onExited && onExited();
        // unmount after exit transition finished
        setShow(false);
      }
    }
    node.addEventListener('transitionend', onTransition);
    return () => node.removeEventListener('transitionend', onTransition);
  }, [visible, onEntered, onExited, reduceMotion]);

  // don't render before first enter or after exit completes
  if (!visible && !show) return null;

  // Apply inline styles for consistent duration/easing so transitionend fires reliably.
  const overlayStyle = reduceMotion ? {} : { transitionProperty: 'opacity', transitionDuration: `${ANIM_DURATION_MS}ms`, transitionTimingFunction: ANIM_EASING };
  const wrapperStyle = reduceMotion ? {} : { transitionProperty: 'transform, opacity', transitionDuration: `${ANIM_DURATION_MS}ms`, transitionTimingFunction: ANIM_EASING };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6 ${visible ? '' : 'pointer-events-none'}`} role="dialog" aria-modal="true" aria-label={ariaLabel} ref={rootRef}>
      <div style={overlayStyle} className={`absolute inset-0 bg-black/30 ${visible ? 'opacity-100' : 'opacity-0'}`} onMouseDown={onClose} aria-hidden="true" />

      <div ref={wrapperRef} style={wrapperStyle} className={`relative w-full max-w-4xl mx-auto transform ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`} role="dialog">
        {/* Card: children are responsible for internal padding so content can control spacing */}
        {/* Use overflow-auto so footers inside children remain reachable on small screens */}
        <div className="cozy rounded-xl shadow-md overflow-auto max-h-[90vh]">
          {children}
        </div>
      </div>
    </div>
  );
}
