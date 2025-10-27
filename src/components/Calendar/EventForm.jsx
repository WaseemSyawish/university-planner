import React, { useEffect, useState } from 'react';

export default function EventForm({ values = {}, onChange = () => {}, courseOptions = [], repeatOption, onOpenRepeat, date }) {
  // showRepeatPanel removed; repeat options handled by external modal now
  const [showRepeatPanel] = useState(false);
  // values: { title, selectedCourse, startTime, endTime, durationMinutes, room, description, date }
  useEffect(() => {
    // ensure basic defaults
    if (!values.startTime && values.time) onChange({ ...values, startTime: values.time });
    // prefer nice default placeholders: 08:30 -> 10:00 span if nothing provided
    if (!values.startTime && !values.time) onChange({ ...values, startTime: '08:30', endTime: '10:00', durationMinutes: 90, date: values.date || date });
    if (!values.date && date) onChange({ ...values, date });
  }, []);

  function update(part) {
    const next = { ...(values || {}), ...part };
    // recompute duration if start/end changed
    if (part.startTime || part.endTime) {
      try {
        const [sh, sm] = String(next.startTime || '09:00').split(':').map(Number);
        const [eh, em] = String(next.endTime || '10:00').split(':').map(Number);
        const smins = sh * 60 + sm;
        const emins = eh * 60 + em;
        next.durationMinutes = Math.max(1, emins - smins);
      } catch (e) { /* ignore */ }
    }
    onChange(next);
  }

  // Date helper to format YYYY-MM-DD
  function toInputDate(ymd) {
    if (!ymd) return '';
    return ymd;
  }

  return (
    <div className="space-y-4">
      <div className="cal-card p-4">
        <label htmlFor="ev-subject" className="text-sm font-semibold text-gray-800">Subject</label>
        <input id="ev-subject" value={values.title || ''} onChange={e => update({ title: e.target.value })} placeholder="Subject or module name" className="w-full mt-2 px-3 py-2 border border-gray-100 rounded-md focus:ring-2 focus:ring-indigo-200 text-sm" aria-label="Subject" />
        <div className="pt-3">
          <label htmlFor="ev-course" className="text-xs text-gray-500">Course</label>
          <select id="ev-course" value={values.selectedCourse || ''} onChange={e => update({ selectedCourse: e.target.value })} className="mt-2 w-full px-3 py-2 border border-gray-100 rounded-md text-sm">
            <option value="">No course</option>
            {courseOptions.map(c => (<option key={c.id} value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>))}
          </select>
        </div>
        <div className="pt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ev-type" className="text-xs text-gray-500">Type</label>
            <select id="ev-type" value={values.type || 'class'} onChange={e => update({ type: e.target.value })} className="mt-2 w-full px-3 py-2 border border-gray-100 rounded-md text-sm">
              <option value="class">Class / Lecture</option>
              <option value="tutorial">Tutorial</option>
              <option value="lab">Lab</option>
              <option value="assignment">Assignment</option>
              <option value="exam">Exam</option>
            </select>
          </div>
          <div>
            <label htmlFor="ev-color" className="text-xs text-gray-500">Color</label>
            <input id="ev-color" type="color" value={values.color || '#60A5FA'} onChange={e => update({ color: e.target.value })} className="mt-2 w-full px-2 py-2 border border-gray-100 rounded-md text-sm" aria-label="Event color" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-1 cal-card p-3">
          <label htmlFor="ev-date" className="text-sm font-medium text-gray-700">Date</label>
          <input id="ev-date" type="date" value={toInputDate(values.date || date || '')} onChange={e => update({ date: e.target.value })} className="mt-2 px-3 py-2 border border-gray-100 rounded-lg text-sm w-full" aria-label="Event date" />
        </div>
        <div className="md:col-span-2 cal-card p-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ev-start" className="text-sm font-medium text-gray-700">Start</label>
            <input id="ev-start" type="time" value={values.startTime || values.time || '09:00'} onChange={e => update({ startTime: e.target.value })} className="mt-2 px-3 py-2 border border-gray-100 rounded-lg w-full" aria-label="Start time" />
          </div>
          <div>
            <label htmlFor="ev-end" className="text-sm font-medium text-gray-700">End</label>
            <input id="ev-end" type="time" value={values.endTime || '10:00'} onChange={e => update({ endTime: e.target.value })} className="mt-2 px-3 py-2 border border-gray-100 rounded-lg w-full" aria-label="End time" />
          </div>
          <div className="col-span-2 text-xs text-gray-500">Duration: <span className="font-medium text-gray-700">{values.durationMinutes || 60} min</span></div>
        </div>
      </div>

      <div className="cal-card p-3">
        <label htmlFor="ev-room" className="text-sm font-medium text-gray-700">Room</label>
        <input id="ev-room" value={values.room || values.location || ''} onChange={e => update({ room: e.target.value, location: e.target.value })} placeholder="Room or location" className="w-full mt-2 px-3 py-2 border border-gray-100 rounded-lg" aria-label="Room" />
      </div>

      <div className="cal-card p-3 flex items-center justify-between">
        <div className="text-sm text-gray-500">Repeat: <span className="font-medium text-gray-700">{String(repeatOption || '').replace(/-/g, ' ') || 'None'}</span></div>
        <div>
          <button onClick={() => onOpenRepeat && onOpenRepeat()} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-100 hover:bg-gray-50 text-sm" aria-label="Change repeat">
            Change
          </button>
        </div>
      </div>
    </div>
  );
}
