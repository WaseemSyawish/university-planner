import React from 'react';
import { Trash2 } from 'lucide-react';

export default function CourseCard({
  course,
  courseGrade,
  totalWeight,
  onDeleteCourse,
  onAddAssessment,
  onDeleteAssessment,
  onAddGradeItem,
  onUpdateGradeItem,
  onDeleteGradeItem,
  calculateAssessmentGrade,
  getGradeColor,
  editingItem,
  startEdit,
  cancelEdit,
  saveEdit,
  setModal,
  setTemplates
}) {
  return (
    <div className="card">
      <div className="course-card-inner">
        <div className="course-card-main">
          <h3 className="grades-title text-black dark:text-white">{course.name}</h3>
          <div className="grades-sub">{course.code} • {course.semester}</div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.min(Math.max(courseGrade,0),100)}%` }} />
                </div>
              </div>
              <div style={{ minWidth: 72, textAlign: 'right', fontWeight: 700 }}>
                <span className={`badge ${getGradeColor(courseGrade)}`}>{courseGrade}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="course-card-meta">
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setModal({ type: 'add-assessment', payload: { courseId: course.id } })} style={{ flex: 1 }}>
              Add Assessment
            </button>
            <button className="btn btn-ghost" onClick={onDeleteCourse} title="Delete course">
              <Trash2 size={14} />
            </button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted-600)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>Total weight</div>
              <div style={{ fontWeight: 700 }}>{totalWeight}%</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={async () => {
              const key = course.code || course.name;
              const name = prompt('Template name (short key):', key);
              if (!name) return;
              const tpl = course.assessments || [];
              try {
                const resp = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: name, template: tpl }) });
                const json = await resp.json();
                if (json.success) {
                  setTemplates(json.data || {});
                  alert('Template saved');
                } else {
                  alert('Failed to save template');
                }
              } catch (e) { console.error(e); alert('Failed to save template'); }
            }}>Save</button>
            <button className="btn btn-ghost" onClick={() => setModal({ type: 'add-grade', payload: { courseId: course.id, assessmentIndex: 0 } })}>Quick grade</button>
          </div>
        </div>
      </div>

      <div className="course-badges">
        {course.assessments && course.assessments.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {course.assessments.map((a, i) => (
              <div key={i} className="badge">
                {a.name} · {a.weight}% · { (calculateAssessmentGrade(a.items) || 0) }%
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--muted-600)' }}>No assessments — add one</div>
        )}
      </div>
    </div>
  );
}
