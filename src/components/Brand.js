import React from 'react';

// Render a daisyUI-like avatar using utility classes (no external dependency required).
// Size prop maps to common Tailwind width classes so the avatar scales.
export default function Brand({ size = 'md', className = '' }) {
  const sizeClass = size === 'lg' ? 'w-14 h-14' : size === 'sm' ? 'w-7 h-7' : 'w-10 h-10';
  return (
    <div className={`brand-logo ${className}`} role="img" aria-label="University Planner logo">
      <div className={`avatar ${sizeClass}`} aria-hidden>
        {/* inner fill container: ensure it fills the avatar and centers text precisely */}
        <div
          className={`rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-extrabold`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            lineHeight: 1,
            fontSize: size === 'lg' ? 20 : size === 'sm' ? 12 : 16,
          }}
        >
          UP
        </div>
      </div>
    </div>
  );
}
