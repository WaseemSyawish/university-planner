import React from 'react';

export default function CleanCourseCard({ course, courseGrade, onDelete, onOpen }) {
  const percent = Math.round(Math.min(Math.max(Number(courseGrade) || 0, 0), 100));
  return (
    <article className="clean-card" aria-labelledby={`course-${course.id}`} tabIndex={0}>
      <div className="clean-card-body">
        <div className="clean-card-main">
          <h3 id={`course-${course.id}`} className="clean-course-title">{course.name}</h3>
          <div className="clean-course-meta">{course.code} · {course.semester}</div>
          <div className="clean-progress" aria-hidden>
            <div className="clean-progress-track">
              <div className="clean-progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="clean-badge" aria-label={`${percent} percent`}>{percent}%</div>
          </div>
        </div>
        <div className="clean-card-actions">
          <button className="btn" onClick={() => onOpen && onOpen(course)} aria-label={`Open ${course.name}`}>Open</button>
          <button className="btn btn-ghost" onClick={() => onDelete && onDelete(course.id)} aria-label={`Delete ${course.name}`}>Delete</button>
        </div>
      </div>
    </article>
  );
}
