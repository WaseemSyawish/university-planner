import React from 'react';

export default function GradeItem({ item, percentage, getGradeColor }) {
  const percent = Number.isFinite(percentage) ? percentage : 0;
  return (
    <div className="grade-item-pill">
      <div style={{ fontWeight: 700 }}>{item.name}</div>
      <div style={{ opacity: 0.9 }}>{percent}%</div>
    </div>
  );
}
