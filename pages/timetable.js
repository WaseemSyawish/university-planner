// Minimal timetable page using mina-scheduler native UI
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
    // Attempt to extract any embedded meta (color/variant/duration) from the description
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
        // remove meta marker from shown description
        desc = String(desc).replace(metaMatch[0], '').trim();
      }
    } catch (err) {
      // ignore parse errors
    }

    const durationMinutes = Number(parsedDuration ?? e.durationMinutes ?? e.duration ?? 60)

    const rawEnd = e.endDate || e.end_date || (e.raw && (e.raw.endDate || e.raw.end_date));
    const endDate = rawEnd ? new Date(String(rawEnd)) : new Date(start.getTime() + durationMinutes * 60000);
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
        // fetch recurrence options (non-blocking for events)
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

  // reload events from server and update local state
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

  // Handlers passed to the SchedulerProvider - they persist changes to /api/events then reload
  async function handleCreateEvent(event) {
    try {
      // Convert incoming Date objects to the API's expected shape: date (YYYY-MM-DD), time (HH:MM), durationMinutes
      const toDateObj = (d) => (d instanceof Date ? d : new Date(String(d)));
      const start = toDateObj(event.startDate || new Date());
      const end = toDateObj(event.endDate || new Date(start.getTime() + 60 * 60 * 1000));

      const pad = (n) => String(n).padStart(2, '0');
      const localDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
      const time = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
      const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

      // Build body without creating a META-only description. Send meta separately.
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
      };
      if (Object.keys(meta).length > 0) body.meta = meta;
      // include recurrence option if present on the event (id of the selected recurrence option)
      if (event && event.recurrence && event.recurrence.id) body.repeatOption = event.recurrence.id;
      // In development, include dev user id so API accepts the request without auth
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
        body.userId = 'smoke_user';
      }
      const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const text = await res.text()
      if (!res.ok) {
        // Try to parse JSON error body if present
        let msg = text
        try {
          const parsed = JSON.parse(text)
          msg = parsed?.error || parsed?.message || JSON.stringify(parsed)
        } catch (e) {}
        const err = new Error(msg || `POST /api/events failed with ${res.status}`)
        // attach status so callers (provider) can make informed decisions
        ;(err).status = res.status
        throw err
      }

      // Parse successful response and return server-canonical event if available
      let parsed = null
      try { parsed = JSON.parse(text) } catch (e) { parsed = null }
      const created = parsed?.event ?? parsed ?? null
      // If the server indicated it materialized multiple occurrences, reload the list
      if (created && (created._materialized_count && Number(created._materialized_count) > 1)) {
        await reloadEvents()
        return null
      }
      if (created) return created
      // Fallback: if server didn't return an event object, refresh the list
      await reloadEvents()
      return null
    } catch (err) {
      console.warn('Failed to create event', err)
      // Rethrow so the provider can detect the failure and fall back or surface validation errors
      throw err
    }
  }

  async function handleUpdateEvent(event) {
    try {
      const id = event.id
      if (!id) {
        // fallback: reload all
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
      // include recurrence option when updating
      if (event && event.recurrence && event.recurrence.id) body.repeatOption = event.recurrence.id;
      // In development, include dev user id so PATCH is accepted when necessary
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
        body.userId = 'smoke_user';
      }
      
        const res = await fetch(`/api/events/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        const text = await res.text();
        if (!res.ok) {
          // If record was missing (404) and the update included a recurrence, try creating a new materialized series
          if (res.status === 404 && event && event.recurrence && event.recurrence.id && event.recurrence.id !== 'none') {
            try {
              const postBody = { ...body };
              postBody.repeatOption = event.recurrence.id;
              postBody.materialize = true;
              if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') postBody.userId = 'smoke_user';
              const createResp = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(postBody) });
              if (createResp.ok) {
                // reload authoritative list
                await reloadEvents();
                return null;
              }
            } catch (cf) {
              console.warn('Fallback create after missing event failed', cf);
            }
          }
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
      // Rethrow so provider can handle fallback/validation
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

  // Runtime diagnostics printed to browser console to help debug missing modal / style issues
  useEffect(() => {
    (async () => {
      // runtime diagnostics removed for production/development performance
    })();
  }, []);

  return (
    <div className="timetable-root min-h-screen bg-slate-50">
      <style jsx global>{`
        /* Ensure scheduler area uses dark readable text (override app muted tokens) */
        .mina-scheduler-root, .mina-scheduler-root * {
          color: #0f172a !important; /* slate-900 */
        }

        /* Make sure NextUI modal/backdrop appear above everything */
        [data-nextui-dialog-backdrop], [data-nextui-dialog], .nextui-portal, .modal-portal, .modal-container, .modal-panel {
          z-index: 2147483647 !important;
        }

        /* If the scheduler renders portal children outside our tree, ensure they inherit readable color */
        .nextui-portal, [data-nextui-dialog-backdrop], [data-nextui-dialog] {
          color: #0f172a !important;
        }
        /* Ensure buttons with colored backgrounds in the scheduler have white text for contrast */
        .mina-scheduler-root button,
        .mina-scheduler-root .btn,
        .mina-scheduler-root .nextui-button,
        .mina-scheduler-root [role="button"] {
          color: #ffffff !important;
        }
        .mina-scheduler-root .nextui-button .nextui-button-text,
        .mina-scheduler-root .btn .btn-text {
          color: #ffffff !important;
        }
      `}</style>
      <Head>
        <title>Timetable — University Planner</title>
      </Head>

      <header className="bg-white border-b px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold">Timetable</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {loading ? (
          <div>Loading scheduler...</div>
        ) : SchedulerProviderComp && SchedularViewComp ? (
          <div className="mina-scheduler-root">
            <SchedulerProviderComp
              initialState={events}
              weekStartsOn="monday"
              onAddEvent={handleCreateEvent}
              onUpdateEvent={handleUpdateEvent}
              onDeleteEvent={handleDeleteEvent}
              recurrenceOptions={recurrenceOptions}
            >
              <div style={{ minHeight: 520 }}>
                <SchedularViewComp events={events} views={{ views: ['day', 'week', 'month'], mobileViews: ['day'] }} />
              </div>
            </SchedulerProviderComp>
          </div>
        ) : (
          <div className="p-6 border rounded bg-white">
            <div className="text-sm text-slate-600 mb-4">mina-scheduler not available — preview events below</div>
            <div className="space-y-3">
              {events.map((ev) => (
                <div key={ev.id} className="p-3 border rounded-md bg-white shadow-sm">
                  <div className="font-medium text-slate-900">{ev.title}</div>
                  <div className="text-xs text-slate-500">{String(ev.startDate)} — {String(ev.endDate)}</div>
                  <div className="text-sm mt-2 text-slate-700">{ev.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}