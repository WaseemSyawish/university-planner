import React from 'react';

export default function StatCard({ title, value, hint }) {
	const formatted = typeof value === 'number' ? value.toLocaleString() : (value ?? '0');
	const initials = (title || '').split(' ').map(s => s[0]).join('').slice(0,2).toUpperCase();
	return (
		<div className="stat-card corporate-card" role="group" aria-label={title}>
			<div className="stat-chip" aria-hidden style={{ background: 'linear-gradient(135deg,var(--accent-indigo-600),#6366f1)' }}>
				<div style={{ fontSize: 14 }}>{initials}</div>
			</div>
			<div style={{ flex: 1, minWidth: 0 }}>
				<div className="text-xs" style={{ color: 'var(--muted-600)', fontWeight: 600 }}>{title}</div>
				<div className="stat-value">{formatted}</div>
				{hint && <div className="stat-hint" aria-hidden>{hint}</div>}
			</div>
		</div>
	);
}
