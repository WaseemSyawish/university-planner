import React from 'react';
import { buildLocalDateFromParts, formatDateLong, formatTimeFromParts } from '../lib/dateHelpers';

export default function EventCard({ ev, onEdit = () => {}, compact = false }) {
  if (!ev) return null;
  // Prefer combining separate date + time fields where available so we get the
  // correct local time without accidental timezone conversions.
  const dtToFormat = ev.time ? buildLocalDateFromParts(ev.date, ev.time) : (ev.date || null);
  const ariaLabel = `${ev.title || 'Event'} — ${formatDateLong(dtToFormat)}`;
	return (
			<div
				onClick={() => onEdit(ev)}
				role="button"
				tabIndex={0}
				aria-label={ariaLabel}
				className={`event-card-list-item event-card ${compact ? 'compact-dense' : ''} focus-ring`}
				onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(ev); } }}
			>
			<div className="event-chip" aria-hidden style={{ background: ev.color || 'linear-gradient(90deg,#60a5fa,#4f46e5)' }}>
				<div className="event-chip-initials">{(ev.course_name || ev.title || '').slice(0,2).toUpperCase()}</div>
			</div>

			<div className="event-body">
				<div className="event-main">
					<div className="event-title">{ev.title}</div>
					<div className="event-meta">
						<span className="event-time">{ev.time ? formatTimeFromParts(ev.date, ev.time) : formatDateLong(ev.date)}</span>
						{ev.location && <span className="event-location">{ev.location}</span>}
					</div>
					{ev.description && <div className="event-desc">{ev.description}</div>}
				</div>

				<div className="event-actions" aria-hidden>
					<button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); onEdit(ev); }}>Open</button>
				</div>
			</div>
		</div>
	);
}
