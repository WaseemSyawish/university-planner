import React, { useMemo, useState } from 'react';
import { formatTimeFromParts } from '../../lib/dateHelpers';

function startOfMonth(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return x;
}

function addMonths(d, n) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function ymdFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function MonthView({ base = new Date(), events = [], selectedDay = null, onDayClick, onEventClick }) {
  const [anchor, setAnchor] = useState(() => startOfMonth(base));
  const monthName = useMemo(() => anchor.toLocaleString(undefined, { month: 'long', year: 'numeric' }), [anchor]);

  const firstDayWeekday = useMemo(() => new Date(anchor.getFullYear(), anchor.getMonth(), 1).getDay(), [anchor]);
  const totalDays = useMemo(() => daysInMonth(anchor), [anchor]);

  const grid = useMemo(() => {
    const cells = [];
    // compute previous month's tail
    const lead = (firstDayWeekday + 6) % 7; // convert Sun=0 to Mon-start index
    const prevMonthLast = new Date(anchor.getFullYear(), anchor.getMonth(), 0).getDate();
    for (let i = 0; i < lead; i++) {
      const day = prevMonthLast - (lead - 1 - i);
      const d = new Date(anchor.getFullYear(), anchor.getMonth() - 1, day);
      cells.push({ date: d, currentMonth: false });
    }
    for (let i = 1; i <= totalDays; i++) cells.push({ date: new Date(anchor.getFullYear(), anchor.getMonth(), i), currentMonth: true });
    // fill to complete weeks (42 cells)
    while (cells.length % 7 !== 0) {
      const idx = cells.length - (totalDays + lead) + 1;
      const d = new Date(anchor.getFullYear(), anchor.getMonth() + 1, idx);
      cells.push({ date: d, currentMonth: false });
    }
    return cells;
  }, [anchor, firstDayWeekday, totalDays]);

  const eventsByDay = useMemo(() => {
    const map = {};
    (events || []).forEach(ev => {
      if (!ev || !ev.date) return;
      // Normalize incoming date to YYYY-MM-DD when possible
      let key = null;
      if (typeof ev.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ev.date)) key = ev.date;
      else if (ev.date instanceof Date) key = ymdFromDate(ev.date);
      else if (typeof ev.date === 'string') key = String(ev.date).slice(0,10);
      else key = String(ev.date);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">{monthName}</h2>
            <div className="muted-sm">Month view</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost" onClick={() => setAnchor(a => addMonths(a, -1))}>Prev</button>
            <button className="btn btn-outline" onClick={() => setAnchor(startOfMonth(new Date()))}>Today</button>
            <button className="btn btn-ghost" onClick={() => setAnchor(a => addMonths(a, 1))}>Next</button>
          </div>
        </div>

  <div className="cozy border rounded-lg overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 bg-base-200 px-3 py-2 text-xs text-muted">
            <div className="text-center font-medium">Mon</div>
            <div className="text-center font-medium">Tue</div>
            <div className="text-center font-medium">Wed</div>
            <div className="text-center font-medium">Thu</div>
            <div className="text-center font-medium">Fri</div>
            <div className="text-center font-medium">Sat</div>
            <div className="text-center font-medium">Sun</div>
          </div>

          <div className="grid grid-cols-7 gap-0 p-2 cozy">
            {grid.map((cell, idx) => {
              const key = ymdFromDate(cell.date);
              const dayEvents = eventsByDay[key] || [];
              const isToday = new Date().toDateString() === cell.date.toDateString();
              const isSelected = selectedDay && new Date(selectedDay).toDateString() === cell.date.toDateString();
                return (
                <button key={idx} onClick={() => onDayClick && onDayClick(cell.date)} aria-label={`Open day ${cell.date.toDateString()}`} className={`group p-3 border-b border-r text-left transition transform hover:-translate-y-0.5 ${cell.currentMonth ? '' : 'opacity-60'} ${isToday ? 'ring-2 ring-indigo-200' : ''} ${isSelected ? 'bg-indigo-50' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="text-sm font-semibold text-gray-700">{cell.date.getDate()}</div>
                    <div className="text-xs text-gray-400">{cell.date.toLocaleString(undefined, { month: 'short' })}</div>
                  </div>
                  <div className="mt-2 min-h-[64px]">
                    <div className="flex flex-col gap-2">
                      {dayEvents.slice(0, 3).map(ev => (
                        <div key={ev.id || ev.title} onClick={(e) => { e.stopPropagation(); onEventClick && onEventClick(ev); }} role="button" aria-label={`Open event ${ev.title || ev.course_code || 'Event'}`} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEventClick && onEventClick(ev); } }} className="cal-event-pill cal-focus-ring">
                          <div className="w-2 h-8 rounded-sm flex-shrink-0" style={{ background: ev.courseColor || '#60A5FA' }} />
                          <div className="flex-1 min-w-0">
                            <div className="cal-event-title truncate">{ev.title || ev.course_code || 'Event'}</div>
                            <div className="cal-event-sub truncate">{ev.location || ev.room || ''}</div>
                          </div>
                          <div className="text-xs text-gray-400 ml-2">{ev.time ? formatTimeFromParts(ev.date, ev.time) : ''}</div>
                        </div>
                      ))}
                      {dayEvents.length > 3 && <div className="text-xs text-gray-400">+{dayEvents.length - 3} more</div>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="card p-4">
        <h3 className="font-semibold">Day details</h3>
        <div className="text-sm text-gray-500 mt-2">{selectedDay ? new Date(selectedDay).toDateString() : 'Click a day to view events.'}</div>
        {selectedDay && (
              <div className="mt-3 space-y-3">
            {(eventsByDay[ (typeof selectedDay === 'string' ? selectedDay : ymdFromDate(new Date(selectedDay))) ] || []).map(ev => (
              <div key={ev.id || ev.title} onClick={() => onEventClick && onEventClick(ev)} className="p-3 border rounded-md cursor-pointer hover:shadow-sm cozy">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-800">{ev.title || ev.course_code || 'Event'}</div>
                  <div className="text-sm text-gray-500">{ev.time ? formatTimeFromParts(ev.date, ev.time) : ''}</div>
                </div>
                {ev.location && <div className="text-sm text-gray-500 mt-1">{ev.location}</div>}
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
