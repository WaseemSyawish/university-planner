import React, { useState, useMemo, useEffect, useRef } from 'react';
import EditScopeModal from '@/components/Timetable/EditScopeModal';
import Head from 'next/head';
import { Calendar, Plus, ChevronLeft, ChevronRight, Trash2, Edit3, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AddEventModal from '@/components/schedule/_modals/add-event-modal';
import { parseDatePreserveLocal, buildLocalDateFromParts, toYMDLocal } from '../src/lib/dateHelpers';
import CustomModal from '@/components/ui/custom-modal';
import { useModal } from '@/providers/modal-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Using native select in this page for a simpler behavior; keep other UI helpers imported separately
import { Textarea } from '@/components/ui/textarea';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Load events from data/events.json and remove mock/sample data.
let persistedEvents = [];
try {
  // eslint-disable-next-line global-require
  const ev = require('../data/events.json');
  if (ev && Array.isArray(ev.events)) {
    persistedEvents = ev.events.filter(e => !e.archived).map(e => ({
      id: String(e.id),
      title: e.title || 'Untitled',
      // normalize date to YYYY-MM-DD if possible
      date: (e.date && typeof e.date === 'string') ? (e.date.length >= 10 ? e.date.slice(0, 10) : e.date) : '',
      startTime: e.time || e.startTime || '',
      endTime: e.endTime || '',
      type: e.type || 'event',
      location: e.location || '',
      description: e.description || '',
      color: (e.type === 'class' || e.type === 'timetable' || e.type === 'lecture') ? 'bg-primary' : (e.type === 'deadline' ? 'bg-error' : 'bg-secondary')
    }));
  }
} catch (err) {
  persistedEvents = [];
}

const publicHolidays = [
  { date: '2025-01-01', name: "New Year's Day" },
  { date: '2025-12-25', name: 'Christmas Day' }
];

function toYMD(d) {
  if (!d) return '';
  // If already in YYYY-MM-DD format string, return directly
  if (typeof d === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    // try parseable string -> fallthrough to Date
    d = new Date(d);
  }
  try {
    const date = d instanceof Date ? d : new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch (e) {
    return String(d).slice(0, 10);
  }
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState(persistedEvents);
  const [holidays, setHolidays] = useState([]);

  const [selectedDate, setSelectedDate] = useState(toYMD(new Date()));
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showEditScopeModal, setShowEditScopeModal] = useState(false);
  const [pendingSavePayload, setPendingSavePayload] = useState(null);
  const [pendingEventId, setPendingEventId] = useState(null);
  const [showDeleteScopeModal, setShowDeleteScopeModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState(null);
  const [newEvent, setNewEvent] = useState({ title: '', date: toYMD(new Date()), startTime: '', endTime: '', type: 'event', location: '', description: '', color: 'bg-blue-500' });
  const gridRef = useRef(null);
  const createBtnRef = useRef(null);
  const [showDebug, setShowDebug] = useState(false);
  const { setOpen, setClose } = useModal();

  // Toast notifications local to Calendar page
  const [toast, setToast] = useState(null);
  function showToast(message, type = 'info', ms = 3500) {
    setToast({ message, type });
    setTimeout(() => setToast(null), ms);
  }

  useEffect(() => {
    // If a ?date=YYYY-MM-DD param is present, navigate the calendar to that date on mount
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const qd = params.get('date');
        if (qd && /^\d{4}-\d{2}-\d{2}$/.test(qd)) {
          const [y, m, d] = qd.split('-').map(n => Number(n));
          if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
            const parsed = new Date(y, m - 1, d);
            setCurrentDate(parsed);
            setSelectedDate(qd);
          }
        }
      }
    } catch (e) { /* ignore */ }

    let cancelled = false;
    const y = currentDate.getFullYear();
    const range = `${y}-${y + 1}`;
    (async () => {
      try {
        const res = await fetch(`/api/holidays?year=${encodeURIComponent(range)}&country=IQ`);
        if (!res.ok) throw new Error('holidays fetch failed');
        const payload = await res.json();
        if (cancelled) return;
        const list = Array.isArray(payload?.holidays) ? payload.holidays : (payload?.data || []);
        const normalized = list.map(h => ({ ...h, date: toYMD(h.date || h.localDate || h.localName) }));
        setHolidays(normalized.filter(h => h && h.date));
      } catch (e) {
        console.warn('Failed to load holidays from API, using local fallback', e);
        setHolidays([]);
      }
    })();

    const onKey = (e) => { if (e.key === 'd' || e.key === 'D') setShowDebug(s => !s); };
    window.addEventListener('keydown', onKey);

    return () => { cancelled = true; window.removeEventListener('keydown', onKey); };
  }, [currentDate]);

  // initialize newEvent color from last user selection, if available
  useEffect(() => {
    try {
      const last = typeof window !== 'undefined' ? localStorage.getItem('up:lastEventColor') : null;
      if (last) setNewEvent(prev => ({ ...prev, color: last }));
    } catch (e) { }
  }, []);

  // keep newEvent.color consistent for 'class' type: use legend color bg-primary unless user overrides
  useEffect(() => {
    try {
      if (newEvent.type === 'class' || newEvent.type === 'timetable') {
        setNewEvent(prev => ({ ...prev, color: prev.color && prev.color.startsWith('bg-') ? prev.color : 'bg-primary' }));
      }
    } catch (e) { }
  }, [newEvent.type]);

  // Open the create-event modal prefilled for today
  const handleTodayCreate = () => {
    const today = new Date();
    const ymd = toYMD(today);
    // navigate calendar to today
    setCurrentDate(today);
    // clear any selected event and prefill the newEvent for today
    setSelectedEvent(null);
    setNewEvent(prev => ({ ...prev, title: '', date: ymd, startTime: '', endTime: '', type: 'event', location: '', description: '' }));
    setSelectedDate(ymd);
    // Open the standardized AddEventModal via the global modal provider
    try {
      // compute anchor rect from the Create button so the modal can animate/originate from that point
      const rect = createBtnRef.current && typeof createBtnRef.current.getBoundingClientRect === 'function'
        ? createBtnRef.current.getBoundingClientRect()
        : null;
      setOpen(
        <CustomModal title="Add Event">
          <AddEventModal />
        </CustomModal>,
        async () => ({ default: { title: '', startDate: ymd, endDate: ymd, time: '', type: 'event', location: '', description: '' }, anchor: rect }),
        'default'
      );
    } catch (e) {
      // fallback to legacy local dialog
      setShowEventModal(true);
    }
  };

  // Handler when user confirms scope in EditScopeModal
  async function handleScopeConfirm(scope) {
    setShowEditScopeModal(false);
    try {
      if (!pendingSavePayload || !pendingEventId) return;
      const ev = selectedEvent || events.find(e => String(e.id) === String(pendingEventId)) || {};
      let tplId = ev.template_id || (ev.raw && (ev.raw.template_id || ev.raw.templateId)) || null;

      // If single, do a single-item patch immediately
      if (scope === 'single') {
        const res = await fetch(`/api/events/${encodeURIComponent(pendingEventId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pendingSavePayload) });
        if (!res.ok) throw new Error('Update failed');
      } else {
        // For 'all' or 'future', try to discover template id if missing by fetching server record
        if (!tplId) {
          try {
            const serverEvRes = await fetch(`/api/events/${encodeURIComponent(pendingEventId)}`);
            if (serverEvRes && serverEvRes.ok) {
              const payload = await serverEvRes.json().catch(() => null);
              const serverEv = payload && payload.event ? payload.event : payload;
              tplId = serverEv && (serverEv.template_id || (serverEv.raw && (serverEv.raw.template_id || serverEv.raw.templateId)) || serverEv.templateId) || null;
            }
          } catch (e) { tplId = tplId || null; }
        }

        // If we have a template id, prefer server-side scoped PATCH and include templateId
        if (tplId) {
          const qs = `scope=${encodeURIComponent(scope)}${tplId ? `&templateId=${encodeURIComponent(tplId)}` : ''}`;
          const url = `/api/events/${encodeURIComponent(pendingEventId)}?${qs}`;
          const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pendingSavePayload) });
          let resJson = null;
          try { resJson = await res.json().catch(() => null); } catch (e) { resJson = null; }
          try { console.debug('[calendar] server scoped PATCH response', { ok: res.ok, status: res.status, body: resJson }); } catch (e) {}
          if (!res.ok) {
            console.warn('Server scoped update failed (%s), falling back to client bulk update', res.status);
            // fall through to client-side bulk apply below
          } else {
            // server succeeded; inspect response and, if it updated only one row,
            // perform client-side bulk fallback similar to delete behavior.
            try {
              const bodyJson = resJson || null;
              const details = bodyJson && (bodyJson.details || bodyJson) ? (bodyJson.details || bodyJson) : null;
              const updatedCount = (details && (Number(details.updatedActive || 0) + Number(details.updatedArchived || 0))) || 0;
              if (updatedCount <= 1) {
                console.warn('[calendar] server-side series update changed <=1 rows, running client-side bulk fallback');
                try {
                  const listResp = await fetch('/api/events');
                  const listJson = listResp && listResp.ok ? await listResp.json().catch(() => null) : null;
                  const eventsList = Array.isArray(listJson?.events) ? listJson.events : (Array.isArray(listJson) ? listJson : []);

                  const normalize = (s) => (s || '').toString().trim().toLowerCase();
                  const tplIdLocal = tplId;
                  const targetTitle = normalize(ev && ev.title ? ev.title : '');
                  const targetTime = (ev && ev.time) ? String(ev.time).slice(0,2) : null;

                  const toPatch = eventsList.filter((e) => {
                    try {
                      const evTpl = e && (e.template_id || (e.raw && (e.raw.template_id || e.raw.templateId))) || null;
                      if (tplIdLocal && evTpl && String(evTpl) === String(tplIdLocal)) return true;
                      try {
                        const meta = e && e.meta ? e.meta : (e.raw && e.raw.meta ? e.raw.meta : null);
                        if (meta && (meta.repeatOption || meta.repeat_option || meta.repeatoption) && ev && (ev.repeatOption || (ev.raw && ev.raw.repeatOption))) {
                          const targ = String(ev.repeatOption || (ev.raw && ev.raw.repeatOption) || '').trim();
                          const candidate = String(meta.repeatOption || meta.repeat_option || meta.repeatoption || '').trim();
                          if (targ && candidate && String(targ) === String(candidate)) return true;
                        }
                      } catch (e) {}
                      try {
                        const desc = e.description || (e.raw && e.raw.description) || '';
                        const m = String(desc).match(/\[META\]([\s\S]*?)\[META\]/);
                        if (m && m[1]) {
                          try { const parsed = JSON.parse(m[1]); if (parsed && parsed.template_id && tplIdLocal && String(parsed.template_id) === String(tplIdLocal)) return true; } catch (e) {}
                        }
                      } catch (e) {}
                      const sameTitle = targetTitle && normalize(e.title || e.subject || '') === targetTitle;
                      if (!sameTitle) return false;
                      if (targetTime) {
                        const eTime = e.time || e.startTime || e.start_time || (e.raw && (e.raw.time || e.raw.startTime || e.raw.start_time)) || null;
                        if (!eTime) return false;
                        return String(eTime).slice(0,2) === String(targetTime);
                      }
                      return true;
                    } catch (er) { return false; }
                  });

                  try { console.debug('[calendar] client bulk fallback candidates:', toPatch.length, toPatch.map(x => x && x.id)); } catch (e) {}
                  for (const p of toPatch) {
                    try { await fetch(`/api/events/${encodeURIComponent(p.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pendingSavePayload) }); } catch (e) { console.warn('Bulk update failed for event', p && p.id, e); }
                  }
                  try {
                    const r2 = await fetch('/api/events');
                    if (r2.ok) {
                      const pl = await r2.json();
                      const listNorm = Array.isArray(pl?.events) ? pl.events : (Array.isArray(pl) ? pl : []);
                      const preserved = (events || []).filter(ev => String(ev.id).startsWith('tmp-'));
                      setEvents([...listNorm, ...preserved]);
                    } else {
                      // fallback to reload page
                      try { if (typeof window !== 'undefined') window.location.reload(); } catch (e) {}
                    }
                  } catch (e) { try { if (typeof window !== 'undefined') window.location.reload(); } catch (ee) {} }
                } catch (e) {
                  console.warn('[calendar] client-side bulk fallback failed', e);
                }
              }
            } catch (e) {
              console.warn('[calendar] inspect response failed', e);
            }
            tplId = tplId; // keep tplId
          }
        }

        // If tplId is missing or server-side scoped PATCH failed, perform client-side bulk apply.
        try {
          const listResp = await fetch('/api/events');
          const listJson = listResp && listResp.ok ? await listResp.json().catch(() => null) : null;
          const eventsList = Array.isArray(listJson?.events) ? listJson.events : (Array.isArray(listJson) ? listJson : []);

          // heuristics for matching series when template_id is not present:
          // 1) events with same template_id (if any)
          // 2) events whose embedded [META] json contains same template_id
          // 3) events with same title and same time
          const baseDateStr = ev.date || (ev.raw && ev.raw.date) || ev.startDate || null;
          const baseYMD = baseDateStr ? toYMD(baseDateStr) : null;

          const toPatch = eventsList.filter(ei => {
            try {
              const evTpl = ei && (ei.template_id || (ei.raw && (ei.raw.template_id || ei.raw.templateId))) || null;
              if (tplId && evTpl && String(evTpl) === String(tplId)) return true;

              // check embedded META JSON for template_id
              try {
                const desc = ei.description || (ei.raw && ei.raw.description) || '';
                const m = String(desc).match(/\[META\]([\s\S]*?)\[META\]/);
                if (m && m[1]) {
                  try { const parsed = JSON.parse(m[1]); if (parsed && (parsed.template_id || parsed.templateId) && tplId && String(parsed.template_id || parsed.templateId) === String(tplId)) return true; } catch (e) {}
                }
              } catch (e) {}

              // fallback: match by title and time
              const titleMatch = pendingSavePayload && pendingSavePayload.title ? String(ei.title || ei.subject || '').trim() === String(pendingSavePayload.title).trim() : false;
              const timeMatch = pendingSavePayload && pendingSavePayload.time ? String(ei.time || ei.startTime || ei.start_time || (ei.raw && (ei.raw.time || ei.raw.startTime || ei.raw.start_time)) || '').slice(0,5) === String(pendingSavePayload.time || '').slice(0,5) : false;
              if (titleMatch && timeMatch) {
                if (scope === 'future') {
                  if (!baseYMD) return false;
                  const candidateDate = ei.date || ei.startDate || ei.start_date || null;
                  if (!candidateDate) return false;
                  return toYMD(candidateDate) >= baseYMD;
                }
                return true;
              }

              return false;
            } catch (e) { return false; }
          });

          for (const p of toPatch) {
            try { await fetch(`/api/events/${encodeURIComponent(p.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pendingSavePayload) }); } catch (e) { console.warn('Bulk update failed for event', p && p.id, e); }
          }
        } catch (e) { console.warn('Fallback bulk update failed', e); }
      }

      // Refresh authoritative list from server after scoped operation
      try {
        const r = await fetch('/api/events');
        if (r.ok) {
          const pl = await r.json();
          const listNorm = Array.isArray(pl?.events) ? pl.events : (Array.isArray(pl) ? pl : []);
          const normalized = listNorm.map(e => ({
            id: String(e.id),
            title: e.title || pendingSavePayload.title || 'Untitled',
            date: (e.date && typeof e.date === 'string') ? (e.date.length >= 10 ? e.date.slice(0, 10) : e.date) : (e.date ? e.date : ''),
            startTime: e.time || e.startTime || '',
            endTime: e.endTime || '',
            type: e.type || 'event',
            location: e.location || '',
            description: e.description || '',
            color: (e.type === 'class' || e.type === 'lecture') ? 'bg-primary' : (e.type === 'deadline' ? 'bg-error' : 'bg-secondary'),
            template_id: e.template_id || e.templateId || null,
            repeatOption: e.repeatOption || e.repeat_option || null,
            raw: e
          }));
          const preserved = (events || []).filter(ev => String(ev.id).startsWith('tmp-'));
          setEvents([...normalized, ...preserved]);
        }
      } catch (e) { /* ignore refresh errors */ }
    } catch (e) {
      console.warn('Scope update failed', e);
      showToast('Update failed', 'error');
    } finally {
      setPendingSavePayload(null);
      setPendingEventId(null);
    }
  }

  // Load events from server (Prisma-backed) on mount. Keep any temporary/timetable placeholders.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/events');
        if (!res.ok) throw new Error('failed to fetch events');
        const payload = await res.json();
        const list = Array.isArray(payload?.events) ? payload.events : (payload?.events || []);
        if (cancelled) return;
        const normalized = list.map(e => ({
          id: String(e.id),
          title: e.title || 'Untitled',
          date: (e.date && typeof e.date === 'string') ? (e.date.length >= 10 ? e.date.slice(0, 10) : e.date) : (e.date ? e.date : ''),
          startTime: e.time || e.startTime || '',
          endTime: e.endTime || '',
          type: e.type || 'event',
          location: e.location || '',
          description: e.description || '',
          color: (e.type === 'class' || e.type === 'lecture') ? 'bg-primary' : (e.type === 'deadline' ? 'bg-error' : 'bg-secondary'),
          template_id: e.template_id || e.templateId || null,
          repeatOption: e.repeatOption || e.repeat_option || null,
          raw: e
        }));
        // preserve any client-only temporary or timetable entries already in memory
        setEvents(prev => {
          const preserved = (prev || []).filter(ev => String(ev.id).startsWith('tmp-') || String(ev.id).startsWith('tt-') || String(ev.id).startsWith('tpl-'));
          return [...normalized, ...preserved];
        });
      } catch (err) {
        console.warn('Could not load events from server, using local snapshot', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Helper: compute end time by adding hours (duration) to a HH:MM start string
  const computeEndTime = (start, durationHours = 1) => {
    if (!start || !/^\d{2}:\d{2}$/.test(start)) return '';
    const [hh, mm] = start.split(':').map(Number);
    const total = hh * 60 + mm + Math.round(Number(durationHours) * 60);
    const endH = Math.floor((total % (24 * 60)) / 60);
    const endM = total % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  // Load timetable (lectures) and merge into events as type 'class'.
  // Supports weekly repetition via `dayOfWeek` (0-6) or `repeatOption==='weekly'` with a `dayOfWeek` field.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/timetable');
        if (!res.ok) throw new Error('timetable fetch failed');
        const classes = await res.json();
        if (cancelled || !Array.isArray(classes)) return;

        // Build visible date range from month grid so repeating classes appear in the currently visible month view
        const gridDays = getDaysInMonth(currentDate);
        const visibleDates = new Set(gridDays.map(d => toYMD(d.date)));

        const occurrences = [];

        for (const c of classes) {
          // Support two template shapes:
          // 1) simple template objects with c.dayOfWeek/c.time
          // 2) templates with a `payload` array where each module contains its own dayOfWeek/time
          const tplStart = c.time || '';
          const tplEnd = tplStart ? computeEndTime(tplStart, c.duration || 1) : '';

          // Helper to push a mapped occurrence
          const pushOccurrence = (oid, title, dateStr, startTime, endTime, moduleRaw) => {
            occurrences.push({
              id: oid,
              title: title || c.subject || c.title || 'Class',
              date: dateStr,
              startTime: startTime || tplStart,
              endTime: endTime || (startTime ? computeEndTime(startTime, (moduleRaw && moduleRaw.duration) || c.duration || 1) : tplEnd),
              type: 'timetable',
              location: (moduleRaw && (moduleRaw.location || c.location)) || c.location || '',
              description: (moduleRaw && (moduleRaw.instructor ? `Instructor: ${moduleRaw.instructor}` : (moduleRaw.description || c.description))) || (c.instructor ? `Instructor: ${c.instructor}` : (c.description || '')),
              color: (moduleRaw && moduleRaw.color) || c.color || 'bg-primary',
              template_id: c.id,
              repeatOption: c.repeatOption || c.repeat_option || null,
              raw: moduleRaw || c
            });
          };

          // If template has a payload of modules, expand each module
          if (Array.isArray(c.payload) && c.payload.length > 0) {
            for (let mi = 0; mi < c.payload.length; mi++) {
              const mod = c.payload[mi] || {};
              const moduleDow = (typeof mod.dayOfWeek === 'number') ? mod.dayOfWeek : (typeof mod.dow === 'number' ? mod.dow : null);
              const moduleDate = mod.date || mod.startDate || null;
              const moduleTime = mod.time || mod.startTime || tplStart;
              const moduleEnd = moduleTime ? computeEndTime(moduleTime, mod.duration || c.duration || 1) : tplEnd;

              if (moduleDow != null) {
                for (const dObj of gridDays) {
                  if (dObj.date.getDay() === moduleDow) {
                    const d = toYMD(dObj.date);
                    if (visibleDates.has(d)) pushOccurrence(`tt-${String(c.id)}-${mi}-${d}`, mod.subject || c.subject || c.title, d, moduleTime, moduleEnd, mod);
                  }
                }
                continue;
              }

              if (moduleDate) {
                const d = (typeof moduleDate === 'string' && moduleDate.length >= 10) ? moduleDate.slice(0, 10) : toYMD(moduleDate);
                if (visibleDates.has(d)) pushOccurrence(`tt-${String(c.id)}-${mi}-${d}`, mod.subject || c.subject || c.title, d, moduleTime, moduleEnd, mod);
                continue;
              }
            }
            continue;
          }

          // If class explicitly has a date and is not marked to repeat, just include it if visible
          const start = tplStart;
          const end = tplEnd;
          if (c.date && !c.repeat && !(c.repeatOption || c.repeat_option) && c.dayOfWeek == null) {
            const d = (typeof c.date === 'string' && c.date.length >= 10) ? c.date.slice(0, 10) : toYMD(c.date);
            if (visibleDates.has(d)) {
              pushOccurrence(`tt-${String(c.id)}`, c.subject || c.title || 'Class', d, start, end, c);
            }
            continue;
          }

          // If class is a weekly template (has dayOfWeek or repeatOption that indicates weekly), expand across visible dates
          // Accept both 'weekly' and 'every-week' style values
          const repeatOpt = c.repeatOption || c.repeat_option || null;
          const repeatIsWeekly = typeof repeatOpt === 'string' && (repeatOpt === 'weekly' || /every[-_]?(week|weekly)/i.test(repeatOpt));
          const dow = (typeof c.dayOfWeek === 'number') ? c.dayOfWeek : (repeatIsWeekly && typeof c.dayOfWeek === 'number' ? c.dayOfWeek : null);
          if (dow != null) {
            for (const dObj of gridDays) {
              if (dObj.date.getDay() === dow) {
                const d = toYMD(dObj.date);
                pushOccurrence(`tt-${String(c.id)}-${d}`, c.subject || c.title || 'Class', d, start, end, c);
              }
            }
            continue;
          }

          // Fallback: if no repeat info, include single date if visible
          if (c.date) {
            const d = (typeof c.date === 'string' && c.date.length >= 10) ? c.date.slice(0, 10) : toYMD(c.date);
            if (visibleDates.has(d)) {
              pushOccurrence(`tt-${String(c.id)}`, c.subject || c.title || 'Class', d, start, end, c);
            }
          }
        }

        // Merge into events state, dedupe by id. If an incoming timetable occurrence
        // matches an existing server event by title/date/startTime, update that
        // server event to be a lecture (so calendar and timetable stay in sync).
        setEvents(prev => {
          const existingIds = new Set(prev.map(e => String(e.id)));
          const merged = [...prev];
          occurrences.forEach(o => {
            // If an event with the same canonical id already exists, skip adding
            if (existingIds.has(String(o.id))) return;

            // Look for an existing server event that matches by title, date and startTime
            const clashIndex = merged.findIndex(p => p.title === o.title && p.date === o.date && (p.startTime || '') === (o.startTime || ''));
            if (clashIndex !== -1) {
              // Promote the existing event to a lecture/timetable entry so visuals match
              merged[clashIndex] = {
                ...merged[clashIndex],
                type: 'lecture',
                color: o.color || 'bg-primary',
                template_id: o.template_id || o.templateId || null,
                repeatOption: o.repeatOption || o.repeat_option || null,
                raw: o.raw || o
              };
              return;
            }

            // also avoid exact title/date/time duplicates against the original prev array
            const clash = prev.find(p => p.title === o.title && p.date === o.date && (p.startTime || '') === (o.startTime || ''));
            if (clash) {
              // update preserved existing event to include timetable/template metadata so it is treated as a series
              const idx = merged.findIndex(p => String(p.id) === String(clash.id));
              if (idx !== -1) {
                merged[idx] = {
                  ...merged[idx],
                  type: 'lecture',
                  color: o.color || 'bg-primary',
                  template_id: o.template_id || o.templateId || null,
                  repeatOption: o.repeatOption || o.repeat_option || null,
                  raw: o.raw || o
                };
              }
              return;
            }

            merged.push(o);
          });
          return merged;
        });
      } catch (e) {
        console.warn('Failed to load timetable classes', e);
      }
    })();

    return () => { cancelled = true; };
  }, [currentDate]);

  useEffect(() => {
  // Force icons visible with JavaScript
  const interval = setInterval(() => {
    const buttons = document.querySelectorAll('.calendar-root aside button svg');
    buttons.forEach(svg => {
      svg.style.stroke = '#ffffff';
      svg.style.fill = 'none';
      svg.style.display = 'block';
      svg.style.opacity = '1';
      svg.style.visibility = 'visible';
      
      // Force paths too
      const paths = svg.querySelectorAll('path');
      paths.forEach(path => {
        path.style.stroke = '#ffffff';
        path.style.strokeWidth = '2px';
        path.style.fill = 'none';
        path.style.opacity = '1';
        path.style.visibility = 'visible';
      });
    });
  }, 100);
  
  return () => clearInterval(interval);
}, []);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay();
    const days = [];

    // leading days from previous month
    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(year, month, i - startWeekday + 1);
      days.push({ date: d, isCurrentMonth: false });
    }

    // current month days
    for (let i = 1; i <= daysInMonth; i++) days.push({ date: new Date(year, month, i), isCurrentMonth: true });

    // Always render 6 rows (42 cells) so the calendar grid has a consistent height
    // across all months. This keeps layout stable and prevents jumps when months
    // require 5 vs 6 weeks.
    // Previously the calendar always forced 6 rows (42 cells). That produced
    // unnecessary grey rows for many months. Instead, append only enough
    // trailing days from the next month to complete the final week.
    // Determine how many trailing days are needed so the last calendar row
    // ends on Saturday (weekday 6). If the month's last day is Saturday,
    // no trailing days are added.
    const lastWeekday = lastDay.getDay(); // 0 (Sun) - 6 (Sat)
    const trailingDays = lastWeekday === 6 ? 0 : (6 - lastWeekday);

    for (let i = 1; i <= trailingDays; i++) {
      const next = new Date(year, month + 1, i);
      days.push({ date: next, isCurrentMonth: false });
    }

    return days;
  };

  const days = useMemo(() => getDaysInMonth(currentDate), [currentDate]);

  // Dynamically compute and set the --calendar-row-height CSS variable on the
  // grid element so the 6-row visual height fits the viewport precisely.
  useEffect(() => {
    if (!gridRef || !gridRef.current) return;

    function computeRowHeight() {
      try {
        const gridEl = gridRef.current;
        const rect = gridEl.getBoundingClientRect();
        const top = rect.top; // distance from viewport top to grid
        const available = window.innerHeight - top - 48; // leave larger bottom gap for visible padding

        // gaps between rows: 5 gaps (6 rows) * gap px
        const gapPx = (window.matchMedia('(max-width:900px)').matches ? 4 : 6);
        const gapTotal = gapPx * 5;

        // compute ideal per-row height to exactly fill available space
        const rawRow = Math.floor((available - gapTotal) / 6);

        // clamp to sensible bounds so rows don't become tiny or huge
        const row = Math.max(48, Math.min(84, rawRow));

        gridEl.style.setProperty('--calendar-row-height', `${row}px`);
        // ensure the grid uses the computed height visually (CSS calc uses var)
        // (no need to set height here because CSS already computes it using the var)
      } catch (e) {
        // ignore measurement errors
      }
    }

    computeRowHeight();
    window.addEventListener('resize', computeRowHeight);
    const mo = new MutationObserver(computeRowHeight);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { window.removeEventListener('resize', computeRowHeight); mo.disconnect(); };
  }, [currentDate, gridRef]);

  const getEventsForDate = (date) => {
    const ymd = toYMD(date);
    return events.filter(ev => toYMD(ev.date) === ymd).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  };

  const isHoliday = (date) => {
    const ymd = toYMD(date);
    if (holidays && holidays.length) return holidays.find(h => toYMD(h.date) === ymd) || null;
    return publicHolidays.find(h => h.date === ymd) || null;
  };

  const isToday = (date) => toYMD(date) === toYMD(new Date());

  const navigateMonth = (dir) => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1));

  const handleDateClick = (date) => {
    const ymd = toYMD(date);
    setSelectedDate(ymd);
  };

  const handleEventClick = (e, ev) => {
    e.stopPropagation();
    setSelectedEvent(ev);
    setNewEvent({ title: ev.title, date: toYMD(ev.date), startTime: ev.startTime || '', endTime: ev.endTime || '', type: ev.type || 'event', location: ev.location || '', description: ev.description || '', color: ev.color || 'bg-blue-500' });
    try {
      setOpen(
        <CustomModal title="Edit Event">
          <AddEventModal />
        </CustomModal>,
        async () => ({ default: ev }),
        'default'
      );
    } catch (err) {
      setShowEventModal(true);
    }
  };

  const resetForm = () => setNewEvent({ title: '', date: selectedDate || toYMD(new Date()), startTime: '', endTime: '', type: 'event', location: '', description: '', color: 'bg-blue-500' });

  const handleCreateEvent = () => {
    if (!newEvent.title || !newEvent.date) return;
    const tempId = `tmp-${Date.now()}`;
    const temp = { id: tempId, ...newEvent };
    setEvents(prev => [...prev, temp]);
    setShowEventModal(false);
    resetForm();

    (async () => {
      try {
        const isDev = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');
        const body = {
          title: newEvent.title,
          date: newEvent.date,
          time: newEvent.startTime || null,
          color: newEvent.color || null,
          type: newEvent.type || 'event',
          location: newEvent.location || null,
          description: newEvent.description || null
        };
        // attach client-computed ISO instants so server doesn't have to guess timezone
        try {
          const s = buildLocalDateFromParts(newEvent.date, newEvent.startTime);
          if (s && !isNaN(s.getTime())) body.startDate = s.toISOString();
          if (newEvent.endTime) {
            const e = buildLocalDateFromParts(newEvent.date, newEvent.endTime);
            if (e && !isNaN(e.getTime())) body.endDate = e.toISOString();
          } else if (body.startDate) {
            const st = new Date(body.startDate);
            if (!isNaN(st.getTime())) body.endDate = new Date(st.getTime() + 30 * 60000).toISOString();
          }
        } catch (e) { /* ignore and send body without instants */ }
        if (isDev) body.userId = 'smoke_user';
        const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error('create failed');
        const json = await res.json();
        const created = json.event || json;
        // If server materialized multiple occurrences, refresh full list so all appear
        if (created && created._materialized_count && Number(created._materialized_count) > 1) {
          try {
            const r = await fetch('/api/events');
            if (r.ok) {
              const pl = await r.json();
              const list = Array.isArray(pl?.events) ? pl.events : (Array.isArray(pl) ? pl : []);
              const normalized = list.map(e => ({ id: String(e.id), title: e.title || body.title, date: e.date || body.date, startTime: e.time || '', endTime: e.endTime || '', type: e.type || body.type || 'event', location: e.location || '', description: e.description || '', color: e.color || ((e.type === 'class' || e.type === 'timetable' || e.type === 'lecture') ? 'bg-primary' : (e.type === 'deadline' ? 'bg-error' : 'bg-secondary')) }));
              // preserve temp items
              const preserved = (events || []).filter(ev => String(ev.id).startsWith('tmp-'));
              setEvents([...normalized, ...preserved]);
              return;
            }
          } catch (e) { /* ignore and fall back to single mapping */ }
        }
        const mapped = {
          id: String(created.id),
          title: created.title || body.title,
          date: created.date || body.date,
          // prefer server-provided ISO instants when present
          startDate: created.startDate || body.startDate || null,
          endDate: created.endDate || body.endDate || null,
          startTime: created.time || body.time || (created.startDate ? (created.startDate.split('T')[1] || '').slice(0,5) : ''),
          endTime: created.endTime || (created.endDate ? (created.endDate.split('T')[1] || '').slice(0,5) : '') || '',
          type: created.type || body.type || 'event',
          location: created.location || '',
          description: created.description || '',
          color: created.color || body.color || 'bg-secondary'
        };
        setEvents(prev => prev.map(p => p.id === tempId ? mapped : p));
      } catch (err) {
        console.error('Failed to create event on server', err);
      }
    })();
  };

  const handleUpdateEvent = () => {
    if (!selectedEvent) return;
    const id = selectedEvent.id;
    // Optimistically update UI but keep a snapshot for rollback on failure
    const prevEvents = events;
    setEvents(prev => prev.map(ev => ev.id === id ? { ...ev, ...newEvent } : ev));
    setSelectedEvent(null);
    setShowEventModal(false);
    resetForm();

    (async () => {
      try {
        const payload = {
          title: newEvent.title,
          date: newEvent.date,
          time: newEvent.startTime || null,
          location: newEvent.location || null,
          description: newEvent.description || null
        };
        // attach client-computed ISO instants to update payload
        try {
          const s = buildLocalDateFromParts(newEvent.date, newEvent.startTime);
          if (s && !isNaN(s.getTime())) payload.startDate = s.toISOString();
          if (newEvent.endTime) {
            const e = buildLocalDateFromParts(newEvent.date, newEvent.endTime);
            if (e && !isNaN(e.getTime())) payload.endDate = e.toISOString();
          } else if (payload.startDate) {
            const st = new Date(payload.startDate);
            if (!isNaN(st.getTime())) payload.endDate = new Date(st.getTime() + 30 * 60000).toISOString();
          }
        } catch (e) { /* ignore */ }
        const isDev = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');
        if (isDev) payload.userId = 'smoke_user';

        // If this event appears to be part of a series, show scope chooser
        const evAny = selectedEvent || {};
        // Try to discover template id from various places including embedded [META] JSON in description
        const extractTplFromDescription = (obj) => {
          try {
            if (!obj) return null;
            if (obj.template_id) return obj.template_id;
            if (obj.templateId) return obj.templateId;
            if (obj.raw && (obj.raw.template_id || obj.raw.templateId)) return obj.raw.template_id || obj.raw.templateId;
            const desc = obj.description || (obj.raw && obj.raw.description) || '';
            if (desc && typeof desc === 'string') {
              const m = String(desc).match(/\[META\]([\s\S]*?)\[META\]/);
              if (m && m[1]) {
                try { const parsed = JSON.parse(m[1]); return parsed?.template_id || parsed?.templateId || null; } catch (e) { return null; }
              }
            }
          } catch (e) { /* ignore */ }
          return null;
        };
        const tplId = extractTplFromDescription(evAny) || null;
        const isSeries = !!(evAny && (evAny.repeatOption || tplId));
        if (isSeries) {
          // store pending state and show the EditScopeModal component
          setPendingSavePayload(payload);
          setPendingEventId(id);
          setShowEditScopeModal(true);
          return;
        }

        // Default single update
        const res = await fetch(`/api/events/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) {
          // try to parse error body for friendly message
          let body = null;
          try { body = await res.json(); } catch (e) { body = null; }
          const friendly = (body && (body.message || body.error || body.details)) ? (body.message || body.error || body.details) : `Update failed (${res.status})`;
          // rollback optimistic update
          setEvents(prevEvents);
          showToast(friendly, 'error');
          console.error('Failed to update event on server', res.status, body);
          return;
        }
        const json = await res.json();
        const updated = json.event || json;
        setEvents(prev => prev.map(ev => ev.id === id ? {
          ...ev,
          title: updated.title || ev.title,
          date: updated.date || ev.date,
          // prefer updated ISO instants when returned
          startDate: updated.startDate || ev.startDate,
          endDate: updated.endDate || ev.endDate,
          startTime: updated.time || ev.startTime || (updated.startDate ? (updated.startDate.split('T')[1] || '').slice(0,5) : ev.startTime),
          endTime: updated.endTime || (updated.endDate ? (updated.endDate.split('T')[1] || '').slice(0,5) : ev.endTime),
          location: updated.location || ev.location,
          description: updated.description || ev.description
        } : ev));
      } catch (err) {
        // network or unexpected error -> rollback
        setEvents(prevEvents);
        console.error('Failed to update event on server', err);
        showToast('Network error while updating event. Changes were not saved.', 'error');
      }
    })();
  };

  // Accept optional event parameter so callers that have the event available
  // can delete immediately without relying on state update timing.
  const handleDeleteEvent = (evParam) => {
    const target = evParam || selectedEvent;
    if (!target) return;
    const id = target.id;

    // If this event appears to be part of a series/template, prompt for scope
    const tplId = target && (target.template_id || (target.raw && (target.raw.template_id || target.raw.templateId))) || null;
    // Fallback: treat timetable-derived ids ('tt-...') as series because they come from timetable templates
    const isTimetableId = String(id || '').startsWith('tt-');
    const isSeries = !!(target && (target.repeatOption || tplId || isTimetableId));

    // Debug info to help verify why the modal shows or not — remove in production
    try { console.debug('[calendar] handleDeleteEvent target:', { id: id, tplId, repeatOption: target && target.repeatOption, isTimetableId }); } catch (e) { }
    if (isSeries) {
      // store pending id and show delete-scope chooser
      setPendingDeleteId(id);
      setPendingDeleteEvent(target);
      setShowDeleteScopeModal(true);
      // show a visible toast so it's obvious in the UI that the scope chooser should open
      try { showToast(`Series event detected. Showing scope chooser (id=${id})`, 'info', 5000); } catch (e) { }
      // keep selection/modal state as-is until user confirms
      return;
    }

    // Non-series: Optimistically remove from UI
    setEvents(prev => prev.filter(ev => ev.id !== id));
    // If the deleted event was selected in the modal, clear selection
    if (selectedEvent && String(selectedEvent.id) === String(id)) setSelectedEvent(null);
    setShowEventModal(false);

    (async () => {
      try {
        const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          // If server delete failed, reload events from server to recover authoritative state
          console.error('Server refused delete, reloading events');
          try {
            const r = await fetch('/api/events');
            if (r.ok) {
              const payload = await r.json();
              const list = Array.isArray(payload?.events) ? payload.events : (payload?.events || []);
              setEvents(list.map(e => ({
                id: String(e.id),
                title: e.title || 'Untitled',
                date: (e.date && typeof e.date === 'string') ? (e.date.length >= 10 ? e.date.slice(0, 10) : e.date) : (e.date ? e.date : ''),
                startTime: e.time || e.startTime || '',
                endTime: e.endTime || '',
                type: e.type || 'event',
                location: e.location || '',
                description: e.description || '',
                template_id: e.template_id || e.templateId || null,
                repeatOption: e.repeatOption || e.repeat_option || null,
                raw: e
              })));
            }
          } catch (e) { console.warn('Failed to reload events after delete failure', e); }
        }
      } catch (err) {
        console.error('Failed to delete event on server', err);
      }
    })();
  };

  // Handler when user confirms scope for delete
  async function handleDeleteScopeConfirm(scope) {
    setShowDeleteScopeModal(false);
    try {
      if (!pendingDeleteId) return;
      const id = pendingDeleteId;
      if (scope === 'single') {
        // remove locally then delete
        setEvents(prev => prev.filter(ev => ev.id !== id));
        if (selectedEvent && String(selectedEvent.id) === String(id)) setSelectedEvent(null);
        setShowEventModal(false);
        const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          console.error('Server refused delete, reloading events');
          try {
            const r = await fetch('/api/events');
            if (r.ok) {
              const payload = await r.json();
              const list = Array.isArray(payload?.events) ? payload.events : (payload?.events || []);
              setEvents(list.map(e => ({
                id: String(e.id),
                title: e.title || 'Untitled',
                date: (e.date && typeof e.date === 'string') ? (e.date.length >= 10 ? e.date.slice(0, 10) : e.date) : (e.date ? e.date : ''),
                startTime: e.time || e.startTime || '',
                endTime: e.endTime || '',
                type: e.type || 'event',
                location: e.location || '',
                description: e.description || ''
              })));
            }
          } catch (e) { console.warn('Failed to reload events after delete failure', e); }
        }
      } else {
        // scope === 'all' -> ask server to delete template + occurrences when supported
        // Attempt to discover template id locally and pass it explicitly so server
        // can resolve the series even when materialized occurrences lack template_id
        let tplId = null;
        try {
          // pendingDeleteEvent may have been set where available; if not, try to find in selectedEvent
          const pendingEv = (typeof pendingDeleteEvent !== 'undefined' && pendingDeleteEvent) ? pendingDeleteEvent : null;
          tplId = pendingEv && (pendingEv.template_id || (pendingEv.raw && (pendingEv.raw.template_id || pendingEv.raw.templateId)) || pendingEv.templateId) || null;
        } catch (e) { tplId = null; }
        // If still missing, try to fetch the event server-side to inspect its raw/template fields
        if (!tplId) {
          try {
            const serverEvRes = await fetch(`/api/events/${encodeURIComponent(id)}`);
            if (serverEvRes && serverEvRes.ok) {
              const payload = await serverEvRes.json().catch(() => null);
              const serverEv = payload && payload.event ? payload.event : payload;
              tplId = serverEv && (serverEv.template_id || (serverEv.raw && (serverEv.raw.template_id || serverEv.raw.templateId)) || serverEv.templateId) || null;
            }
          } catch (e) { tplId = null; }
        }

        const url = `/api/events/${id}?scope=all${tplId ? `&templateId=${encodeURIComponent(tplId)}` : ''}`;
        const res = await fetch(url, { method: 'DELETE' });
        if (!res.ok) {
          // If server doesn't support scope=all, fallback to reloading events
          console.error('Server refused bulk delete, reloading events');
        }
        try {
          const r = await fetch('/api/events');
          if (r.ok) {
            const payload = await r.json();
            const list = Array.isArray(payload?.events) ? payload.events : (payload?.events || []);
            setEvents(list.map(e => ({
              id: String(e.id),
              title: e.title || 'Untitled',
              date: (e.date && typeof e.date === 'string') ? (e.date.length >= 10 ? e.date.slice(0, 10) : e.date) : (e.date ? e.date : ''),
              startTime: e.time || e.startTime || '',
              endTime: e.endTime || '',
              type: e.type || 'event',
              location: e.location || '',
              description: e.description || '',
              template_id: e.template_id || e.templateId || null,
              repeatOption: e.repeatOption || e.repeat_option || null,
              raw: e
            })));
          }
        } catch (e) { console.warn('Failed to reload events after bulk delete', e); }
      }
    } catch (e) {
      console.warn('Scope delete failed', e);
      showToast('Delete failed', 'error');
    } finally {
      setPendingDeleteId(null);
      setPendingDeleteEvent(null);
    }
  }

  return (
    <div className="calendar-root min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <Head>
        <title>Calendar — University Planner</title>
      </Head>
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-200/60 px-6 py-4 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Calendar</h1>
              <p className="text-xs text-slate-700 dark:text-slate-300">Manage your schedule</p>
            </div>
            <EditScopeModal visible={showEditScopeModal} mode={'edit'} onClose={() => { setShowEditScopeModal(false); setPendingSavePayload(null); setPendingEventId(null); }} onConfirm={(scope) => handleScopeConfirm(scope)} />
            <EditScopeModal visible={showDeleteScopeModal} mode={'delete'} onClose={() => { setShowDeleteScopeModal(false); setPendingDeleteId(null); setPendingDeleteEvent(null); }} onConfirm={(scope) => handleDeleteScopeConfirm(scope)} />
          </div>
          <button ref={createBtnRef} onClick={handleTodayCreate} className="px-5 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/30 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="ml-2">Create</span>
          </button>
        </div>
      </header>

      <main className="max-w-8xl mx-auto pl-8 md:pl-10 p-6 h-[calc(100vh-64px)] overflow-hidden">
        <div className="md:flex md:items-start md:gap-6 md:justify-end">
          <div className="flex-1 md:mr-4 lg:mr-6">
            <div className="cozy backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden h-full flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200/60 flex items-center justify-between bg-gradient-to-r from-white via-blue-50/20 to-white">
                <div className="flex items-center gap-3">
                  <Button onClick={() => navigateMonth(-1)} variant="ghost" size="icon" className="hover:bg-purple-100 hover:text-purple-700 transition-colors rounded-lg h-12 w-12 text-slate-700">
                    <ChevronLeft className="w-6 h-6" strokeWidth={2} />
                  </Button>
                  <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-700 via-purple-600 to-purple-700">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </div>
                  <Button onClick={() => navigateMonth(1)} variant="ghost" size="icon" className="hover:bg-purple-100 hover:text-purple-700 transition-colors rounded-lg h-12 w-12 text-slate-700">
                    <ChevronRight className="w-6 h-6" strokeWidth={2} />
                  </Button>
                </div>
                <button onClick={() => { const t = new Date(); const ymd = toYMD(t); setCurrentDate(t); setSelectedDate(ymd); }} className="px-5 py-2 today-btn text-white rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/30 flex items-center gap-2" aria-label="Go to today">
                  <Calendar className="w-4 h-4" />
                  <span className="ml-2">Today</span>
                </button>
              </div>

              <div className="p-3 flex-1 min-h-0 flex flex-col">
                <div className="grid grid-cols-7 gap-3 mb-3" role="row">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-center text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 py-2" role="columnheader">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2 md:gap-3 flex-1 min-h-0 overflow-auto" role="grid" aria-label="Calendar days" ref={gridRef}>
                  {days.map((day, idx) => {
                    const dayEvents = getEventsForDate(day.date);
                    const holiday = isHoliday(day.date);
                    const today = isToday(day.date);
                    const isSelected = selectedDate && toYMD(day.date) === selectedDate;

                    const allItems = [...dayEvents];
                    if (holiday) {
                      allItems.unshift({ id: `holiday-${idx}`, title: holiday.localName || holiday.name, color: 'bg-warning', isHoliday: true });
                    }

                    return (
                      <div
                        key={idx}
                        role="gridcell"
                        tabIndex={day.isCurrentMonth ? 0 : -1}
                        onClick={() => day.isCurrentMonth && handleDateClick(day.date)}
                        className={`min-h-[72px] p-2.5 border-2 rounded-xl cursor-pointer transition-all duration-150 ${day.isCurrentMonth
                            ? (isSelected
                              ? 'cozy border-purple-300 shadow-sm'
                              : 'cozy border-slate-200 hover:border-purple-300 hover:shadow-md hover:shadow-purple-100/50')
                            : 'bg-slate-50/50 border-slate-100'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className={`text-lg font-bold ${!day.isCurrentMonth ? 'text-slate-400' :
                              today ? 'text-white bg-gradient-to-br from-purple-600 to-purple-700 w-8 h-8 rounded-lg flex items-center justify-center shadow-md text-sm' :
                                'text-slate-800'
                            }`}>
                            {day.date.getDate()}
                          </div>
                        </div>

                        <div className="events-area">
                          <div className="flex flex-wrap gap-2">
                            {allItems.slice(0, 6).map((item) => {
                              // compute dot color: support Tailwind bg-* classes, shorthand like 'indigo-500', and inline colors
                              let dotClass = '';
                              let dotStyle = {};
                              const val = item && item.color;
                              const tailwindToHex = {
                                'indigo-500': '#6366F1',
                                'blue-500': '#3B82F6',
                                'green-500': '#10B981',
                                'red-500': '#EF4444',
                                'yellow-500': '#F59E0B',
                                'gray-500': '#6B7280',
                                'purple-500': '#8B5CF6',
                                'pink-500': '#8B5CF6',
                                'teal-500': '#14B8A6'
                              };

                              const pickColor = (v) => {
                                if (!v) return;
                                const s = String(v).trim();
                                if (!s) return;
                                if (s.startsWith('bg-')) { dotClass = s; return; }
                                if (/^[a-z]+-\d{3,4}$/i.test(s)) { dotClass = 'bg-' + s; return; }
                                if (s.startsWith('#') || s.startsWith('rgb')) { dotStyle.background = s; return; }
                                if (/^[a-z]+$/i.test(s)) { dotStyle.background = s; return; }
                                dotStyle.background = s;
                              };

                              try {
                                pickColor(val);
                              } catch (e) { }

                              // If we only have a bgClass like 'bg-primary' or 'bg-indigo-500', try to derive a hex fallback
                              if (!dotStyle.background && dotClass) {
                                try {
                                  const key = dotClass.replace(/^bg-/, '');
                                  if (tailwindToHex[key]) dotStyle.background = tailwindToHex[key];
                                } catch (e) { }
                              }

                              // Final fallback: deterministic palette by id/title
                              if (!dotStyle.background && !dotClass) {
                                const palette = Object.values(tailwindToHex);
                                try {
                                  const seed = String(item.id || item.title || Math.random());
                                  let h = 0; for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
                                  const idx = Math.abs(h) % palette.length;
                                  dotStyle.background = palette[idx];
                                } catch (e) {
                                  dotStyle.background = '#6366F1';
                                }
                              }

                              // readable foreground for inline hex (not used for dots but keep for completeness)
                              if (dotStyle.background && String(dotStyle.background).startsWith('#')) {
                                try {
                                  const hex = String(dotStyle.background).replace('#', '');
                                  const r = parseInt(hex.slice(0, 2), 16);
                                  const g = parseInt(hex.slice(2, 4), 16);
                                  const b = parseInt(hex.slice(4, 6), 16);
                                  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
                                  dotStyle.color = lum > 0.6 ? '#000' : '#fff';
                                } catch (e) { dotStyle.color = '#fff'; }
                              }

                              const baseStyle = { width: 8, height: 8, padding: 0, display: 'inline-block', minWidth: 0, minHeight: 0, lineHeight: 0, boxSizing: 'content-box', borderWidth: '1px' };

                              return (
                                <button
                                  key={item.id}
                                  onClick={(e) => { e.stopPropagation(); !item.isHoliday && handleEventClick(e, item); }}
                                  title={item.title}
                                  className={`event-dot ${dotClass ? dotClass : ''} rounded-full border border-white shadow-sm hover:scale-105 transition-transform duration-150`}
                                  style={{ ...baseStyle, ...(dotStyle || {}) }}
                                  aria-label={item.isHoliday ? item.title : `Open ${item.title}`}
                                />
                              );
                            })}
                            {allItems.length > 6 && (
                              <div className="text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                +{allItems.length - 6}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Legend removed from flow — moved to aside to save vertical space */}
          </div>

          <aside className="w-96 mt-4 md:mt-0 md:ml-4 flex-shrink-0">
            {/* hide scrollbar visually while keeping content scrollable */}
            <div className="cozy backdrop-blur-xl border border-slate-200/60 rounded-xl p-4 shadow-lg hover:shadow-xl transition-shadow duration-300 max-h-[calc(100vh-120px)] overflow-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <style>{`/* hide webkit scrollbars for this widget only */
                .cozy::-webkit-scrollbar { display: none; }
                /* Selected-day holiday card uses CSS variables to adapt light/dark tones */
                .selected-holiday-card { background: var(--holiday-bg-light, rgba(245,158,11,0.12)); border: 2px solid var(--holiday-border-light, rgba(245,158,11,0.22)); color: var(--holiday-text-light, #92400e); }
                @media (prefers-color-scheme: dark) {
                  .selected-holiday-card { background: var(--holiday-bg-dark, rgba(245,158,11,0.18)); border: 2px solid var(--holiday-border-dark, rgba(245,158,11,0.36)); color: var(--holiday-text-dark, #fff); }
                }
              `}</style>
              <div className="mb-4">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Legend</div>
                <div className="flex flex-wrap gap-2 items-center">
                  {[
                    { color: 'bg-primary', label: 'Lecture' },
                    { color: 'bg-error', label: 'Deadline' },
                    { color: 'bg-success', label: 'Event' },
                    { color: 'bg-secondary', label: 'Assignment' },
                    { color: 'bg-warning', label: 'Holiday' }
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-md border border-slate-100">
                      <div className={`${item.color} rounded-full border border-white shadow-sm`} style={{ width: 8, height: 8, display: 'inline-block', minWidth: 0, minHeight: 0, lineHeight: 0, boxSizing: 'content-box', borderWidth: '1px' }} />
                      <div className="text-xs text-slate-700 dark:text-slate-300">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <div className="p-4 cozy rounded-lg border border-slate-100 shadow-sm overflow-hidden">
                  <div className="text-sm text-slate-700 dark:text-slate-300">Selected Day</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {selectedDate ? (() => { const [y, m, d] = selectedDate.split('-'); return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }); })() : 'Select a date'}
                  </div>
                  <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{(() => { const evs = getEventsForDate(selectedDate || ''); return evs.length ? `${evs.length} event${evs.length > 1 ? 's' : ''}` : 'No events'; })()}</div>
                </div>
              </div>

              {/* Legend is shown above (single instance) - removed duplicate block */}

              <div className="animate-fadeIn">
                {selectedDate ? (
                  (() => {
                    const evs = getEventsForDate(selectedDate);
                    const hol = isHoliday(selectedDate);
                    return (
                      <div className="space-y-3">
                        {hol && (() => {
                          // derive a subtle background from the holiday color class (e.g. 'bg-warning')
                          const map = { primary: '#8B5CF6', secondary: '#64748B', accent: '#06B6D4', info: '#3B82F6', success: '#10B981', warning: '#F59E0B', error: '#EF4444', neutral: '#6B7280' };
                          const cls = (hol && hol.color) ? String(hol.color) : 'bg-warning';
                          const key = cls.replace(/^bg-/, '');
                          const hex = map[key] || '#F59E0B';
                          const hexToRgba = (h, a) => {
                            const hx = String(h).replace('#', '');
                            const r = parseInt(hx.slice(0, 2), 16);
                            const g = parseInt(hx.slice(2, 4), 16);
                            const b = parseInt(hx.slice(4, 6), 16);
                            return `rgba(${r}, ${g}, ${b}, ${a})`;
                          };
                          const bg = hexToRgba(hex, 0.12);
                          const border = hexToRgba(hex, 0.22);
                          // readable text: dark for light yellows, otherwise pick white for dark colors
                          const textColor = (key === 'warning' || key === 'accent' || key === 'info') ? 'text-amber-800' : 'text-slate-900';
                          // Map color keys to explicit Tailwind classes so border matches legend exactly
                          const colorMap = {
                            warning: { bgLight: 'bg-warning/25', bgDark: 'dark:bg-warning/40', border: 'border-warning', text: 'text-amber-800 dark:text-amber-200' },
                            primary: { bgLight: 'bg-primary/25', bgDark: 'dark:bg-primary/40', border: 'border-primary', text: 'text-white' },
                            secondary: { bgLight: 'bg-secondary/20', bgDark: 'dark:bg-secondary/30', border: 'border-secondary', text: 'text-slate-900 dark:text-white' },
                            info: { bgLight: 'bg-info/25', bgDark: 'dark:bg-info/40', border: 'border-info', text: 'text-white' },
                            success: { bgLight: 'bg-success/25', bgDark: 'dark:bg-success/40', border: 'border-success', text: 'text-white' },
                            error: { bgLight: 'bg-error/25', bgDark: 'dark:bg-error/40', border: 'border-error', text: 'text-white' },
                            neutral: { bgLight: 'bg-neutral/20', bgDark: 'dark:bg-neutral/30', border: 'border-neutral', text: 'text-slate-900 dark:text-white' },
                            accent: { bgLight: 'bg-accent/25', bgDark: 'dark:bg-accent/40', border: 'border-accent', text: 'text-white' }
                          };
                          const cm = colorMap[key] || colorMap.warning;
                          return (
                            <div className={`p-3 rounded-lg shadow-sm ${cm.bgLight} ${cm.bgDark} ${cm.border} border-2`}>
                              <div className="flex items-center gap-3">
                                <div className={`text-sm font-semibold ${cm.text}`}>{hol.localName || hol.name || 'Holiday'}</div>
                              </div>
                            </div>
                          );
                        })()}
                        {evs.length === 0 && !hol ? (
                          <div className="text-center py-10 text-slate-700 dark:text-slate-300">
                            <Calendar className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                            <p className="text-sm font-medium">No events scheduled</p>
                            <p className="text-xs mt-1">Click + to add one</p>
                          </div>
                        ) : null}
                        {evs.map(ev => (
                          <div key={ev.id} className="group p-3 cozy rounded-lg border-2 border-slate-100 hover:border-blue-200 hover:shadow-md transition-all duration-200">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <div className={`w-3 h-3 ${ev.color} rounded-full border-2 border-white shadow-sm mt-0.5 flex-shrink-0`}></div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{ev.title}</div>
                                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1">
                                    {ev.startTime && <span className="font-medium">{ev.startTime}</span>}
                                    {ev.endTime && <span> - {ev.endTime}</span>}
                                  </div>
                                  {ev.location && (
                                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                      {ev.location}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1" style={{ position: 'relative', zIndex: 10 }}>
                                <button
                                  onClick={(e) => handleEventClick(e, ev)}
                                  className="event-edit-btn h-7 w-7 hover:bg-blue-100 rounded-md flex items-center justify-center"
                                  style={{ border: '1px solid #e2e8f0' }}
                                  aria-label={`Edit ${ev.title}`}
                                >
                                  <Edit3 style={{ width: 14, height: 14, stroke: '#3b82f6', strokeWidth: 2, fill: 'none' }} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev); }}
                                  className="event-edit-btn h-7 w-7 hover:bg-red-100 rounded-md flex items-center justify-center"
                                  style={{ border: '1px solid #e2e8f0' }}
                                  aria-label={`Delete ${ev.title}`}
                                >
                                  <Trash2 style={{ width: 14, height: 14, stroke: '#ef4444', strokeWidth: 2, fill: 'none' }} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {evs.length > 0 && (
                          <div className="pt-3 mt-3 border-t-2 border-slate-100">
                            <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Upcoming Events</h5>
                            <div className="space-y-2">
                              {events
                                .filter(e => {
                                  try {
                                    // include only events after the selected date (exclude same-day items)
                                    const evDate = toYMD(e.date);
                                    return evDate > toYMD(selectedDate);
                                  } catch (err) { return false; }
                                })
                                // sort by date then startTime (empty times sort last)
                                .sort((a, b) => {
                                  const da = toYMD(a.date);
                                  const db = toYMD(b.date);
                                  if (da < db) return -1;
                                  if (da > db) return 1;
                                  const ta = a.startTime || '';
                                  const tb = b.startTime || '';
                                  if (ta === tb) return 0;
                                  if (!ta) return 1;
                                  if (!tb) return -1;
                                  return ta.localeCompare(tb);
                                })
                                .slice(0, 3).map(u => (
                                  <div key={`up-${u.id}`} className="flex items-center gap-2 text-xs p-2 bg-slate-50 rounded-md hover:bg-blue-50 transition-colors">
                                    <div className={`${u.color} rounded-full flex-shrink-0`} style={{ width: 8, height: 8, display: 'inline-block', minWidth: 0, minHeight: 0, lineHeight: 0, boxSizing: 'content-box', borderWidth: '1px' }}></div>
                                    <span className="font-medium text-slate-900 dark:text-slate-100 truncate flex-1">{u.title}</span>
                                    <span className="text-slate-700 dark:text-slate-300 text-xs">{(() => { const [yy, mm, dd] = toYMD(u.date).split('-'); return `${Number(dd)}/${Number(mm)}` })()}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                    <p className="text-sm font-medium">Select a date on the calendar</p>
                    <p className="text-xs mt-1">View events and details</p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Event modal moved to shared AddEventModal via ModalProvider */}

      {process.env.NODE_ENV === 'development' && showDebug && (
        <DebugOverlay gridRef={gridRef} />
      )}

      <style jsx>{`
        .calendar-root .text-slate-900 { color: #0f172a !important; }
        .calendar-root .text-slate-800 { color: #1e293b !important; }
        .calendar-root .text-slate-700 { color: #334155 !important; }
        .calendar-root .text-slate-600 { color: #475569 !important; }
        .calendar-root .text-slate-500 { color: #64748b !important; }
        .calendar-root .text-slate-400 { color: #94a3b8 !important; }
        /* Dark-mode overrides: when html has .dark, ensure calendar text becomes light */
        :global(html.dark) .calendar-root .text-slate-900 { color: rgba(255,255,255,0.95) !important; }
        :global(html.dark) .calendar-root .text-slate-800 { color: rgba(255,255,255,0.9) !important; }
        :global(html.dark) .calendar-root .text-slate-700 { color: rgba(255,255,255,0.82) !important; }
        :global(html.dark) .calendar-root .text-slate-600 { color: rgba(255,255,255,0.7) !important; }
        :global(html.dark) .calendar-root .text-slate-500 { color: rgba(255,255,255,0.6) !important; }
        :global(html.dark) .calendar-root .text-slate-400 { color: rgba(255,255,255,0.5) !important; }
        
        /* Fix calendar grid cell alignment */
        .calendar-root [role="gridcell"] {
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }

        /* Better grid cell layout: keep the day number visually padded and
           allow the events area to take remaining space and scroll when needed. */
        .calendar-root [role="gridcell"] {
          justify-content: flex-start;
          /* slightly reduced min-height so months with 6 rows fit better */
          min-height: 72px;
          box-sizing: border-box;
          /* slightly reduce outer padding to fit more rows */
          padding: 0.5rem !important; /* matches p-2 */
        }
        .calendar-root [role="gridcell"] > .flex.items-center {
          /* date number wrapper: keep left/top alignment and ensure a stable gap */
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          padding: 0 !important; /* internal spacing handled by outer padding */
        }
        .calendar-root [role="gridcell"] .flex.flex-wrap {
          /* fallback for older markup: keep flow */
          margin-top: 6px;
          display: block !important;
        }

        /* New tidy events area: position dots inset from bottom-left */
        .calendar-root [role="gridcell"] .events-area {
          position: absolute;
          left: 10px;
          right: 10px;
          bottom: 10px;
          display: flex;
          align-items: center;
          pointer-events: none; /* allow clicks to pass to cell except on buttons */
        }
        .calendar-root [role="gridcell"] .events-area > .flex {
          pointer-events: auto; /* enable clicking event buttons */
        }

        /* Reduce grid gaps slightly and compute a dynamic row height so the
           calendar visually occupies 6 rows but will shrink rows to fit the
           viewport when needed (avoids internal scrollbars). */
        .calendar-root .grid[role="grid"] {
          gap: 6px 6px;
          /* Prefer a comfortable row height but shrink to fit available
             viewport space: subtract an allowance for header/controls (220px)
             and gap space (30px) before dividing into 6 rows. */
          --calendar-row-height: min(84px, calc((100vh - 220px - 30px) / 6));
          grid-auto-rows: var(--calendar-row-height);
          height: calc(var(--calendar-row-height) * 6 + 30px);
          overflow: visible; /* let content flow; rows will shrink instead */
        }

        /* Responsive: compress spacing further on narrow viewports */
        @media (max-width: 900px) {
          .calendar-root [role="gridcell"] { min-height: 64px; padding: 0.375rem !important; }
          .calendar-root .grid[role="grid"] {
            gap: 4px 4px;
            --calendar-row-height: min(72px, calc((100vh - 180px - 20px) / 6));
            grid-auto-rows: var(--calendar-row-height);
            height: calc(var(--calendar-row-height) * 6 + 20px);
            overflow: visible;
          }
        }
  .calendar-root [role="gridcell"] .event-dot { margin-right: 6px; z-index: 10; position: relative; }
  /* Grid cell dots: allow a slightly larger but still subtle marker (8px).
     Keep sizing constrained so other utilities don't inflate them. */
  .calendar-root [role="gridcell"] .event-dot {
    width: 8px !important;
    height: 8px !important;
    padding: 0 !important;
    display: inline-block !important;
    min-width: 0 !important;
    min-height: 0 !important;
    line-height: 0 !important;
    box-sizing: content-box !important;
    border-width: 1px !important;
    border-radius: 50% !important;
  }

  /* Ensure gridcells provide a positioning context for absolute events */
  .calendar-root [role="gridcell"] { position: relative; }

        /* Make sure the selected (today) pill is visible and doesn't collapse */
        .calendar-root .cozy.border-purple-300 {
          /* keep a slightly stronger padding when selected */
          padding: 0.75rem !important;
        }

        /* Today button styling: give it a distinctive gradient and focus treatment */
        .today-btn {
          border: 2px solid rgba(124,58,237,0.08);
          background: linear-gradient(90deg,#7c3aed,#6d28d9);
          color: #fff !important;
          box-shadow: 0 8px 22px rgba(99,102,241,0.12);
        }
        .today-btn:hover { filter: brightness(1.03); }
        .today-btn:focus { outline: 3px solid rgba(124,58,237,0.14); }
        
        /* Fix aside widgets text alignment */
        .calendar-root aside .text-xs,
        .calendar-root aside .text-sm,
        .calendar-root aside .text-lg {
          line-height: 1.5;
        }
        
        /* Fix legend items */
        .calendar-root aside .flex.items-center {
          padding: 0.25rem 0.5rem;
        }

        /* Scoped safety: ensure aside/cozy containers keep a normal document flow
           and any absolutely positioned children are positioned relative to them.
           This prevents portal/absolute elements from appearing at the page origin
           (top-left). Keep rules tightly scoped to calendar-root only. */
        .calendar-root aside { position: relative }
        .calendar-root aside > .cozy {
            position: relative;
            display: block;
            }
        
        @keyframes fadeIn { 
          from { opacity: 0; transform: translateY(6px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        .animate-fadeIn { 
          animation: fadeIn 250ms ease both; 
        }
        @keyframes scaleIn { 
          from { opacity: 0; transform: scale(0.95); } 
          to { opacity: 1; transform: scale(1); } 
        }
        .dialog-scale { 
          animation: scaleIn 200ms cubic-bezier(0.2, 0.9, 0.2, 1) both; 
        }
        .dialog-cozy {
          /* default to visible; animations are applied via data-state selectors below */
        }
        [data-state="open"] > .dialog-cozy, .dialog-cozy[data-state="open"] {
          animation: cozyIn 260ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
        }
        [data-state="closed"] > .dialog-cozy, .dialog-cozy[data-state="closed"] {
          animation: cozyOut 220ms cubic-bezier(0.22, 0.9, 0.2, 1) both;
        }
        @keyframes cozyIn {
          from { opacity: 0; transform: translateY(8px) scale(.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cozyOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(6px) scale(.995); }
        }
        .event-dot { 
          transition: transform 150ms ease, box-shadow 150ms ease; 
        }
        /* Slightly smaller hover only for grid dots to avoid huge pop */
        .calendar-root [role="gridcell"] .event-dot:hover {
          transform: scale(1.12);
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        /* Keep other event-dot hover rules (global) mild as well */
        .event-dot:hover { transform: scale(1.08); box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        /* Ensure svgs in header/nav inherit visible color */
        /* Ensure svgs in header/nav inherit visible color */

        .calendar-root header svg, .calendar-root .text-slate-700 svg { 
          color: inherit !important; 
          stroke: currentColor !important; 
          fill: none !important; 
        }

        /* NUCLEAR FIX for aside buttons */
        .calendar-root aside button {
          color: #64748b !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        /* Force visible stroke colors for light background */
        .calendar-root aside button svg path {
          stroke: #64748b !important;
        }

        .calendar-root aside button:hover svg path {
          stroke: currentColor !important;
        }

        /* Colored icons */
        .calendar-root aside .event-edit-btn:hover svg path {
          stroke: #3b82f6 !important;
        }

        .calendar-root aside .event-delete-btn:hover svg path {
          stroke: #ef4444 !important;
        }

        .calendar-root aside button:hover {
          color: #1e40af !important;
          background-color: #dbeafe !important;
        }

        .calendar-root aside button svg {
          stroke: #64748b !important;
          stroke-width: 2 !important;
          fill: none !important;
          opacity: 1 !important;
          display: block !important;
          visibility: visible !important;
          width: 14px !important;
          height: 14px !important;
        }

        .calendar-root aside button:hover svg {
          stroke: #1e40af !important;
        }

        .calendar-root aside button svg[aria-hidden="true"] {
          display: block !important;
          visibility: visible !important;
        }

        .calendar-root aside button svg path {
          stroke: inherit !important;
          fill: none !important;
          opacity: 1 !important;
          display: block !important;
          visibility: visible !important;
        }

        /* Force button container visible */
        .calendar-root .group > div:last-child {
          opacity: 1 !important;
        }

        

      `}</style>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full rounded-lg shadow-lg" role="status" aria-live="polite">
          <div className={`px-4 py-3 rounded-lg ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white/95'}`}>{toast.message}</div>
        </div>
      )}
    </div>
  );
}

function DebugOverlay({ gridRef }) {
  const [metrics, setMetrics] = useState({});

  useEffect(() => {
    function read() {
      const winH = window.innerHeight;
      const header = document.querySelector('header');
      const headerH = header ? header.getBoundingClientRect().height : 0;
      const main = document.querySelector('main');
      const mainH = main ? main.getBoundingClientRect().height : 0;
      const gridH = gridRef && gridRef.current ? gridRef.current.getBoundingClientRect().height : 0;
      const aside = document.querySelector('aside');
      const asideH = aside ? aside.getBoundingClientRect().height : 0;
      setMetrics({ winH, headerH, mainH, gridH, asideH });
    }
    read();
    window.addEventListener('resize', read);
    const id = setInterval(read, 1000);
    return () => { window.removeEventListener('resize', read); clearInterval(id); };
  }, [gridRef]);

  return (
    <div style={{ position: 'fixed', right: 12, top: 12, zIndex: 9999, background: '#0f172a', color: '#fff', padding: 10, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.2)', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Debug metrics (toggle with 'd')</div>
      <div>window.innerHeight: {metrics.winH}</div>
      <div>header height: {metrics.headerH}</div>
      <div>main height: {metrics.mainH}</div>
      <div>grid height: {metrics.gridH}</div>
      <div>aside height: {metrics.asideH}</div>
    </div>
  );
}

// Render overlay conditionally (development only)
if (process.env.NODE_ENV === 'development') {
  // nothing here; overlay is added via JSX in the main component when toggled
}