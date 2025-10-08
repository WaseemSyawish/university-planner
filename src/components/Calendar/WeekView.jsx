import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { buildLocalDateFromParts, formatTimeFromParts } from '../../lib/dateHelpers';

export default function WeekView({ weekDates = [], timeSlots = [], classes = [], onSlotClick, onEventClick, compact = false, courses = [] }) {
  // make the grid responsive: compute a dynamic gutter based on container width
  const cols = weekDates.length || 7;
  const containerRef = useRef(null);
  const [gutterPx, setGutterPx] = useState(120);
  // removed repeating vertical grid lines; keep only gutter sizing

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 1200;
      // base gutter scales between 80 and 160 depending on width
      const g = Math.max(80, Math.min(160, Math.round(w / 12)));
      setGutterPx(g);
    });
    ro.observe(el);
    // initial compute
  const initial = Math.max(80, Math.min(160, Math.round((el.clientWidth || 1200) / 12)));
  setGutterPx(initial);
  // no initial colPx needed
    return () => ro.disconnect();
  }, []);

  const gridTemplate = useMemo(() => `${gutterPx}px repeat(${cols}, minmax(0, 1fr))`, [gutterPx, cols]);
  const todayStr = new Date().toDateString();
  const [hoveredCol, setHoveredCol] = useState(-1);
  const [slotRowPx, setSlotRowPx] = useState(72);
  const firstRowRef = useRef(null);

  function parseTimeToMinutes(t) {
    if (!t) return null;
    // Accept 'HH:MM' or 'H:MM' or 'HH:MMAM'/'HH:MMPM' or with space before AM/PM
    const s = String(t).trim();
    // Try HH:MM with optional AM/PM
    const m = s.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/);
    if (m) {
      let hh = Number(m[1]);
      const mm = Number(m[2]);
      const ampm = m[3];
      if (ampm) {
        const isPM = ampm.toLowerCase().startsWith('p');
        if (isPM && hh < 12) hh += 12;
        if (!isPM && hh === 12) hh = 0;
      }
      return hh * 60 + mm;
    }
    // Try plain HHMM
    const m2 = s.match(/^(\d{3,4})$/);
    if (m2) {
      const v = m2[1];
      const hh = Number(v.slice(0, v.length - 2));
      const mm = Number(v.slice(-2));
      return hh * 60 + mm;
    }
    // fallback: parse Date
    const d = new Date('1970-01-01T' + s);
    if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
    return null;
  }

  function minutesToHHMM(mins) {
    if (mins == null) return '';
    mins = Math.max(0, Math.floor(mins));
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function minutesFromDateTimeParts(datePart, timePart) {
    try {
      if (!timePart) return null;
      if (datePart) {
        const dt = buildLocalDateFromParts(datePart, timePart);
        if (!dt) return null;
        return dt.getHours() * 60 + dt.getMinutes();
      }
      // fallback to parsing time only
      return parseTimeToMinutes(timePart);
    } catch (e) { return null; }
  }

  function sameLocalDate(dObj, evDate) {
    try {
      if (!evDate) return false;
      const evDt = buildLocalDateFromParts(evDate, '00:00');
      if (!evDt) return false;
      return dObj.getFullYear() === evDt.getFullYear() && dObj.getMonth() === evDt.getMonth() && dObj.getDate() === evDt.getDate();
    } catch (e) { return false; }
  }

  useEffect(() => {
    // measure the first time slot row to compute px-per-hour for positioning
    try {
      const el = firstRowRef.current;
      if (!el) return;
      const cell = el.querySelector('[role="gridcell"]');
      if (!cell) return;
      const rect = cell.getBoundingClientRect();
      if (rect && rect.height) setSlotRowPx(rect.height);
    } catch (e) { /* ignore measurement errors */ }
  }, [firstRowRef]);

  return (
  // Let the timetable grow naturally so the page scrollbar handles vertical scrolling.
  <section
    ref={containerRef}
    aria-label="Week timetable"
    className="rounded-none overflow-visible"
    style={{ background: 'var(--card-bg)', transition: 'background 220ms ease, box-shadow 220ms ease', boxShadow: 'inset 0 0 0 1px rgba(2,6,23,0.02)' }}
  >
      {/* header */}
      <div className="sticky top-0 z-30 bg-white/5 backdrop-blur-sm">
        <div
          className="grid items-center week-grid-smooth"
          style={{
            gridTemplateColumns: gridTemplate,
            backgroundColor: 'transparent',
            transition: 'background 240ms ease',
          }}
        >
          <div className="px-6 py-3 text-sm font-medium text-gray-400 sticky left-0 bg-transparent">Time</div>
          {weekDates.map((d, i) => {
            const isToday = d.toDateString() === todayStr;
            return (
              <div key={i} role="columnheader" className="px-4 py-3 text-center" onMouseEnter={() => setHoveredCol(i)} onMouseLeave={() => setHoveredCol(-1)}>
                <div className="text-xs text-gray-400">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-full week-pill ${isToday ? 'active' : ''}`}>
                    <span className="text-sm font-semibold">{d.getDate()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* body: removed internal scrolling so the page scrollbar is used; add horizontal separators */}
      <div className={`${compact ? 'text-sm' : 'text-base'}`}>
        {timeSlots.map((time, slotIndex) => (
          <div
            key={time}
            className="grid border-b-2"
            ref={slotIndex === 0 ? firstRowRef : null}
            style={{
              gridTemplateColumns: gridTemplate,
              borderColor: 'rgba(15,23,42,0.06)',
              transition: 'border-color 200ms ease, background 200ms ease',
            }}
          >
            <div className={`px-6 ${compact ? 'py-3 text-sm' : 'py-4 text-base'} text-gray-400 bg-transparent`} style={{ fontWeight: 600 }}>{time}</div>

              {weekDates.map((d, idx) => {
              const isTodayCol = d.toDateString() === todayStr;
              // compute events for this date that start within this hour slot
              const slotStartMinutes = parseTimeToMinutes(time); // e.g. 540 for '09:00'
              const eventsForCell = (classes || []).filter((c) => {
                if (!c || !c.time) return false;
                if (!sameLocalDate(d, c.date)) return false;
                const m = minutesFromDateTimeParts(c.date, c.time);
                if (m == null || slotStartMinutes == null) return false;
                return m >= slotStartMinutes && m < slotStartMinutes + 60;
              });

              return (
                <div
                  key={idx}
                  role="gridcell"
                  onClick={(ev) => {
                    try {
                      const rect = ev.currentTarget.getBoundingClientRect();
                      const y = ev.clientY - rect.top; // px from top of cell
                      const h = rect.height || slotRowPx;
                      const frac = Math.max(0, Math.min(1, y / h));
                      const minutesIntoSlot = Math.round(frac * 60);
                      const clickedMinutes = (slotStartMinutes || 0) + minutesIntoSlot;
                      // snap to 0 or 30
                      const mins = clickedMinutes % 60;
                      const snappedMins = mins >= 30 ? 30 : 0;
                      const hh = Math.floor(clickedMinutes / 60);
                      const snapped = `${String(hh).padStart(2,'0')}:${String(snappedMins).padStart(2,'0')}`;
                      // Prevent creating an event if an existing event overlaps the clicked time
                      const clickedTotal = hh * 60 + snappedMins;
                      const overlap = (classes || []).some(item => {
                        try {
                          // ignore optimistic temporary previews (tmp-*) during overlap checks
                          if (!item || !item.date || !sameLocalDate(d, item.date)) return false;
                          if (String(item.id || '').startsWith('tmp-')) return false;
                          const start = parseTimeToMinutes(item.time);
                          if (start == null) return false;
                          const dur = Number(item.durationMinutes || (item.raw && item.raw.durationMinutes) || item.duration || 60) || 60;
                          const end = start + dur;
                          return clickedTotal >= start && clickedTotal < end;
                        } catch (e) { return false; }
                      });
                      // debug log to help trace click behavior
                      try { console.debug('[WeekView] cell click', { date: d.toDateString(), slotTime: time, clickedMinutes, snapped, clickedTotal, overlap }); } catch (e) { /* ignore */ }
                      if (overlap) {
                        try { console.debug('[WeekView] click ignored due to overlap', { date: d.toDateString(), snapped }); } catch (e) {}
                        return; // ignore clicks that land on occupied time
                      }

                      onSlotClick?.(d, snapped);
                    } catch (e) {
                      onSlotClick?.(d, time);
                    }
                  }}
                  onMouseEnter={() => setHoveredCol(idx)}
                  onMouseLeave={() => setHoveredCol(-1)}
                  className={`relative px-5 ${compact ? 'py-3 min-h-[48px]' : 'py-5 min-h-[88px]'} border-l-2 ${hoveredCol === idx ? 'border-sky-300/60' : 'border-slate-300/40'} ${!isTodayCol ? 'hover:bg-gray-800/5' : ''} cursor-pointer`}
                >
                  {/* faint horizontal lines */}
                  <div className="absolute left-6 top-4 bottom-4 w-1 bg-gradient-to-b from-transparent to-transparent opacity-0 pointer-events-none" aria-hidden="true"></div>

                  {/* render events that fall within this hour slot with minute-accurate positioning */}
                  {eventsForCell.length > 0 ? (
                    eventsForCell.map((evItem) => {
                      const startM = minutesFromDateTimeParts(evItem.date, evItem.time) ?? parseTimeToMinutes(evItem.time);
                      const topFrac = slotRowPx > 0 ? ((startM - slotStartMinutes) / 60) : 0;
                      const dur = Number(evItem.durationMinutes || (evItem.raw && evItem.raw.durationMinutes) || evItem.duration || 60) || 60;
                      const heightPx = slotRowPx * (dur / 60);
                      const topPx = Math.max(0, (slotRowPx * topFrac));
                        // find course/module color if available. Supports Tailwind 'bg-...' utility classes or raw hex/colors.
                        const courseId = evItem.courseId || (evItem.raw && evItem.raw.course_id) || (evItem.raw && evItem.raw.course && evItem.raw.course.id);
                        let bgClass = null;
                        let bgColor = null;
                        // Top priority: a direct courseColor attached to the item (from timetable payload or server response)
                        const itemCourseColor = evItem.courseColor || evItem.raw && evItem.raw.courseColor;
                        const rawColor = evItem && evItem.raw && (evItem.raw.color || evItem.raw.color_code || evItem.raw.course && evItem.raw.course.color);
                        const itemColor = evItem.color;
                        const course = courseId ? (courses || []).find(x => String(x.id) === String(courseId)) : null;
                        // prefer server-normalized inline color if provided
                        const courseColorHex = course && (course.colorHex || course.colorHex === null) ? course.colorHex : null;

                        // small mapping for common Tailwind color tokens -> hex fallback
                        // this ensures pills remain visible even if utility classes are purged
                        const tailwindToHex = {
                          'indigo-500': '#6366F1',
                          'blue-500': '#3B82F6',
                          'green-500': '#10B981',
                          'red-500': '#EF4444',
                          'yellow-500': '#F59E0B',
                          'gray-500': '#6B7280',
                          'purple-500': '#8B5CF6',
                          'pink-500': '#EC4899',
                          'teal-500': '#14B8A6'
                        };

                        // helper: pick color value, accepting Tailwind shorthand like 'indigo-500'
                        const pickColor = (val) => {
                          if (!val) return;
                          const s = String(val).trim();
                          if (!s) return;
                          if (s.startsWith('bg-')) { bgClass = s; return; }
                          if (/^[a-z]+-\d{3,4}$/i.test(s)) { bgClass = 'bg-' + s; return; }
                          if (s.startsWith('#') || s.startsWith('rgb')) { bgColor = s; return; }
                          // If it's a CSS color name, treat as inline color
                          if (/^[a-z]+$/i.test(s)) { bgColor = s; return; }
                          // fallback: assume inline color
                          bgColor = s;
                        };

                        // prioritize: attached itemCourseColor -> explicit raw color -> event.item color -> server-normalized course.colorHex -> course.color
                        if (itemCourseColor) pickColor(itemCourseColor);
                        if (!bgClass && !bgColor) pickColor(rawColor);
                        if (!bgClass && !bgColor) pickColor(itemColor);
                        if (!bgClass && !bgColor && courseColorHex) bgColor = courseColorHex;
                        if (!bgClass && !bgColor && course && course.color) pickColor(course.color);

                        // compute readable text color for inline hex colors
                        const getTextForBg = (c) => {
                          try {
                            if (!c || !c.startsWith('#')) return '#fff';
                            const hex = c.replace('#','');
                            const r = parseInt(hex.length === 3 ? hex[0]+hex[0] : hex.slice(0,2), 16);
                            const g = parseInt(hex.length === 3 ? hex[1]+hex[1] : hex.slice(hex.length===3?1:2, hex.length===3?2:4), 16);
                            const b = parseInt(hex.length === 3 ? hex[2]+hex[2] : hex.slice(hex.length===3?2:4), 16);
                            // compute luminance
                            const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
                            return lum > 0.6 ? '#000' : '#fff';
                          } catch (e) { return '#fff'; }
                        };
                        // If we only have a Tailwind/bgClass like 'bg-indigo-500', try to derive a hex fallback
                        const inlineStyle = {};
                        if (!bgColor && bgClass) {
                          try {
                            const key = bgClass.replace(/^bg-/, '');
                            if (tailwindToHex[key]) {
                              bgColor = tailwindToHex[key];
                            }
                          } catch (e) { /* ignore mapping errors */ }
                        }

                        // If still no color found, pick a deterministic fallback from a small palette
                        if (!bgColor && !bgClass) {
                          const palette = Object.values(tailwindToHex);
                          try {
                            const seed = String(courseId || evItem.id || evItem.title || Math.random());
                            // simple hash
                            let h = 0; for (let i=0;i<seed.length;i++) h = (h << 5) - h + seed.charCodeAt(i);
                            const idx = Math.abs(h) % palette.length;
                            bgColor = palette[idx];
                          } catch (e) {
                            bgColor = '#6366F1';
                          }
                        }

                        if (bgColor) {
                          inlineStyle.background = bgColor;
                          inlineStyle.color = getTextForBg(bgColor);
                        }

                        // compute a slightly darker accent color for the left bar when inline hex bgColor is present
                        let leftAccentColor = null;
                        try {
                          if (inlineStyle && inlineStyle.background && String(inlineStyle.background).startsWith('#')) {
                            const hex = String(inlineStyle.background).replace('#','');
                            const r = parseInt(hex.slice(0,2),16);
                            const g = parseInt(hex.slice(2,4),16);
                            const b = parseInt(hex.slice(4,6),16);
                            const darken = (v) => Math.max(0, Math.min(255, Math.floor(v * 0.82)));
                            const rr = darken(r).toString(16).padStart(2,'0');
                            const gg = darken(g).toString(16).padStart(2,'0');
                            const bb = darken(b).toString(16).padStart(2,'0');
                            leftAccentColor = `#${rr}${gg}${bb}`;
                          }
                        } catch (e) { leftAccentColor = null; }

                        return (
                        <div
                          key={evItem.id}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); onEventClick?.(evItem); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEventClick?.(evItem); } }}
                          className={`absolute left-1.5 right-1.5 text-left rounded-md px-3 py-2 transform transition-all focus:outline-none ${bgClass ? bgClass : ''}`}
                          style={{ top: topPx + 'px', height: Math.max(56, heightPx) + 'px', border: '1px solid rgba(2,6,23,0.06)', ...(inlineStyle || {}) }}
                          aria-label={`Event ${evItem.title || evItem.course_code || evItem.subject}`}
                        >
                          {/* left accent bar */}
                          {leftAccentColor && (<div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 4, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, background: leftAccentColor }} aria-hidden="true"></div>)}
                          <div style={{ marginLeft: leftAccentColor ? 8 : 0 }} className="w-full">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm leading-tight truncate" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{evItem.course_code || evItem.title || evItem.subject}</div>
                                <div className="text-xs mt-1" style={{ opacity: 0.95, fontWeight: 500 }}>{(evItem.location || evItem.room) || (evItem.raw && (evItem.raw.location || evItem.raw.room)) || ''}</div>
                              </div>
                              <div className="text-xs opacity-90 ml-2" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{formatTimeFromParts(evItem.date || d, evItem.time) || evItem.time || minutesToHHMM(startM)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none">
                      <Plus className="w-4 h-4 text-gray-500/30" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
