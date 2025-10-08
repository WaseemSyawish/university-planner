import React from 'react';
import { Award } from 'lucide-react';

export default function GradeSummary({ gpa, totalGPA, semesterLabel, onExport, onAddCourse }) {
  const displayGPA = typeof totalGPA !== 'undefined' ? totalGPA : gpa;
  return (
    <div className="card cozy grade-summary">
      <div className="summary-left">
        <Award size={28} color="#6366f1" />
        <div>
          <div className="grades-sub">Grades Tracker</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{semesterLabel}</div>
        </div>
      </div>
      <div className="summary-right">
        <div style={{ textAlign: 'right' }}>
          <div className="grades-sub">Overall GPA</div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{displayGPA ?? '—'}%</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onExport}>Export</button>
          <button className="btn btn-primary" onClick={onAddCourse}>Add Course</button>
        </div>
      </div>
    </div>
  );
}
