import React from 'react';

// Simple avatar component: renders initials on a colored rounded background.
// Props: name (string), color (string hex), size (number px)
export default function Avatar({ name, color = '#eef2ff', size = 40 }) {
  const initials = (name || '')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const style = {
    width: size,
    height: size,
    background: color,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Math.round(size * 0.22),
    color: '#fff',
    fontWeight: 700,
    fontSize: Math.round(size * 0.36),
    lineHeight: 1,
    flexShrink: 0,
  };

  return (
    <div className="sidebar-avatar" style={style} aria-hidden>
      {initials}
    </div>
  );
}
