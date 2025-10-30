import React, { useMemo, useState, useEffect } from 'react';
import WeekStrip from './WeekStrip';
import EventCard from './EventCard';
import { parseDatePreserveLocal, buildLocalDateFromParts, toYMDLocal } from '../lib/dateHelpers';

function isoDate(d) {
  const dt = parseDatePreserveLocal(d) || (typeof d === 'string' ? buildLocalDateFromParts(String(d).slice(0,10)) : (d instanceof Date ? d : new Date()));
  return toYMDLocal(dt);
}

function buildWeek(startIso) {
  const base = buildLocalDateFromParts(startIso) || new Date();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base.getTime());
    d.setDate(base.getDate() + i);
    days.push(isoDate(d));
  }
  return days;
}

export default function WeekAgendaPanel({ events = [], initialSelectedDay }) {
  const todayIso = isoDate(initialSelectedDay || new Date());
  const [selectedDay, setSelectedDay] = useState(todayIso);

  // Re-sync if parent changes initialSelectedDay
  useEffect(() => {
    if (initialSelectedDay) setSelectedDay(isoDate(initialSelectedDay));
  }, [initialSelectedDay]);

  const weekDays = useMemo(() => buildWeek(selectedDay), [selectedDay]);

  // Index events per day (local timezone grouping)
  const eventsByDay = useMemo(() => {
    const map = {};
    (events || []).forEach(ev => {
      // prefer start date property, fall back to date or ISO
      const d = ev.start || ev.date || ev.startIso || ev.startsAt || ev.dt || null;
      const iso = d ? isoDate(d) : null;
      if (iso) {
        if (!map[iso]) map[iso] = [];
        map[iso].push(ev);
      }
    });
    // sort events per day by start time if available
    Object.keys(map).forEach(k => {
      map[k].sort((a,b) => {
        const ta = a.start || a.date || a.startsAt || a.dt || a.startIso || '';
        const tb = b.start || b.date || b.startsAt || b.dt || b.startIso || '';
        const aDt = parseDatePreserveLocal(ta) || null;
        const bDt = parseDatePreserveLocal(tb) || null;
        if (aDt && bDt) return aDt.getTime() - bDt.getTime();
        if (aDt) return -1;
        if (bDt) return 1;
        return 0;
      });
    });
    return map;
  }, [events]);

  // events for the currently selected day
  const todaysEvents = eventsByDay[selectedDay] || [];

  return (
    <section className="agenda-card" role="region" aria-labelledby="weekagenda-heading">
      <div className="agenda-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h3 id="weekagenda-heading" style={{ margin: 0 }}>This week</h3>
          <div style={{ marginTop: 6, color: 'var(--muted-600)', fontSize: 13 }}>{(buildLocalDateFromParts(selectedDay) || new Date()).toLocaleDateString()}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <a href={`/calendar?date=${selectedDay}`} style={{ fontSize: 13 }}>Open calendar →</a>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {/* startDay controls the first day shown in the strip; use the currently selected day so the strip moves when user picks another day */}
        <WeekStrip events={events} selectedDay={selectedDay} onSelectDay={(d) => setSelectedDay(d)} startDay={selectedDay} />
      </div>

      <div style={{ marginTop: 14 }}>
  <h4 className="section-title" style={{ margin: '4px 0 12px 0', fontSize: '1rem' }}>Agenda for {(buildLocalDateFromParts(selectedDay) || new Date()).toLocaleDateString()}</h4>

        {(!todaysEvents || todaysEvents.length === 0) && (
          <div className="agenda-empty">No events for this day.</div>
        )}

        <div className="event-list">
          {todaysEvents.map(ev => (
            <div key={ev.id || (ev._id || JSON.stringify(ev))} style={{ marginBottom: 10 }}>
              <EventCard ev={ev} compact={false} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
