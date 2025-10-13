// Modern timetable page with light/dark theme support
import Head from 'next/head'
import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

function mapToSchedulerEvents(list) {
  if (!Array.isArray(list)) return []
  return list.map((e) => {
    const dateStr = e.date || e.startDate || e.start_date || ''
    const timeStr = e.time || e.startTime || e.start_time || '09:00'
    let start = new Date()
    try {
      if (dateStr && typeof dateStr === 'string') {
        const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
        const [hh, mm] = String(timeStr || '09:00').split(':').map(Number)
        start = new Date(y, (m || 1) - 1, d, hh || 9, mm || 0, 0)
      }
    } catch (err) {
      start = new Date()
    }
    
    let desc = e.description || e.notes || '';
    let color = null;
    let variant = null;
    let parsedDuration = null;
    try {
      const metaMatch = String(desc).match(/\[META\]([\s\S]*?)\[META\]/);
      if (metaMatch && metaMatch[1]) {
        const parsed = JSON.parse(metaMatch[1]);
        if (parsed && parsed.color) color = parsed.color;
        if (parsed && parsed.variant) variant = parsed.variant;
        if (parsed && parsed.durationMinutes) parsedDuration = Number(parsed.durationMinutes);
        desc = String(desc).replace(metaMatch[0], '').trim();
      }
    } catch (err) {}

    // If the API returned a structured `meta` object (preferred), use that
    // duration when available. Older deployments may embed meta into description
    // (handled above) but modern responses include a `meta` JSON property.
    try {
      if ((e && e.meta && typeof e.meta.durationMinutes !== 'undefined') && (parsedDuration === null || typeof parsedDuration === 'undefined')) {
        parsedDuration = Number(e.meta.durationMinutes);
      }
    } catch (err) {}

    // Prefer an explicit duration (meta or fields) and compute end relative to the
    // parsed start. This avoids mixing server-produced ISO instants (which can
    // represent a different absolute instant depending on server timezone) with
    // client-local date+time composition which can cause displayed end times to
    // shift unexpectedly. Only fall back to raw end values when a duration is
    // not available.
    const durationMinutesRaw = parsedDuration ?? e.durationMinutes ?? e.duration;
    const durationMinutes = (typeof durationMinutesRaw !== 'undefined' && durationMinutesRaw !== null) ? Number(durationMinutesRaw) : null;
    const rawEnd = e.endDate || e.end_date || (e.raw && (e.raw.endDate || e.raw.end_date));
    let endDate;
    if (durationMinutes !== null && !Number.isNaN(Number(durationMinutes))) {
      endDate = new Date(start.getTime() + Number(durationMinutes) * 60000);
    } else if (rawEnd) {
      // If rawEnd is a date-only string (YYYY-MM-DD) we'll treat it conservatively
      // as local midnight on that date and then prefer computing duration from
      // start where possible. Otherwise parse the ISO/explicit raw end value.
      try {
        const s = String(rawEnd);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          // parse as local date at midnight then fall back to a 60-minute duration
          const [yy, mm, dd] = s.split('-').map(Number);
          const parsedDateOnly = new Date(yy, (mm || 1) - 1, dd, 0, 0, 0);
          // if parsedDateOnly equals the start's date, assume a default 60-minute duration
          if (parsedDateOnly.getFullYear() === start.getFullYear() && parsedDateOnly.getMonth() === start.getMonth() && parsedDateOnly.getDate() === start.getDate()) {
            endDate = new Date(start.getTime() + 60 * 60000);
          } else {
            // otherwise use midnight on the raw end date
            endDate = parsedDateOnly;
          }
        } else {
          endDate = new Date(String(rawEnd));
        }
      } catch (err) {
        endDate = new Date(start.getTime() + 60 * 60000);
      }
    } else {
      // No duration and no raw end: default to 60 minutes
      endDate = new Date(start.getTime() + 60 * 60000);
    }

    // Debug logging to trace how start/end are derived for each incoming event.
    try {
      console.debug('[mapToSchedulerEvents] event', {
        id: e.id,
        dateStr,
        timeStr,
        parsedStart: start.toISOString(),
        rawEnd,
        parsedEnd: endDate instanceof Date ? endDate.toISOString() : String(endDate),
        durationMinutes,
        raw: e
      })
    } catch (inner) {}
    
    return {
      id: String(e.id ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      title: e.title || e.subject || 'Event',
      description: desc,
      startDate: start,
      endDate: endDate,
      raw: e,
      color: color || (e.color ?? null),
      variant: variant || (e.variant ?? null),
    }
  })
}

const SchedulerProviderComp = dynamic(
  () => import('@/providers/schedular-provider').then((m) => m?.SchedulerProvider || (m?.default && m.default.SchedulerProvider)),
  { ssr: false }
)

const SchedularViewComp = dynamic(
  () => import('@/components/schedule/_components/view/schedular-view-filteration').then((m) => m?.default || m?.SchedularView),
  { ssr: false }
)

export default function TimetablePage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [recurrenceOptions, setRecurrenceOptions] = useState([])
  const [appWeekStartsOn, setAppWeekStartsOn] = useState('monday')
  const [appDefaultView, setAppDefaultView] = useState('week')
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickType, setQuickType] = useState('lecture')
  const [quickColor, setQuickColor] = useState(null)
  const [creatingQuick, setCreatingQuick] = useState(false)
  const quickRef = React.useRef(null)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const res = await fetch('/api/events')
        if (!res.ok) throw new Error('failed to load events')
        const payload = await res.json()
        const list = Array.isArray(payload?.events) ? payload.events : (Array.isArray(payload) ? payload : [])
        if (!mounted) return
        setEvents(mapToSchedulerEvents(list))
        
        try {
          const ro = await fetch('/api/recurrence-options')
          if (ro.ok) {
            const j = await ro.json()
            if (j && Array.isArray(j.options)) setRecurrenceOptions(j.options)
          }
        } catch (e) {
          console.warn('Failed to load recurrence options', e)
        }
      } catch (err) {
        console.warn('Failed to load events for timetable', err)
        if (mounted) setEvents([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (recurrenceOptions && recurrenceOptions.length > 0) {
      try {
        console.info('Recurrence options loaded for timetable:', recurrenceOptions)
      } catch (e) { }
    }
  }, [recurrenceOptions])

  // close quick popover when clicking outside
  useEffect(() => {
    function onDoc(e) {
      if (!quickRef.current) return;
      if (!quickRef.current.contains(e.target)) setQuickOpen(false);
    }
    if (quickOpen) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [quickOpen]);

  async function reloadEvents() {
    try {
      const res = await fetch('/api/events')
      if (!res.ok) throw new Error('failed to load events')
      const payload = await res.json()
      const list = Array.isArray(payload?.events) ? payload.events : (Array.isArray(payload) ? payload : [])
      setEvents(mapToSchedulerEvents(list))
    } catch (err) {
      console.warn('Failed to reload events', err)
    }
  }

  async function handleCreateEvent(event) {
    try {
      const toDateObj = (d) => (d instanceof Date ? d : new Date(String(d)));
      // Prefer explicit ISO startDate/endDate from caller when available. Fall back
      // to composing from date+time or defaulting to 60 minutes.
      let start = null;
      let end = null;
      if (event && event.startDate) start = toDateObj(event.startDate);
      if (event && event.endDate) end = toDateObj(event.endDate);
      if (!start) {
        if (event && event.date && event.time) {
          start = toDateObj(new Date(String(event.date) + 'T' + String(event.time)));
        } else {
          start = new Date();
        }
      }
      if (!end) {
        if (event && event.endTime && event.date) {
          end = toDateObj(new Date(String(event.date) + 'T' + String(event.endTime)));
        } else if (typeof event.durationMinutes !== 'undefined' && event.durationMinutes !== null) {
          end = new Date(start.getTime() + Number(event.durationMinutes) * 60000);
        } else {
          end = new Date(start.getTime() + 60 * 60 * 1000);
        }
      }

      const pad = (n) => String(n).padStart(2, '0');
      const localDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
      const time = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
      const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

      const meta = {};
      if (event && event.color) meta.color = event.color;
      if (event.variant) meta.variant = event.variant;
      if (typeof durationMinutes !== 'undefined' && durationMinutes !== null) meta.durationMinutes = Number(durationMinutes);

      const body = {
        title: event.title,
        description: event.description && String(event.description).trim() ? String(event.description) : null,
        date: localDate,
        time,
        durationMinutes,
        startDate: start instanceof Date ? start.toISOString() : start,
        endDate: end instanceof Date ? end.toISOString() : end,
        raw: event.raw ?? null,
        // include explicit type and color when provided by caller
        ...(event && event.type ? { type: event.type } : {}),
        ...(event && event.color ? { color: event.color } : {}),
      };
  try { console.info('[timetable] creating event - body preview:', JSON.stringify({ startDate: body.startDate, endDate: body.endDate, durationMinutes: body.durationMinutes, date: body.date, time: body.time, title: body.title }).slice(0,2000)); } catch (e) {}
      if (Object.keys(meta).length > 0) body.meta = meta;
      if (event && event.recurrence && event.recurrence.id) body.repeatOption = event.recurrence.id;
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
        body.userId = 'smoke_user';
      }
      
      const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const text = await res.text()
      if (!res.ok) {
        let msg = text
        try {
          const parsed = JSON.parse(text)
          msg = parsed?.error || parsed?.message || JSON.stringify(parsed)
        } catch (e) {}
        const err = new Error(msg || `POST /api/events failed with ${res.status}`)
        ;(err).status = res.status
        throw err
      }

      let parsed = null
      try { parsed = JSON.parse(text) } catch (e) { parsed = null }
      const created = parsed?.event ?? parsed ?? null
      if (created) return created
      await reloadEvents()
      return null
    } catch (err) {
      console.warn('Failed to create event', err)
      throw err
    }
  }

  async function handleUpdateEvent(event) {
    try {
      const id = event.id
      if (!id) {
        await reloadEvents()
        return
      }
      const toDateObj = (d) => (d instanceof Date ? d : new Date(String(d)));
      const start = toDateObj(event.startDate || new Date());
      const end = toDateObj(event.endDate || new Date(start.getTime() + 60 * 60 * 1000));
      const pad = (n) => String(n).padStart(2, '0');
      const localDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
      const time = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
      const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

      const body = {
        title: event.title,
        description: (() => {
          const base = event.description || null;
          const meta = {};
          if (event && event.color) meta.color = event.color;
          if (event.variant) meta.variant = event.variant;
          if (typeof durationMinutes !== 'undefined' && durationMinutes !== null) meta.durationMinutes = Number(durationMinutes);
          if (Object.keys(meta).length === 0) return base;
          try {
            return (base ? base + '\n\n' : '') + '[META]' + JSON.stringify(meta) + '[META]';
          } catch (e) {
            return base;
          }
        })(),
        date: localDate,
        time,
        durationMinutes,
        startDate: start instanceof Date ? start.toISOString() : start,
        endDate: end instanceof Date ? end.toISOString() : end,
        raw: event.raw ?? null,
      };
      if (event && event.recurrence && event.recurrence.id) body.repeatOption = event.recurrence.id;
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
        body.userId = 'smoke_user';
      }
      
      const res = await fetch(`/api/events/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const text = await res.text();
      if (!res.ok) {
        const err = new Error(text || `PATCH /api/events/${id} failed with ${res.status}`);
        err.status = res.status;
        throw err;
      }
      try {
        return JSON.parse(text)?.event ?? null;
      } catch (e) {
        return null;
      }
      
      await reloadEvents()
    } catch (err) {
      console.warn('Failed to update event', err)
      throw err
    }
  }

  async function handleDeleteEvent(id) {
    try {
      if (!id) return
      await fetch(`/api/events/${encodeURIComponent(id)}`, { method: 'DELETE' })
      await reloadEvents()
    } catch (err) {
      console.warn('Failed to delete event', err)
    }
  }

  useEffect(() => {
    (async () => {})();
  }, []);

  // Load user's calendar settings (weekStartsOn) from localStorage and
  // respond to settings changes dispatched by the settings page.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const load = () => {
      try {
        const raw = localStorage.getItem('up:settings');
        const parsed = raw ? JSON.parse(raw) : null;
        setAppWeekStartsOn(parsed?.weekStartsOn || 'monday');
        setAppDefaultView(parsed?.defaultView || 'week');
      } catch (e) {
        setAppWeekStartsOn('monday');
        setAppDefaultView('week');
      }
    };
    load();

    const onSettings = (e) => {
      const detail = e?.detail || {};
      if (detail.weekStartsOn) setAppWeekStartsOn(detail.weekStartsOn);
      if (detail.defaultView) setAppDefaultView(detail.defaultView);
    };
    window.addEventListener('app:settings:changed', onSettings);
    return () => window.removeEventListener('app:settings:changed', onSettings);
  }, []);

  return (
    <div className="timetable-root min-h-screen bg-slate-50 dark:bg-[var(--card-bg)]">
      <style jsx global>{`
        /* Make sure NextUI modal/backdrop appear above everything */
        [data-nextui-dialog-backdrop], [data-nextui-dialog], .nextui-portal, .modal-portal, .modal-container, .modal-panel {
          z-index: 2147483647 !important;
        }

        /* Light mode scheduler styles */
        .mina-scheduler-root {
          background: #ffffff;
        }
        
        .mina-scheduler-root .scheduler-header,
        .mina-scheduler-root .scheduler-body,
        .mina-scheduler-root .calendar-cell {
          background: #f8fafc;
          border-color: #e2e8f0;
        }

        .mina-scheduler-root .event-card {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          border: none;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        /* Dark mode scheduler overrides */
        html.dark .mina-scheduler-root {
          background: var(--card-bg);
        }
        
        html.dark .mina-scheduler-root .scheduler-header,
        html.dark .mina-scheduler-root .scheduler-body,
        html.dark .mina-scheduler-root .calendar-cell {
          background: var(--card-bg);
          border-color: rgba(255,255,255,0.04);
        }

        /* Button styling - light mode */
        .mina-scheduler-root button,
        .mina-scheduler-root .btn,
        .mina-scheduler-root .nextui-button,
        .mina-scheduler-root [role="button"] {
          background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
          color: #ffffff;
          border: none;
          transition: all 0.2s ease;
        }

        .mina-scheduler-root button:hover,
        .mina-scheduler-root .btn:hover,
        .mina-scheduler-root .nextui-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);
        }

        /* Scrollbar styling - light mode */
        .timetable-root ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .timetable-root ::-webkit-scrollbar-track {
          background: #f1f5f9;
        }

        .timetable-root ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }

        .timetable-root ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* Dark mode scrollbar */
        html.dark .timetable-root ::-webkit-scrollbar-track {
          background: var(--card-bg);
        }

        html.dark .timetable-root ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
        }

        html.dark .timetable-root ::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.15);
        }
      `}</style>
      
      <Head>
        <title>Timetable — University Planner</title>
      </Head>

      {/* Modern Header - adapts to light/dark mode */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[var(--card-bg)] px-8 py-3 sticky top-0 z-40 backdrop-blur-lg bg-opacity-80">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-[var(--brand-900)]">Timetable</h1>
              <p className="text-xs text-slate-600 dark:text-[var(--muted-700)]">Manage your schedule</p>
            </div>
          </div>
          
          <div className="relative" ref={quickRef}>
            <button onClick={() => setQuickOpen((s) => !s)} className="px-5 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/30 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Event
            </button>
            {quickOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[var(--card-bg)] border rounded-md shadow-lg p-3 z-30">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-slate-700 dark:text-[var(--brand-900)]">Quick Create</div>
                  <button onClick={() => setQuickOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
                </div>
                <div className="flex flex-col gap-2">
                  <input value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} placeholder="Event title" className="w-full px-2 py-1 border rounded text-sm" />
                  <select value={quickType} onChange={(e) => setQuickType(e.target.value)} className="w-full px-2 py-1 border rounded text-sm">
                    <option value="lecture">Lecture</option>
                    <option value="assignment">Assignment</option>
                    <option value="deadline">Deadline</option>
                    <option value="personal">Personal</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-500">Color</div>
                    {['blue','red','green','yellow'].map(c => (
                      <button key={c} onClick={() => setQuickColor(c)} className={`w-6 h-6 rounded ${c === 'blue' ? 'bg-blue-600' : c === 'red' ? 'bg-red-600' : c === 'green' ? 'bg-green-600' : 'bg-yellow-500'} ${quickColor===c ? 'ring-2 ring-offset-1 ring-purple-500' : ''}`} />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => { setQuickOpen(false); setQuickTitle(''); setQuickType('lecture'); setQuickColor(null); }} className="px-3 py-1 text-sm border rounded">Cancel</button>
                    <button disabled={creatingQuick} onClick={async () => {
                      try {
                        setCreatingQuick(true);
                        const now = new Date();
                        const ev = {
                          title: quickTitle && quickTitle.trim() ? quickTitle.trim() : (quickType.charAt(0).toUpperCase() + quickType.slice(1)),
                          description: null,
                          startDate: now,
                          endDate: new Date(now.getTime() + 60*60*1000),
                          type: quickType,
                          color: quickColor
                        };
                        await handleCreateEvent(ev);
                        await reloadEvents();
                        setQuickOpen(false);
                        setQuickTitle(''); setQuickType('lecture'); setQuickColor(null);
                      } catch (e) {
                        console.warn('Quick create failed', e);
                        // leave popover open for retry
                      } finally {
                        setCreatingQuick(false);
                      }
                    }} className="px-3 py-1 text-sm bg-purple-600 text-white rounded disabled:opacity-60">Create</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-600 dark:text-[var(--muted-700)]">Loading scheduler...</p>
            </div>
          </div>
        ) : SchedulerProviderComp && SchedularViewComp ? (
          <div className="mina-scheduler-root bg-white dark:bg-[var(--card-bg)] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <SchedulerProviderComp
              initialState={events}
              weekStartsOn={appWeekStartsOn}
              onAddEvent={handleCreateEvent}
              onUpdateEvent={handleUpdateEvent}
              onDeleteEvent={handleDeleteEvent}
              recurrenceOptions={recurrenceOptions}
            >
              <div style={{ minHeight: 600 }} className="p-6">
                <SchedularViewComp initialView={appDefaultView} events={events} views={{ views: ['day', 'week', 'month'], mobileViews: ['day'] }} />
              </div>
            </SchedulerProviderComp>
          </div>
        ) : (
          <div className="bg-white dark:bg-[var(--card-bg)] rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-lg">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-[var(--brand-900)] mb-2">Scheduler Unavailable</h3>
              <p className="text-slate-600 dark:text-[var(--muted-700)]">Displaying events in list view</p>
            </div>
            
            {events.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-[var(--muted-600)]">No events scheduled</p>
                <p className="text-sm text-slate-400 dark:text-[var(--muted-700)] mt-2">Click "Create Event" to add one</p>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((ev) => (
                  <div key={ev.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-500/50 transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/10">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-[var(--brand-900)]">{ev.title}</h3>
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs rounded-full font-medium">
                        Event
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-[var(--muted-700)] mb-3">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(ev.startDate).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {new Date(ev.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(ev.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {ev.description && (
                      <p className="text-slate-700 dark:text-[var(--muted-600)] text-sm leading-relaxed">{ev.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}