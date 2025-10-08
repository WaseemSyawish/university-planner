import React from 'react';
import { getCalendarCells, calculateMonthEventPositions, getMonthCellEvents, formatTime, getColorClass } from '../../lib/calendarHelpers';
import { useCalendar } from './CalendarProvider';

const WEEK_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function MonthView() {
  const { selectedDate, events, setSelectedDate } = useCalendar();

  const cells = getCalendarCells(selectedDate);

  const multi = events.filter(e => e.startDate !== e.endDate);
  const single = events.filter(e => e.startDate === e.endDate);

  const positions = calculateMonthEventPositions(multi, single, selectedDate);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEK_DAYS.map(d => (
          <div key={d} className="text-xs font-medium text-gray-600">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => (
          <div key={idx} className={`min-h-[88px] border p-1 ${cell.currentMonth ? '' : 'bg-gray-50'}`}>
            <div className="text-sm text-gray-700">{cell.day}</div>
            <div className="mt-1 space-y-1">
              {getMonthCellEvents(cell.date, events, positions).slice(0,3).map(ev => (
                <div key={ev.id} className={`text-xs rounded px-1 py-0.5 border ${getColorClass(ev.color || 'blue')}`}>
                  <div className="font-semibold">{ev.title}</div>
                  <div className="text-[11px] opacity-80">{formatTime(ev.startDate)}{ev.startDate!==ev.endDate? ' • multi':''}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
