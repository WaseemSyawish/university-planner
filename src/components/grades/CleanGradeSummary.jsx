import React from 'react';

export default function CleanGradeSummary({ gpa, onAddCourse, onExport }) {
  return (
    <aside className="clean-summary" aria-labelledby="grades-summary">
      <div>
        <div id="grades-summary" className="clean-summary-label">Overall GPA</div>
        <div className="clean-summary-gpa" aria-live="polite">{gpa ?? '—'}%</div>
      </div>
      <div className="clean-summary-actions">
        <button className="btn" onClick={onExport} aria-label="Export grades">Export</button>
        <button className="btn primary" onClick={onAddCourse} aria-label="Add course">Add</button>
      </div>
    </aside>
  );
}
