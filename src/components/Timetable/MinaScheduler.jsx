import React from 'react';

// Mina-inspired scheduler with duration-aware rendering and simple overlap layout.
export default function MinaScheduler({ weekDates = [], timeSlots = [], classes = [], onSlotClick = () => {}, onEventClick = () => {}, compact = true }) {
  const rowHeight = compact ? 44 : 56; // px per hour-slot (each timeslot represents 60 minutes)
  const containerHeight = (timeSlots.length) * rowHeight;

  // parse HH:MM into minutes since midnight
  const parseMinutes = (t) => {
    if (!t) return 0;
    const parts = String(t).split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };

  const baseMinutes = React.useMemo(() => parseMinutes(timeSlots[0] || '00:00'), [timeSlots]);

  // group events by date and preprocess start/end minutes
  const days = React.useMemo(() => {
    const map = {};
    for (const d of weekDates) {
      const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0');
      map[`${y}-${m}-${day}`] = [];
    }
    for (const ev of classes || []) {
      if (!ev || !ev.date) continue;
      const list = map[ev.date] || (map[ev.date] = []);
      const start = parseMinutes(ev.time || '00:00');
      const duration = Number(ev.durationMinutes || (ev.raw && ev.raw.durationMinutes) || 60);
      const end = start + duration;
      list.push({ ...ev, _start: start, _end: end, _duration: duration });
    }
    // For each day compute simple column layout for overlapping events
    Object.keys(map).forEach(dateKey => {
      const items = map[dateKey];
      // sort by start asc
      items.sort((a,b) => a._start - b._start || b._end - a._end);
      const columns = [];
      for (const it of items) {
        let placed = false;
        for (let ci = 0; ci < columns.length; ci++) {
          const col = columns[ci];
          // check last event in column
          const last = col[col.length - 1];
          if (it._start >= last._end) {
            col.push(it); it._col = ci; placed = true; break;
          }
        }
        if (!placed) { it._col = columns.length; columns.push([it]); }
      }
      // number of columns affects width
      const totalCols = Math.max(1, columns.length);
      items.forEach(it => { it._totalCols = totalCols; });
    });

    return map;
  }, [weekDates, classes, timeSlots]);

  const fmtDay = (d) => {
    try { return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { return String(d); }
  };

  return (
    <div className={`mina-scheduler ${compact ? 'compact' : ''}`} style={{ fontFamily: 'Inter, ui-sans-serif, system-ui' }}>
      <div style={{ overflowX: 'auto' }}>
  <div className="grid" style={{ display: 'grid', gridTemplateColumns: `60px repeat(${weekDates.length}, 1fr)`, borderTop: '1px solid var(--muted-border, #e5e7eb)', minWidth: 700 }}>
  <div style={{ borderRight: '1px solid var(--muted-border, #e5e7eb)', background: 'var(--card-bg)' }} />
        {weekDates.map((d) => (
          <div key={d.toISOString()} className="day-header" style={{ padding: '8px 10px', borderLeft: '1px solid var(--muted-border, #f3f4f6)', borderBottom: '1px solid var(--muted-border, #e5e7eb)', background: 'var(--card-bg)' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtDay(d)}</div>
          </div>
        ))}

        {/* time labels and day columns */}
        {timeSlots.map((ts, idx) => (
          <React.Fragment key={ts}>
            <div style={{ padding: '8px 6px', fontSize: 12, color: '#6b7280', borderTop: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb' }}>{ts}</div>
            {weekDates.map((d) => {
              const dateStr = (() => { const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; })();
              const dayItems = days[dateStr] || [];
              // render a single column container per day only on the first timeslot to avoid duplicates
              if (idx !== 0) return (<div key={`${dateStr}-${ts}`} style={{ borderTop: '1px solid #f3f4f6' }} />);

              return (
                <div key={`${dateStr}-col`} style={{ minHeight: containerHeight, borderTop: '1px solid var(--muted-border, #f3f4f6)', padding: 6, position: 'relative', cursor: 'pointer' }} onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top - 6; // account for padding
                  const ratio = Math.max(0, Math.min(1, y / containerHeight));
                  const minutes = Math.round((baseMinutes + ratio * (timeSlots.length * 60)) / 30) * 30; // snap to 30m
                  const hh = String(Math.floor(minutes / 60)).padStart(2,'0');
                  const mm = String(minutes % 60).padStart(2,'0');
                  const clicked = `${hh}:${mm}`;
                  onSlotClick(dateStr, clicked);
                }}>
                  {/* background slot grid */}
                  <div style={{ position: 'absolute', inset: 0 }}>
                    {timeSlots.map((_, i) => (
                      <div key={i} style={{ height: rowHeight, borderBottom: '1px dashed #f3f4f6' }} />
                    ))}
                  </div>

                  {/* events positioned absolutely */}
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    {(dayItems || []).map(ev => {
                      // compute top/height relative to container
                      const topPx = ((ev._start - baseMinutes) / 60) * rowHeight;
                      const heightPx = Math.max(28, (ev._duration / 60) * rowHeight);
                      const widthPercent = 100 / (ev._totalCols || 1);
                      const leftPercent = (ev._col || 0) * widthPercent;
                      return (
                        <div key={ev.id} onClick={(e) => { e.stopPropagation(); onEventClick(ev); }} className="mina-ev" style={{ position: 'absolute', top: topPx, left: `calc(${leftPercent}% + 6px)`, width: `calc(${widthPercent}% - 10px)`, height: Math.max(28, heightPx), background: ev.courseColor || 'var(--accent-bg,#e9d5ff)', color: 'var(--text,#0f172a)', padding: '6px 8px', borderRadius: 8, boxShadow: '0 4px 12px rgba(2,6,23,0.08)', overflow: 'hidden', transition: 'transform 120ms ease, box-shadow 120ms ease' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, lineHeight: '1.1em', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{ev.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted-text,#374151)' }}>{ev.time}{ev._duration ? ` • ${ev._duration}m` : ''}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      </div>

      <style jsx>{`
        .mina-scheduler .day-header { border-left: 1px solid var(--muted-border, #f3f4f6); }
        .mina-scheduler.compact .day-header { padding: 6px 8px; }
        .mina-ev:hover { transform: translateY(-4px); box-shadow: 0 8px 20px rgba(2,6,23,0.12); }
        @media (max-width: 768px) {
          .mina-scheduler .grid { min-width: 900px; }
        }
      `}</style>
    </div>
  );
}
