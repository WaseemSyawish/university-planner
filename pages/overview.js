import Head from 'next/head';
import { useEffect, useState } from 'react';
import Brand from '../src/components/Brand';
import { signOut } from 'next-auth/react';
import EventCard from '../src/components/EventCard';
import WeekStrip from '../src/components/WeekStrip';
import { replaceTmpWithServerEvent } from '../lib/eventHelpers';
// WeekAgendaPanel logic will be inlined below; remove separate import
import Modal from '../src/components/Modal';
import TaskForm from '../src/components/TaskForm';

export async function getServerSideProps(ctx) {
  try {
    const { req } = ctx;
    const { getToken } = await import('next-auth/jwt');
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
    if (!token) {
      // fallback: sometimes middleware uses a pragmatic HttpOnly userId cookie — check raw header
      const cookieHeader = req && req.headers && req.headers.cookie ? String(req.headers.cookie) : '';
      if (cookieHeader && cookieHeader.includes('userId=')) {
        return { props: {} };
      }
      // Not authenticated: send to sign-in and preserve returnTo (use /overview as post-login landing)
      return { redirect: { destination: '/signin?returnTo=/overview', permanent: false } };
    }
    // Authenticated — allow the overview page to render the dashboard UI
    return { props: {} };
  } catch (err) {
    console.warn('overview getServerSideProps failed', err);
    return { redirect: { destination: '/signin?returnTo=/overview', permanent: false } };
  }
}

export default function Overview() {
  // ...existing code...
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('quick');
  
  // Shared create handler used by modal forms (optimistic update + server POST)
    const handleCreate = async (payload) => {
      const tmp = { id: 'tmp-' + Date.now(), ...payload };
      setEvents((s) => [tmp, ...s]);
      try {
        const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) {
          const data = await res.json();
          const serverEvent = data && (data.event || (Array.isArray(data) ? data[0] : data));
          if (serverEvent && serverEvent.id) {
            // If server materialized multiple occurrences, refresh entire events list
            if (serverEvent._materialized_count && Number(serverEvent._materialized_count) > 1) {
              try {
                const r = await fetch('/api/events');
                if (r.ok) {
                  const pl = await r.json();
                  setEvents(pl.events || []);
                }
              } catch (e) { /* ignore, fallback to replace */ }
            } else {
              setEvents((s) => replaceTmpWithServerEvent(s, tmp.id, serverEvent));
            }
          }
        }
      } catch (err) {
        console.warn(err);
      }
  }
  const [events, setEvents] = useState([]);
  const [attendanceData, setAttendanceData] = useState({ sessions: [], rate: null });
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Resolve current user via /api/auth/me so local-dev cookie or next-auth can be used.
        const am = await fetch('/api/auth/me');
        if (!mounted) return;
        let userId = null;
        if (am.ok) {
          const j = await am.json();
          if (j && j.authenticated) { userId = j.id; if (j.name) setUserName(j.name); }
        }
        // If we couldn't resolve userId, bail with empty lists
        if (!userId) { setEvents([]); setCourses([]); return; }

        const [er, cr] = await Promise.all([
          fetch('/api/events'),
          fetch('/api/courses'),
        ]);
        if (!mounted) return;
        if (er.ok) { const j = await er.json(); setEvents(j.events || []); }
        if (cr.ok) { const j = await cr.json(); setCourses(j.courses || []); }
        // fetch attendance summary
        try {
          const at = await fetch('/api/attendance');
          if (at.ok) { const aj = await at.json(); setAttendanceData(aj); }
        } catch (e) { /* ignore */ }
      } catch (e) {
        console.warn('overview fetch failed', e);
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const upcoming = events.slice(0,6);
  // UI cap for immediate aside list
  const UPCOMING_VISIBLE = 4;
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const stats = {
    total: events.length,
    courses: courses.length,
    upcoming: upcoming.length
  };

  // pick a next upcoming event (first in events which is assumed sorted by date)
  const nextEvent = events && events.length ? events.find(e => new Date(e.date) >= new Date()) || events[0] : null;
  const todayIso = new Date().toISOString().slice(0,10);
  const firstName = userName ? userName.split(' ')[0] : null;

  // Configurable threshold: only show the full upcoming modules list when we have
  // at least this many upcoming events. This keeps the aside tidy when there are
  // very few events and avoids visual noise.
  const UPCOMING_MIN_ITEMS = 1; // change to 2+ to require more items

  // --- Inline WeekAgendaPanel helpers/state ---
  function isoDate(d) {
    const dt = typeof d === 'string' ? new Date(d) : d instanceof Date ? d : new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    // return local YYYY-MM-DD without converting to UTC
    return `${y}-${m}-${day}`;
  }
  function buildWeek(startIso) {
    const base = new Date(startIso + 'T00:00:00');
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      days.push(isoDate(d));
    }
    return days;
  }

  const weekTodayIso = isoDate(todayIso);
  const [selectedDay, setSelectedDay] = useState(weekTodayIso);
  // weekStart controls which 7-day window the WeekStrip shows; default to this week (today)
  const [weekStart, setWeekStart] = useState(weekTodayIso);

  // ensure external changes to todayIso propagate if needed
  useEffect(() => { setSelectedDay(isoDate(todayIso)); }, [todayIso]);

  // weekDays intentionally omitted (not needed here)

  const eventsByDay = (function(){
    const map = {};
    (events || []).forEach(ev => {
      const d = ev.start || ev.date || ev.startIso || ev.startsAt || ev.dt || null;
      const iso = d ? isoDate(d) : null;
      if (iso) { if (!map[iso]) map[iso] = []; map[iso].push(ev); }
    });
    Object.keys(map).forEach(k => {
      map[k].sort((a,b) => {
        const ta = a.start || a.date || a.startsAt || a.dt || a.startIso || '';
        const tb = b.start || b.date || b.startsAt || b.dt || b.startIso || '';
        return new Date(ta) - new Date(tb);
      });
    });
    return map;
  })();

  const todaysEvents = eventsByDay[selectedDay] || [];
  return (
  <div className="landing-root cozy calendar-root">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </Head>

        <style>{`/* Overview page visual tweaks: brighter widgets, wider aside, spacing */
          /* Slightly brighter cards so they stand out from the page background */
          .agenda-card, .aside-widget, .hero-right .aside-widgets .aside-widget { background: linear-gradient(180deg, var(--card-bg), rgba(255,255,255,0.02)); }
          /* In dark mode, nudge them lighter than the page surface so they separate */
          html.dark .agenda-card, html.dark .aside-widget { background: linear-gradient(180deg, rgba(11,18,32,0.72), rgba(7,10,20,0.9)); border-color: rgba(255,255,255,0.04); }
          /* Make the widgets stack take the same width as the hero content area */
          .hero-right .aside-widgets { width: 100%; display: grid; grid-template-columns: 1fr; gap: 12px; }
          /* Ensure widgets have comfortable bottom padding and separation from hero */
          .aside-widget { padding-bottom: 18px; padding-top: 12px; }
          /* Slightly more space between navbar and hero */
          header.landing-nav { padding-top: 26px; padding-bottom: 18px; }
          /* Tighten the hero -> navbar visual gap in small screens while preserving layout */
          @media (min-width: 900px) {
            .hero-grid { gap: 26px; }
            .landing-hero { margin-top: 32px; }
          }
          /* Constrain hero and aside widgets to the same centered width and add bottom padding */
          .overview-inner { max-width: 1200px; margin: 0 auto; padding: 0 18px; box-sizing: border-box; width: 100%; }
          .landing-root { padding-bottom: 80px; }
          /* Dashboard grid should simply fill the overview-inner container, just like hero-grid */
          .overview-dashboard-grid { 
            display: grid !important; 
            grid-template-columns: 1.5fr 1fr !important; 
            gap: 24px !important; 
            width: 100% !important; 
            box-sizing: border-box !important;
          }
          .overview-dashboard-grid > * { 
            min-width: 0 !important; 
            width: 110% !important;
            box-sizing: border-box !important;
          }
          .overview-dashboard-grid > *:first-child { 
          margin-left: -45px !important;
          }
          @media (max-width: 900px) { .overview-dashboard-grid { grid-template-columns: 1fr !important; } }
          `}</style>

  <header className="landing-nav cozy">
        <div className="container nav-row nav-right">
          <div className="nav-left brand-block">
            <Brand size="md" />
            <div className="brand-text-wrap">
              <div className="brand-text">University Planner</div>
              <div className="muted-sm">Overview</div>
            </div>
          </div>
          <div className="nav-right">
            <a className="btn btn-ghost nav-link" href="/settings">Settings</a>
            {firstName && <div className="profile-btn ml-2" title={userName}>{firstName.slice(0,1).toUpperCase()}</div>}
            <button className="btn btn-primary nav-cta ml-2" onClick={async () => { try { try { await fetch('/api/auth/local-signout', { method: 'POST' }); } catch (e) { } await signOut({ callbackUrl: '/landing' }); } catch (e) { window.location.href = '/signout'; } }}>Sign out</button>
          </div>
        </div>
      </header>

      <main>
  <section id="landing-hero" className="landing-hero container cozy" role="main">
          <div className="overview-inner">
            <div className="hero-grid">
            <div className="hero-left">
              <h1 className="hero-title">Good morning, {firstName || 'there'}</h1>
              <p className="hero-sub">Overview of your day and week — quick access to calendar, courses and tasks.</p>
              <div className="hero-cta">
                <a className="btn btn-primary" href="/calendar">Open calendar</a>
                <button className="btn btn-outline" onClick={() => { setModalMode('create'); setModalOpen(true); }}>Create event</button>
                <button className="btn btn-ghost" onClick={() => { setModalMode('quick'); setModalOpen(true); }}>Quick actions</button>
              </div>
            </div>
            {/* hero-right: put the Attendance widget back here so it sits alongside the hero-left content */}
            <div className="hero-right">
              <div className="aside-widgets" aria-live="polite">
                <div className="aside-widget section-block">
                  <div className="widget-header" style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div className="widget-title">Attendance</div>
                      <div className="muted-sm">Recent summary</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '20px', fontWeight: 700 }}>{attendanceData.rate !== null ? `${attendanceData.rate}%` : '—'}</div>
                      <div className="muted-sm">{attendanceData.sessions.length} sessions</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {attendanceData.sessions.slice(0,4).map(s => (
                        <div key={s.id} className="mini-event compact-session" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div className="mini-chip" style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, color: '#fff', fontWeight: 700, background: (s.status === 'PRESENT' ? 'var(--success, #10b981)' : 'var(--warning, #f97316)') }} aria-hidden>{(s.status||'P').slice(0,1)}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{s.course_name || s.notes || 'Session'}</div>
                            <div className="muted-sm">{new Date(s.date).toLocaleDateString()}</div>
                          </div>
                          <div>
                            <a className="btn btn-ghost" href="/attendance">Open attendance</a>
                          </div>
                        </div>
                      ))}
                      {attendanceData.sessions.length === 0 && (<div className="muted-sm">No attendance data</div>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </section>
        <style>{`/* Center hero-left vertically and ensure hero has min height */
          .landing-hero { display: flex; align-items: center; }
          /* Use the page container as the alignment boundary so the right widget sits flush to the container edge */
          /* Use flex so the right widget can be pushed to the far right (margin-left:auto) even when a sidebar is present */
          .hero-grid { display: flex; gap: 32px; align-items: center; width: 100%; }
          .hero-left { flex: 1 1 auto; min-width: 0; }
          /* Right column aligns content to the far right edge of the container by taking auto left margin */
          .hero-right { margin-left: auto; display: flex; align-items: center; justify-content: flex-end; }
          .hero-right .aside-widgets { width: 100%; max-width: 460px; flex: 0 0 460px; }
          @media (max-width: 900px) { .hero-grid { grid-template-columns: 1fr; gap: 18px; } .hero-right { justify-content: stretch; } .hero-right .aside-widgets { width: 100%; max-width: none; } }
          /* full-width widgets container placed below hero - placed inside .container so widths match exactly with hero */
          .full-width-aside-widgets { display: grid; grid-template-columns: 1fr; gap: 12px; margin: 18px 0; width: 100%; }
          .container > .full-width-aside-widgets { padding: 0; margin-left: 0; margin-right: 0; box-sizing: border-box; }
          `}</style>

        {/* full-width widgets placed under hero so they match hero width. Other widgets can be added here later. */}
        <div className="container">
          <div className="full-width-aside-widgets">
            <div className="aside-widgets" aria-live="polite">
              {/* Intentionally left empty (attendance moved into the hero). Add other widgets here if needed. */}
            </div>
          </div>
        </div>

        <section className="container mt-1">
          <div className="overview-inner">
            <div className="dashboard-grid mt-2 overview-dashboard-grid">
            <div className="agenda-card cozy">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div className="week-controls" style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost week-arrow text-slate-900 dark:text-slate-100" aria-label="Previous week" onClick={() => {
                    const parts = weekStart.split('-');
                    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                    d.setDate(d.getDate() - 7);
                    setWeekStart(new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0,10));
                  }}>◀</button>
                  <button className="btn btn-ghost week-arrow text-slate-900 dark:text-slate-100" aria-label="Next week" onClick={() => {
                    const parts = weekStart.split('-');
                    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                    d.setDate(d.getDate() + 7);
                    setWeekStart(new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0,10));
                  }}>▶</button>
                </div>
              </div>
              <div className="mt-2"><WeekStrip events={events} selectedDay={selectedDay} onSelectDay={(d) => setSelectedDay(d)} startDay={weekStart} /></div>
              <h3 style={{ marginTop: 10 }}>This week</h3>
              <h4 className="section-title mt-2">Agenda for {(() => {
                if (!selectedDay) return '';
                const parts = selectedDay.split('-');
                if (parts.length !== 3) return selectedDay;
                const y = Number(parts[0]);
                const m = Number(parts[1]) - 1;
                const d = Number(parts[2]);
                return new Date(y, m, d).toLocaleDateString();
              })()}</h4>
              {(!todaysEvents || todaysEvents.length === 0) && (<div className="agenda-empty">No events for this day.</div>)}
              <div className="event-list mt-2">
                {todaysEvents.map(ev => (
                  <div key={ev.id || (ev._id || JSON.stringify(ev))}>
                    <EventCard ev={ev} />
                  </div>
                ))}
              </div>
            </div>

            <aside className="agenda-card cozy" aria-labelledby="upcoming-heading" role="complementary">
              <h3>Upcoming</h3>
              {loading && <div>Loading events…</div>}
              {!loading && upcoming.length < UPCOMING_MIN_ITEMS && (
                <div className="agenda-empty">No upcoming events to display.</div>
              )}
              {!loading && upcoming.length >= UPCOMING_MIN_ITEMS && (
                <>
                  <div style={{ maxHeight: showAllUpcoming ? 320 : 220, overflow: 'auto', paddingRight: 6 }}>
                    {(showAllUpcoming ? upcoming : upcoming.slice(0, UPCOMING_VISIBLE)).map(ev => (
                      <div key={ev.id || JSON.stringify(ev)} style={{ marginBottom: 10 }}>
                        <EventCard ev={ev} onEdit={() => { window.location.href = '/calendar'; }} />
                      </div>
                    ))}
                  </div>
                  {upcoming.length > UPCOMING_VISIBLE && (
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <button className="btn btn-ghost" onClick={() => setShowAllUpcoming(s => !s)}>{showAllUpcoming ? 'Show less' : `Show all (${upcoming.length})`}</button>
                    </div>
                  )}
                </>
              )}
            </aside>
          </div>
        </div>
        </section>
      </main>

      {/* Modal instance used for Quick actions and Create event */}
      <Modal title={modalMode === 'create' ? 'Create event' : 'Quick actions'} open={modalOpen} onClose={() => setModalOpen(false)}>
        {modalMode === 'quick' ? (
          <>
            <div className="modal-actions">
              <a className="btn btn-primary" href="/calendar">Open calendar</a>
              <button className="btn btn-ghost" onClick={() => { setModalMode('create'); }}>Create event</button>
            </div>
            <div style={{ marginTop: 12 }}>
              <h4>Create quick event</h4>
              <QuickCreateForm onCreate={handleCreate} />
            </div>
          </>
        ) : (
          <div style={{ marginTop: 6 }}>
            <TaskForm onCreate={handleCreate} onCancel={() => setModalOpen(false)} />
          </div>
        )}
      </Modal>
  {/* Width debugger removed for production */}
    </div>
  );
}

function QuickCreateForm({ onCreate }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [course, setCourse] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); const ev = { id: 'tmp-' + Date.now(), title, date: date || new Date().toISOString(), course_name: course }; onCreate(ev); setTitle(''); setDate(''); setCourse(''); }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="p-2" />
        <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="p-2" />
        <input placeholder="Course (optional)" value={course} onChange={(e) => setCourse(e.target.value)} className="p-2" />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" type="submit">Create</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setTitle(''); setDate(''); setCourse(''); }}>Clear</button>
        </div>
      </div>
    </form>
  );
}