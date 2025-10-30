import React from 'react';
import { parseDatePreserveLocal, buildLocalDateFromParts } from '../lib/dateHelpers';

function formatLocalIso(dt) {
	const y = dt.getFullYear();
	const m = String(dt.getMonth() + 1).padStart(2, '0');
	const d = String(dt.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function getWeekDays(date = new Date()) {
	// If date is an ISO string like '2025-09-24', make a Date at local midnight
	const start = typeof date === 'string' ? (buildLocalDateFromParts(date) || new Date(date + 'T00:00:00')) : new Date(date);
	// If start is invalid, fallback to today
	if (isNaN(start.getTime())) {
		const now = new Date();
		return getWeekDays(now);
	}

	// If the provided date is not a Monday, try to generate a week that starts from the provided date
	// This allows a 'startDay' prop to render a 7-day span beginning at that date.
	const days = [];
	for (let i = 0; i < 7; i++) {
		const d = new Date(start);
		d.setDate(start.getDate() + i);
		days.push(d);
	}
	return days;
}

export default function WeekStrip({ events = [], selectedDay = '', onSelectDay = () => {}, startDay = '' }) {
	// startDay expected as ISO 'YYYY-MM-DD' or falsy
	const days = getWeekDays(startDay || new Date());
	const byDay = (events || []).reduce((acc, ev) => {
			try {
				const dt = parseDatePreserveLocal(ev.date) || (ev.date ? buildLocalDateFromParts(String(ev.date).slice(0,10)) : null);
				if (dt && !isNaN(dt.getTime())) {
					const d = formatLocalIso(dt);
					acc[d] = (acc[d] || 0) + 1;
				}
			} catch (e) {}
		return acc;
	}, {});

	return (
		<div className="week-strip" style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'row' }}>
			<div role="tablist" aria-label="Week days" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
			{days.map(d => {
				const key = formatLocalIso(d);
				const count = byDay[key] || 0;
				const isSelected = selectedDay === key;
				return (
					<button
						key={key}
						onClick={() => onSelectDay(key)}
						onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectDay(key); } }}
						role="tab"
						aria-pressed={isSelected}
						aria-selected={isSelected}
						className={`week-pill ${isSelected ? 'week-pill--active' : ''}`}
						data-day={key}
						title={d.toDateString()}
					>
						{count > 0 && <span className="week-pill-badge" aria-hidden>{count}</span>}
						<div className="week-pill-main">
							<span className="week-pill-accent" aria-hidden />
							<div className="week-pill-weekday" style={{ fontSize: 12, fontWeight: 700 }}>{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
							<div className="week-pill-date" style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{d.getDate()}</div>
							<div className="week-pill-meta" style={{ marginTop: 8, fontSize: 12 }}>{count} {count === 1 ? 'event' : 'events'}</div>
						</div>
					</button>
				);
			})}
			</div>
		</div>
	);
}
