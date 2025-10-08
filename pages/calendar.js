import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, Plus, ChevronLeft, ChevronRight, Trash2, Edit3, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Using native select in this page for a simpler behavior; keep other UI helpers imported separately
import { Textarea } from '@/components/ui/textarea';

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
      date: (e.date && typeof e.date === 'string') ? (e.date.length >= 10 ? e.date.slice(0,10) : e.date) : '',
      startTime: e.time || e.startTime || '',
      endTime: e.endTime || '',
      type: e.type || 'event',
      location: e.location || '',
      description: e.description || '',
      color: e.type === 'class' ? 'bg-primary' : (e.type === 'deadline' ? 'bg-error' : 'bg-secondary')
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
    return String(d).slice(0,10);
  }
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState(persistedEvents);
  const [holidays, setHolidays] = useState([]);

  const [selectedDate, setSelectedDate] = useState(toYMD(new Date()));
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: toYMD(new Date()), startTime: '', endTime: '', type: 'event', location: '', description: '', color: 'bg-blue-500' });
  const gridRef = useRef(null);
  const [showDebug, setShowDebug] = useState(false);

  // Toast notifications local to Calendar page
  const [toast, setToast] = useState(null);
  function showToast(message, type = 'info', ms = 3500) {
    setToast({ message, type });
    setTimeout(() => setToast(null), ms);
  }

  useEffect(() => {
    let cancelled = false;
    const y = currentDate.getFullYear();
    const range = `${y}-${y+1}`;
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
          date: (e.date && typeof e.date === 'string') ? (e.date.length >= 10 ? e.date.slice(0,10) : e.date) : (e.date ? e.date : ''),
          startTime: e.time || e.startTime || '',
          endTime: e.endTime || '',
          type: e.type || 'event',
          location: e.location || '',
          description: e.description || '',
          color: e.type === 'class' ? 'bg-primary' : (e.type === 'deadline' ? 'bg-error' : 'bg-secondary')
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
          const start = c.time || '';
          const end = start ? computeEndTime(start, c.duration || 1) : '';

          // If class explicitly has a date and is not marked to repeat, just include it if visible
          if (c.date && !c.repeat && c.repeatOption !== 'weekly' && c.dayOfWeek == null) {
            const d = (typeof c.date === 'string' && c.date.length >= 10) ? c.date.slice(0,10) : toYMD(c.date);
            if (visibleDates.has(d)) {
              occurrences.push({
                id: `tt-${String(c.id)}`,
                title: c.subject || c.title || 'Class',
                date: d,
                startTime: start,
                endTime: end,
                type: 'class',
                location: c.location || '',
                description: c.instructor ? `Instructor: ${c.instructor}` : (c.description || ''),
                color: c.color || 'bg-primary'
              });
            }
            continue;
          }

          // If class is a weekly template (has dayOfWeek or repeatOption === 'weekly'), expand across visible dates
          const dow = (typeof c.dayOfWeek === 'number') ? c.dayOfWeek : (c.repeatOption === 'weekly' && typeof c.dayOfWeek === 'number' ? c.dayOfWeek : null);
          if (dow != null) {
            for (const dObj of gridDays) {
              if (dObj.date.getDay() === dow) {
                const d = toYMD(dObj.date);
                occurrences.push({
                  id: `tt-${String(c.id)}-${d}`,
                  title: c.subject || c.title || 'Class',
                  date: d,
                  startTime: start,
                  endTime: end,
                  type: 'class',
                  location: c.location || '',
                  description: c.instructor ? `Instructor: ${c.instructor}` : (c.description || ''),
                  color: c.color || 'bg-primary'
                });
              }
            }
            continue;
          }

          // Fallback: if no repeat info, include single date if visible
          if (c.date) {
            const d = (typeof c.date === 'string' && c.date.length >= 10) ? c.date.slice(0,10) : toYMD(c.date);
            if (visibleDates.has(d)) {
              occurrences.push({
                id: `tt-${String(c.id)}`,
                title: c.subject || c.title || 'Class',
                date: d,
                startTime: start,
                endTime: end,
                type: 'class',
                location: c.location || '',
                description: c.instructor ? `Instructor: ${c.instructor}` : (c.description || ''),
                color: c.color || 'bg-primary'
              });
            }
          }
        }

        // Merge into events state, dedupe by id
        setEvents(prev => {
          const existingIds = new Set(prev.map(e => String(e.id)));
          const merged = [...prev];
          occurrences.forEach(o => {
            if (existingIds.has(String(o.id))) return;
            // also avoid exact title/date/time duplicates
            const clash = prev.find(p => p.title === o.title && p.date === o.date && (p.startTime||'') === (o.startTime||''));
            if (clash) return;
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
  const targetCells = 42;

    // trailing days from next month to fill the grid to targetCells
    while (days.length < targetCells) {
      const last = days[days.length - 1].date;
      const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      days.push({ date: next, isCurrentMonth: false });
    }

    return days;
  };

  const days = useMemo(() => getDaysInMonth(currentDate), [currentDate]);

  const getEventsForDate = (date) => {
    const ymd = toYMD(date);
    return events.filter(ev => toYMD(ev.date) === ymd).sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
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
    setShowEventModal(true);
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
          type: newEvent.type || 'event',
          location: newEvent.location || null,
          description: newEvent.description || null
        };
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
              const normalized = list.map(e => ({ id: String(e.id), title: e.title || body.title, date: e.date || body.date, startTime: e.time || '', endTime: e.endTime || '', type: e.type || body.type || 'event', location: e.location || '', description: e.description || '' }));
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
          startTime: created.time || body.time || '',
          endTime: created.endTime || '',
          type: created.type || body.type || 'event',
          location: created.location || '',
          description: created.description || ''
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
  const isDev = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');
  if (isDev) payload.userId = 'smoke_user';
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
        setEvents(prev => prev.map(ev => ev.id === id ? { ...ev, title: updated.title || ev.title, date: updated.date || ev.date, startTime: updated.time || ev.startTime, location: updated.location || ev.location, description: updated.description || ev.description } : ev));
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

    // Optimistically remove from UI
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
                date: (e.date && typeof e.date === 'string') ? (e.date.length >= 10 ? e.date.slice(0,10) : e.date) : (e.date ? e.date : ''),
                startTime: e.time || e.startTime || '',
                endTime: e.endTime || '',
                type: e.type || 'event',
                location: e.location || '',
                description: e.description || ''
              })));
            }
          } catch (e) { console.warn('Failed to reload events after delete failure', e); }
        }
      } catch (err) {
        console.error('Failed to delete event on server', err);
      }
    })();
  };

  return (
    <div className="calendar-root min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-200/60 px-6 py-4 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Calendar</h1>
              <p className="text-xs text-slate-700">Manage your schedule</p>
            </div>
          </div>
          <Button onClick={() => { setSelectedDate(toYMD(new Date())); setShowEventModal(true); setSelectedEvent(null); resetForm(); }} className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-purple-500/35 px-5 h-10 rounded-xl font-medium">
            <Plus className="w-4 h-4 mr-2" />Create Event
          </Button>
        </div>
      </header>

  <main className="max-w-8xl mx-auto pl-8 md:pl-10 p-6 h-[calc(100vh-64px)] overflow-hidden">
  <div className="md:flex md:items-start md:gap-6 md:justify-end">
          <div className="flex-1 md:mr-4 lg:mr-6">
            <div className="cozy backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden h-full flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200/60 flex items-center justify-between bg-gradient-to-r from-white via-blue-50/20 to-white">
                <div className="flex items-center gap-3">
                  <Button onClick={() => navigateMonth(-1)} variant="ghost" size="icon" className="hover:bg-purple-100 hover:text-purple-700 transition-colors rounded-lg h-9 w-9">
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-700 via-purple-600 to-purple-700">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </div>
                  <Button onClick={() => navigateMonth(1)} variant="ghost" size="icon" className="hover:bg-purple-100 hover:text-purple-700 transition-colors rounded-lg h-9 w-9">
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
                <Button variant="outline" onClick={() => setCurrentDate(new Date())} className="today-btn border-2 border-purple-200 hover:bg-purple-50 hover:border-purple-300 transition-all rounded-lg px-4 font-medium text-sm h-9">
                  Today
                </Button>
              </div>

              <div className="p-3 flex-1 min-h-0 flex flex-col">
                <div className="grid grid-cols-7 gap-3 mb-3" role="row">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} className="text-center text-sm font-semibold uppercase tracking-wider text-slate-700 py-2" role="columnheader">
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
                      className={`min-h-[72px] p-2.5 border-2 rounded-xl cursor-pointer transition-all duration-150 ${
              day.isCurrentMonth
                    ? (isSelected
                  ? 'cozy border-purple-300 shadow-sm'
                  : 'cozy border-slate-200 hover:border-purple-300 hover:shadow-md hover:shadow-purple-100/50')
                : 'bg-slate-50/50 border-slate-100'
            }`}
                      > 
                        <div className="flex items-center justify-between mb-1">
                          <div className={`text-lg font-bold ${
                              !day.isCurrentMonth ? 'text-slate-400' : 
                              today ? 'text-white bg-gradient-to-br from-purple-600 to-purple-700 w-8 h-8 rounded-lg flex items-center justify-center shadow-md text-sm' : 
                              'text-slate-800'
                            }`}>
                            {day.date.getDate()}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-2">
                          {allItems.slice(0,6).map((item) => (
                            <button 
                              key={item.id} 
                              onClick={(e) => { e.stopPropagation(); !item.isHoliday && handleEventClick(e, item); }} 
                              title={item.title} 
                              className={`event-dot w-3 h-3 ${item.color} rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform duration-150`}
                              aria-label={item.isHoliday ? item.title : `Open ${item.title}`}
                            />
                          ))}
                          {allItems.length > 6 && (
                            <div className="text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                              +{allItems.length - 6}
                            </div>
                          )}
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
            <div className="cozy backdrop-blur-xl border border-slate-200/60 rounded-xl p-4 shadow-lg hover:shadow-xl transition-shadow duration-300 max-h-[calc(100vh-120px)] overflow-auto">
              <div className="mb-4">
                <div className="text-xs font-bold text-slate-700 mb-2">Legend</div>
                <div className="flex flex-wrap gap-2 items-center">
                  {[
                    {color:'bg-primary',label:'Class'},
                    {color:'bg-error',label:'Deadline'},
                    {color:'bg-success',label:'Event'},
                    {color:'bg-secondary',label:'Assignment'},
                    {color:'bg-warning',label:'Holiday'}
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-md border border-slate-100">
                      <div className={`w-2.5 h-2.5 ${item.color} rounded-full border-2 border-white shadow-sm`} />
                      <div className="text-xs text-slate-700">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                  <div className="p-4 cozy rounded-lg border border-slate-100 shadow-sm">
                  <div className="text-sm text-slate-700">Selected Day</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {selectedDate ? (() => { const [y,m,d] = selectedDate.split('-'); return new Date(Number(y), Number(m)-1, Number(d)).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }); })() : 'Select a date'}
                  </div>
                  <div className="mt-3 text-sm text-slate-600">{(() => { const evs = getEventsForDate(selectedDate||''); return evs.length ? `${evs.length} event${evs.length>1?'s':''}` : 'No events'; })()}</div>
                </div>
              </div>
              <div className="flex items-end justify-between mb-2">
                <Button 
                  size="icon" 
                  onClick={() => { setSelectedDate(selectedDate || toYMD(new Date())); setShowEventModal(true); setSelectedEvent(null); resetForm(); }} 
                  className="bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-md shadow-purple-500/25 rounded-lg h-9 w-9"
                  aria-label="Create event for selected day"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Legend is shown above (single instance) - removed duplicate block */}

              <div className="animate-fadeIn">
                {selectedDate ? (
                  (() => {
                    const evs = getEventsForDate(selectedDate);
                    const hol = isHoliday(selectedDate);
                    return (
                      <div className="space-y-3">
                        {hol && (
                          <div className="p-3 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-lg shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-warning rounded-full border-2 border-white shadow-sm"></div>
                              <div className="text-sm font-bold text-amber-900">{hol.localName || hol.name}</div>
                            </div>
                          </div>
                        )}
                        {evs.length === 0 && !hol ? (
                            <div className="text-center py-10 text-slate-700">
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
                                  <div className="text-sm font-bold text-slate-900 truncate">{ev.title}</div>
                                  <div className="text-xs text-slate-600 mt-1 flex items-center gap-1">
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
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={(e) => handleEventClick(e, ev)} 
                                  className="h-7 w-7 hover:bg-blue-100 hover:text-blue-700 rounded-md"
                                  aria-label={`Edit ${ev.title}`}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => handleDeleteEvent(ev)} 
                                  className="h-7 w-7 hover:bg-red-100 hover:text-red-700 rounded-md"
                                  aria-label={`Delete ${ev.title}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                            {evs.length > 0 && (
                          <div className="pt-3 mt-3 border-t-2 border-slate-100">
                            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Upcoming Events</h5>
                            <div className="space-y-2">
                              {events.filter(e => toYMD(e.date) >= toYMD(selectedDate)).slice(0,3).map(u => (
                                <div key={`up-${u.id}`} className="flex items-center gap-2 text-xs p-2 bg-slate-50 rounded-md hover:bg-blue-50 transition-colors">
                                  <div className={`w-2 h-2 ${u.color} rounded-full flex-shrink-0`}></div>
                                  <span className="font-medium text-slate-900 truncate flex-1">{u.title}</span>
                                  <span className="text-slate-700 text-xs">{(() => { const [yy,mm,dd] = toYMD(u.date).split('-'); return `${Number(dd)}/${Number(mm)}` })()}</span>
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

  <Dialog open={showEventModal} onOpenChange={(open) => { setShowEventModal(open); if (!open) { setSelectedEvent(null); resetForm(); } }}>
  <DialogContent data-state={showEventModal ? 'open' : 'closed'} className="max-w-xl max-h-[90vh] rounded-2xl border border-slate-200 shadow-2xl cozy dialog-cozy flex flex-col overflow-hidden">
          <DialogHeader className="pb-0 border-b border-slate-200">
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center shadow-md`}>
                  {selectedEvent ? <Edit3 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                </div>
                <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-purple-600">
                  {selectedEvent ? 'Edit Event' : 'Create New Event'}
                </DialogTitle>
              </div>
              <div>
                <button onClick={() => { setShowEventModal(false); setSelectedEvent(null); resetForm(); }} className="p-2 rounded-md hover:bg-slate-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="p-5 overflow-y-auto hide-scrollbar flex-1 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-bold text-slate-800 flex items-center gap-2">
                Event Title <span className="text-red-500">*</span>
              </Label>
                <Input 
                id="title" 
                type="text" 
                value={newEvent.title} 
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} 
                placeholder="e.g., Team Meeting, Project Deadline" 
                className="h-11 text-base rounded-xl border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  Date <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="date" 
                  type="date" 
                  value={newEvent.date} 
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} 
                  className="h-11 rounded-xl border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type" className="text-sm font-bold text-slate-800">Event Type</Label>
                <select
                  id="type"
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                  className="h-11 rounded-xl border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all px-3 w-full"
                >
                  <option value="event">Event</option>
                  <option value="class">Class</option>
                  <option value="deadline">Deadline</option>
                  <option value="assignment">Assignment</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime" className="text-sm font-bold text-slate-800">Start Time</Label>
                <Input 
                  id="startTime" 
                  type="time" 
                  value={newEvent.startTime} 
                  onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })} 
                  className="h-11 rounded-xl border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime" className="text-sm font-bold text-slate-800">End Time</Label>
                <Input 
                  id="endTime" 
                  type="time" 
                  value={newEvent.endTime} 
                  onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })} 
                  className="h-11 rounded-xl border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-bold text-slate-800">Location</Label>
              <Input 
                id="location" 
                type="text" 
                value={newEvent.location} 
                onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })} 
                placeholder="e.g., Room 301, Online, Conference Hall" 
                className="h-11 text-base rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-800 block">
                Color Theme
              </Label>
              <div className="flex gap-2 flex-wrap">
                {['bg-primary','bg-secondary','bg-accent','bg-info','bg-success','bg-warning','bg-error','bg-neutral'].map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewEvent({ ...newEvent, color })}
                    className={`w-10 h-10 ${color} rounded-xl transition-all duration-200 hover:scale-110 ${
                          newEvent.color === color 
                            ? 'ring-4 ring-offset-2 ring-purple-400 shadow-lg scale-105' 
                            : 'hover:shadow-md'
                        }`}
                    aria-label={`Select ${color} color`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-bold text-slate-800">
                Description
              </Label>
              <Textarea
                id="description"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                rows={3}
                placeholder="Add any additional details about this event..."
                className="text-base rounded-xl border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all resize-none"
              />
            </div>

          </div>

          {/* Sticky footer with actions */}
          <div className="border-t border-slate-200 p-4 cozy sticky bottom-0 z-20">
            <div className="flex gap-3">
              <Button 
                onClick={() => { setShowEventModal(false); setSelectedEvent(null); resetForm(); }} 
                variant="outline" 
                className="flex-1 border-2 border-slate-200 hover:bg-slate-50 rounded-xl h-11 font-medium"
              >
                Cancel
              </Button>
              {selectedEvent && (
                <Button 
                  onClick={() => { handleDeleteEvent(selectedEvent); }} 
                  className="border-2 border-red-200 hover:bg-red-50 text-red-700 rounded-xl h-11 px-4 font-medium"
                >
                  Delete
                </Button>
              )}
              <Button 
                onClick={selectedEvent ? handleUpdateEvent : handleCreateEvent} 
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-500/25 rounded-xl h-11 font-medium"
              >
                {selectedEvent ? 'Update Event' : 'Create Event'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
          /* events area */
          margin-top: 6px;
          display: block !important;
          overflow: hidden;
          max-height: 180px;
        }

        /* Reduce grid gaps slightly so 6-row months fit vertically without scrolling */
        .calendar-root .grid[role="grid"] { gap: 6px 6px; }

        /* Responsive: compress spacing further on narrow viewports */
        @media (max-width: 900px) {
          .calendar-root [role="gridcell"] { min-height: 64px; padding: 0.375rem !important; }
          .calendar-root .grid[role="grid"] { gap: 4px 4px; }
        }
        .calendar-root [role="gridcell"] .event-dot { margin-right: 6px; }

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
        .calendar-root aside { position: relative !important; }
        .calendar-root aside .cozy { position: relative !important; display: block !important; }
        .calendar-root aside .p-4, .calendar-root aside .px-4, .calendar-root aside .py-4 {
          padding: 1rem !important; /* restore expected padding explicitly */
        }
        /* Reset inadvertent absolute/transformed children inside aside */
        .calendar-root aside * {
          position: static !important;
          transform: none !important;
          inset: auto !important;
          left: auto !important;
          top: auto !important;
          right: auto !important;
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
        .event-dot:hover { 
          transform: scale(1.25); 
          box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
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
    <div style={{position:'fixed',right:12,top:12,zIndex:9999,background:'#0f172a',color:'#fff',padding:10,borderRadius:8,boxShadow:'0 6px 18px rgba(0,0,0,0.2)',fontSize:12}}>
      <div style={{fontWeight:700,marginBottom:6}}>Debug metrics (toggle with 'd')</div>
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