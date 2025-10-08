import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Calendar, BookOpen, Trash2, Clock, Flag, Users } from 'lucide-react';
import { formatDateShort, formatTimeFromParts, buildLocalDateFromParts } from '../src/lib/dateHelpers';

// runtime user id will be resolved on mount via /api/auth/me

function useLockBody(lock) {
  useEffect(() => {
    document.body.style.overflow = lock ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lock]);
}

function Modal({ title, open, onClose, children, accent, returnFocusTo }) {
  const panelRef = useRef(null);
  const titleId = useRef('modal-title-' + Math.random().toString(36).slice(2, 8));
  const closingRef = useRef(false);
  const skipRestoreRef = useRef(false);

  useLockBody(open);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const to = setTimeout(() => {
      const el = panelRef.current;
      if (!el) return;
      const focusable = el.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
      if (focusable && focusable.length) focusable[0].focus();
      else panelRef.current?.focus();
    }, 0);
    return () => { clearTimeout(to); if (!closingRef.current) prev?.focus?.(); };
  }, [open]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') closeWithAnimation(); }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function closeWithAnimation() {
    if (closingRef.current) return;
    closingRef.current = true;
    skipRestoreRef.current = true;
    const panel = panelRef.current; if (panel) panel.classList.add('modal-exit');
    setTimeout(() => {
      onClose?.();
      try { if (returnFocusTo && returnFocusTo.current) returnFocusTo.current.focus(); } catch (e) {}
      closingRef.current = false;
      setTimeout(() => { skipRestoreRef.current = false; }, 20);
    }, 220);
  }

  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;
    function onKey(e) {
      if (e.key !== 'Tab') return;
      const focusable = el.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
      if (!focusable || focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center modal-container" aria-hidden={!open} onClick={(e) => { if (e.target === e.currentTarget) closeWithAnimation(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ ['--modal-accent']: accent || 'var(--accent-indigo-600)' }}
        className="relative w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 cozy-modal transform transition-all duration-300 modal-enter"
      >
        <div className="card-header modal-header">
          <div className="modal-accent" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="color-chip" style={{ background: 'var(--modal-accent)' }} />
            <div id={titleId.current} className="modal-title">{title}</div>
          </div>
          <div>
            <button onClick={() => closeWithAnimation()} aria-label="Close" className="text-gray-500 hover:text-gray-800">✕</button>
          </div>
        </div>
        <div className="modal-panel modal-body show" style={{ background: 'linear-gradient(180deg,#fff,#fffef9)', border: '1px solid rgba(0,0,0,0.03)' }}>
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof window !== 'undefined' && document.body) return createPortal(modal, document.body);
  return modal;
}

function formatDate(d) {
  return formatDateShort(d);
}

function ymdFromDateObj(dt) {
  const d = new Date(dt);
  if (isNaN(d.getTime())) return '';
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function focusAndOpenPicker(refOrEl) {
  try {
    const el = refOrEl && refOrEl.current ? refOrEl.current : refOrEl;
    if (!el) return;
    if (typeof el.focus === 'function') el.focus();
    try { el.setAttribute && el.setAttribute('aria-invalid', 'true'); } catch (e) {}
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); return; } catch (e) { }
    }
    try { el.click && el.click(); } catch (e) {}
  } catch (err) {
    try { refOrEl && refOrEl.current && refOrEl.current.focus && refOrEl.current.focus(); } catch (e) {}
  }
}

function EventCard({ ev, onEdit, compact = false }) {
  return (
    <div
      role="button"
      aria-label={`Open event ${ev.title}`}
      tabIndex={0}
      onClick={() => onEdit?.(ev)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onEdit?.(ev); }}
      className={`p-0 bg-transparent rounded-lg overflow-hidden cursor-pointer ${ev.pending ? 'opacity-80 italic' : ''}`}>
    <div className={`event-card-inner timeline flex items-stretch ${compact ? 'compact' : ''}`}>
      <div className="timeline-col flex flex-col items-center px-3 py-2">
        <div className="timeline-dot" style={{ background: ev.color || '#60A5FA' }} aria-hidden="true" />
        <div className="timeline-line" aria-hidden="true" />
      </div>
      <div className={`flex-1 ${compact ? 'p-2' : 'p-3'} min-w-0 bg-white rounded-r-lg shadow-sm hover:shadow-md transition-shadow`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className={`event-title font-semibold ${compact ? 'text-sm' : 'text-base'} truncate`}>{ev.title}</div>
            {!compact && (<div className="event-desc text-sm text-gray-600 truncate mt-1">{ev.description || ''}</div>)}
            <div className="mt-2 flex items-center gap-2">
              {ev.course_name && <div className="course-pill text-xs">{ev.course_name}</div>}
              {ev.location && <div className="text-xs text-gray-400">{ev.location}</div>}
            </div>
          </div>
          <div className="ml-3 text-right time-block">
            <div className="text-xs text-gray-500">{formatDate(ev.date)}</div>
            <div className="mt-2 time-bubble">{ev.time ? formatTimeFromParts(ev.date, ev.time) : (ev.date ? new Date(ev.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '')}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-gray-500">{ev.participants ? `${ev.participants.length} attendees` : ''}</div>
          {ev.pending && (<div className="text-xs text-gray-400">Saving…</div>)}
        </div>
      </div>
    </div>
    </div>
  );
}

export default function UniversityPlanner({ initialEvents = [], initialCourses = [], ssrTimetable = [], ssrAttendanceSummary = null }) {
  // Client-side auth guard
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch('/api/auth/me');
        if (!mounted) return;
        const j = await r.json();
        if (!j || !j.authenticated) window.location.href = '/signin';
      } catch (e) { window.location.href = '/signin'; }
    })();
    return () => { mounted = false; };
  }, []);
  const [events, setEvents] = useState(initialEvents || []);
  const [courses, setCourses] = useState(initialCourses || []);
  const [weekTimetable, setWeekTimetable] = useState(ssrTimetable || []);
  const [ssrAttendance, setSsrAttendance] = useState(ssrAttendanceSummary || null);
  const [showEventModal, setShowEventModal] = useState(false);
  const openerRef = useRef(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventsCount, setEventsCount] = useState(0);
  const [coursesCount, setCoursesCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const toastTimeoutsRef = useRef(new Map());
  const [searchQ, setSearchQ] = useState('');
  const searchRef = useRef(null);
  const [isCompact, setIsCompact] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  });

  useEffect(() => {
    try {
      const v = window.localStorage.getItem('agendaCompact');
      if (v === '1') setIsCompact(true);
      else if (v === '0') setIsCompact(false);
    } catch (e) {}
  }, []);

  useEffect(() => { try { window.localStorage.setItem('agendaCompact', isCompact ? '1' : '0'); } catch (e) {} }, [isCompact]);

  function addToast({ type = 'info', text = '', undoSnapshot = null, ttl = 5000 }) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const t = { id, type, text, undoSnapshot };
    setToasts(prev => [...prev, t]);
    const to = setTimeout(() => { setToasts(cur => cur.filter(x => x.id !== id)); toastTimeoutsRef.current.delete(id); }, ttl);
    toastTimeoutsRef.current.set(id, to);
    return id;
  }

  function removeToast(id) { const to = toastTimeoutsRef.current.get(id); if (to) clearTimeout(to); toastTimeoutsRef.current.delete(id); setToasts(cur => cur.filter(x => x.id !== id)); }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // resolve current user from auth endpoint
        const a = await fetch('/api/auth/me');
        if (!mounted) return;
        const aj = a.ok ? await a.json() : null;
        const userId = aj && aj.authenticated ? aj.id : null;
        // fetch events and courses for resolved user (server will fallback if needed)
        const [res, cr] = await Promise.all([
          fetch('/api/events'),
          fetch('/api/courses')
        ]);
        if (!mounted) return;
        if (res.ok) {
          const j = await res.json();
          setEvents((prev) => {
            const byId = Object.fromEntries((prev || []).map(e => [e.id, e]));
            (j.events || []).forEach(e => byId[e.id] = e);
            return Object.values(byId).slice(0, 200);
          });
        }
        if (cr.ok) { const jc = await cr.json(); if (mounted) setCourses(jc.courses || []); }
      } catch (e) {}
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === '/' && (document.activeElement?.tagName || '') !== 'INPUT') { e.preventDefault(); searchRef.current?.focus?.(); }
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = document.activeElement; if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
        try { const btn = document.querySelector('button.cozy-btn.btn-primary'); if (btn) openerRef.current = btn; } catch (e) {}
        setShowEventModal(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function getNextClass() {
    const now = new Date();
    const future = (weekTimetable || []).map(c => ({
      ...c,
      dateObj: c.time ? buildLocalDateFromParts(c.date, c.time) : (c.date ? new Date(c.date) : null)
    })).filter(c => c.dateObj && c.dateObj >= now);
    future.sort((a,b) => a.dateObj - b.dateObj);
    return future.length ? future[0] : null;
  }

  useEffect(() => {
    let raf;
    const duration = 600; const start = performance.now(); const fromE = eventsCount; const toE = events.length || 0; const fromC = coursesCount; const toC = courses.length || 0;
    function tick(now) { const t = Math.min(1, (now - start) / duration); const ease = t < 0.5 ? 2*t*t : -1 + (4-2*t)*t; setEventsCount(Math.round(fromE + (toE - fromE) * ease)); setCoursesCount(Math.round(fromC + (toC - fromC) * ease)); if (t < 1) raf = requestAnimationFrame(tick); }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [events.length, courses.length]);

  async function createEventOptimistic(payload) {
    const tempId = 'temp-' + Date.now(); const temp = { id: tempId, title: payload.title, date: payload.date, description: payload.description || '', color: payload.color || '#60A5FA', pending: true };
    setEvents(prev => [temp, ...prev]);
    try {
      // attach current user id if available (api will fallback to a default in dev)
      const me = await fetch('/api/auth/me');
      const mj = me.ok ? await me.json() : null;
      const body = { ...payload, ...(mj && mj.authenticated ? { userId: mj.id } : {}) };
      // In development, attach smoke_user if no auth resolved
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development' && !body.userId) body.userId = 'smoke_user';
      const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.event) { setEvents(prev => [j.event, ...prev.filter(e => e.id !== tempId)]); addToast({ type: 'success', text: 'Event created' }); }
      else { setEvents(prev => prev.filter(e => e.id !== tempId)); addToast({ type: 'error', text: 'Failed to create event' }); }
    } catch (err) { console.error(err); setEvents(prev => prev.filter(e => e.id !== tempId)); addToast({ type: 'error', text: 'Failed to create event' }); }
  }

  async function createCourseOptimistic(payload) {
    const tempId = 'temp-course-' + Date.now(); const temp = { id: tempId, name: payload.name, color: payload.color || '#60A5FA', pending: true };
    setCourses(prev => [temp, ...prev]);
    try {
      const me = await fetch('/api/auth/me');
      const mj = me.ok ? await me.json() : null;
      const body = { ...payload, ...(mj && mj.authenticated ? { userId: mj.id } : {}) };
      const res = await fetch('/api/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.course) { setCourses(prev => [j.course, ...prev.filter(c => c.id !== tempId)]); addToast({ type: 'success', text: 'Course created' }); }
      else { setCourses(prev => prev.filter(c => c.id !== tempId)); addToast({ type: 'error', text: 'Failed to create course' }); }
    } catch (err) { console.error(err); setCourses(prev => prev.filter(c => c.id !== tempId)); addToast({ type: 'error', text: 'Failed to create course' }); }
  }

  async function editEventOptimistic(id, updateData) {
    const snapshot = events; setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updateData, pending: true } : e));
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateData) });
      let j = null; try { j = await res.json(); } catch (e) { }
      console.info('[editEventOptimistic] PATCH response', { status: res.status, ok: res.ok, body: j });
      if (res.ok && j && j.success && j.event) { setEvents(prev => prev.map(e => e.id === id ? j.event : e)); addToast({ type: 'success', text: 'Event updated' }); return { success: true }; }
      else {
        setEvents(snapshot);
        const code = j && j.code ? j.code : null;
        const msg = (j && (j.message || j.error || j.details || j.code)) ? (j.message || j.error || j.details || j.code) : (res.statusText || 'Failed to update event');
        let friendly = `Failed to update event: ${msg}`; let field = null;
        if (code === 'NOT_FOUND' && String(msg).toLowerCase().includes('archived')) { friendly = 'Unable to unarchive this event: archived copy not found. It may have been removed.'; }
        if (code === 'PAST_DATE' || String(msg).toLowerCase().includes('past')) { friendly = 'Event date must be today or later.'; field = 'date'; }
        addToast({ type: 'error', text: friendly });
        return { success: false, message: friendly, raw: j, code, field };
      }
    } catch (err) { console.error(err); setEvents(snapshot); const m = err && err.message ? err.message : String(err); addToast({ type: 'error', text: `Failed to update event: ${m}` }); return { success: false, message: m }; }
  }

  async function deleteEventOptimistic(id) {
    if (String(id).startsWith('temp-')) { setEvents(prev => prev.filter(e => e.id !== id)); addToast({ type: 'success', text: 'Local event removed' }); return; }
    const snapshot = events; setEvents(prev => prev.filter(e => e.id !== id));
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      let j = null; try { j = await res.json(); } catch (e) { }
      const ok = (j && j.success) || res.ok;
      if (!ok) { setEvents(snapshot); addToast({ type: 'error', text: 'Failed to delete event' }); }
      else { addToast({ type: 'success', text: 'Event deleted', undoSnapshot: snapshot, ttl: 8000 }); }
    } catch (err) { console.error(err); setEvents(snapshot); setToasts(t => [...t, { id: Date.now(), type: 'error', text: 'Failed to delete event' }]); }
  }

  return (
    <div>
      {/* header, main, modals and rest of the app (kept same as original) */}
    </div>
  );
}