import React, { useState } from 'react';
import { useCalendar } from './CalendarProvider';
import { parseDatePreserveLocal, buildLocalDateFromParts, toYMDLocal } from '../../lib/dateHelpers';

export default function AddEventDialog({ defaultDate }) {
  const { addEvent, updateEvent } = useCalendar();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate ? (parseDatePreserveLocal(defaultDate) || buildLocalDateFromParts(String(defaultDate).slice(0,10))) : new Date());
  const [time, setTime] = useState('09:00');
  const [color, setColor] = useState('blue');

  const submit = async (e) => {
    e.preventDefault();
    const [hh, mm] = time.split(':').map(Number);
    const start = new Date(date);
    start.setHours(hh, mm, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);

    const ev = {
      id: 'tmp-' + Date.now(),
      title: title || 'Untitled',
      description: '',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      color,
      user: { id: 'me', name: 'You' },
    };

    // optimistic add
    addEvent(ev);
    setTitle('');

    // Persist to server and attempt to replace optimistic entry with server-provided event
      try {
      const isDev = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');
      const payload = {
        title: ev.title,
        date: ev.startDate.slice(0,10),
        time: ev.startDate.split('T')[1].slice(0,5),
        endTime: ev.endDate.split('T')[1].slice(0,5),
        // include client-computed ISO instants so server doesn't have to guess timezone
        startDate: ev.startDate,
        endDate: ev.endDate,
        type: 'event',
        description: ev.description || null,
        location: null
      };
      if (isDev) payload.userId = 'smoke_user';
      const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res && res.ok) {
        const body = await res.json().catch(() => null);
        const created = body && (body.event || body);
        if (created && created.id) {
          // update provider-managed events via updateEvent exposed by CalendarProvider
          if (typeof updateEvent === 'function') {
            updateEvent({
              id: created.id,
              title: created.title || ev.title,
              // prefer server-provided ISO instants, fallback to our optimistic ones
              startDate: created.startDate || created.date || payload.startDate || ev.startDate,
              endDate: created.endDate || created.endTime || payload.endDate || ev.endDate,
              color: ev.color,
              user: ev.user
            });
          }
        }
      }
    } catch (err) {
      console.warn('Failed to persist AddEventDialog event', err);
    }
  };

  return (
    <form onSubmit={submit} className="flex gap-2 items-end">
      <div>
        <label className="block text-xs">Title</label>
        <input value={title} onChange={(e)=>setTitle(e.target.value)} className="border px-2 py-1" />
      </div>
      <div>
        <label className="block text-xs">Date</label>
  <input type="date" value={toYMDLocal(date)} onChange={(e)=>setDate(buildLocalDateFromParts(e.target.value))} className="border px-2 py-1" />
      </div>
      <div>
        <label className="block text-xs">Time</label>
        <input type="time" value={time} onChange={(e)=>setTime(e.target.value)} className="border px-2 py-1" />
      </div>
      <div>
        <label className="block text-xs">Color</label>
        <select value={color} onChange={(e)=>setColor(e.target.value)} className="border px-2 py-1">
          <option value="blue">Blue</option>
          <option value="green">Green</option>
          <option value="red">Red</option>
          <option value="orange">Orange</option>
        </select>
      </div>
      <div>
        <button className="bg-primary text-white px-3 py-1 rounded" type="submit">Add</button>
      </div>
    </form>
  );
}
