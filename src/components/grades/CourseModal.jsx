import React, { useEffect, useState } from 'react';
import Modal from '../Modal';

function calculateAssessmentGrade(items = []) {
  if (!items || items.length === 0) return 0;
  const hasWeights = items.some(it => it.weight !== undefined && it.weight !== null);
  if (hasWeights) {
    let weighted = 0;
    let totalW = 0;
    for (const it of items) {
      const w = Number(it.weight) || 1;
      const pct = (!it.maxGrade || it.maxGrade === 0 || it.grade === '') ? 0 : (Number(it.grade) / Number(it.maxGrade)) * 100;
      weighted += pct * w;
      totalW += w;
    }
    return totalW === 0 ? 0 : Math.round((weighted / totalW) * 10) / 10;
  }
  const total = items.reduce((s, it) => {
    const pct = (!it.maxGrade || it.maxGrade === 0 || it.grade === '') ? 0 : (Number(it.grade) / Number(it.maxGrade)) * 100;
    return s + pct;
  }, 0);
  return Math.round((total / items.length) * 10) / 10;
}

function calculateCourseGrade(assessments = []) {
  if (!assessments || assessments.length === 0) return 0;
  const sum = assessments.reduce((s, a) => {
    const ag = calculateAssessmentGrade(a.items || []);
    return s + (ag * (Number(a.weight) || 0) / 100);
  }, 0);
  return Math.round(sum * 10) / 10;
}

export default function CourseModal({ open, course, onClose, onSaved }) {
  const [local, setLocal] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!course) return setLocal(null);
    // deep-ish clone and normalize to ensure assessments have items arrays
    const copy = JSON.parse(JSON.stringify(course));
    copy.assessments = Array.isArray(copy.assessments) ? copy.assessments.map(a => ({
      name: a.name || '',
      weight: a.weight || 0,
      items: Array.isArray(a.items) && a.items.length > 0 ? a.items.map(it => ({ name: it.name || '', grade: it.grade ?? '', maxGrade: it.maxGrade ?? '' })) : [{ name: 'Item', grade: (a._computed ?? ''), maxGrade: 100 }]
    })) : [];
    // compute helper fields
    copy._computedGrade = calculateCourseGrade(copy.assessments);
    setLocal(copy);
  }, [course]);

  if (!local) return null;

  const updateAssessment = (idx, patch) => {
    setLocal(prev => {
      const next = { ...prev };
      next.assessments = (next.assessments || []).slice();
      next.assessments[idx] = { ...next.assessments[idx], ...patch };
      // ensure items array exists
      next.assessments[idx].items = next.assessments[idx].items || [{ name: 'Item', grade: '', maxGrade: 100 }];
      // recalc
      next._computedGrade = calculateCourseGrade(next.assessments);
      return next;
    });
  };

  const updateAssessmentItem = (aIdx, iIdx, field, value) => {
    setLocal(prev => {
      const next = { ...prev };
      next.assessments = (next.assessments || []).slice();
      const a = { ...next.assessments[aIdx] };
      a.items = (a.items || []).slice();
      a.items[iIdx] = { ...a.items[iIdx], [field]: value };
      next.assessments[aIdx] = a;
      next._computedGrade = calculateCourseGrade(next.assessments);
      return next;
    });
  };

  const addItemToAssessment = (aIdx) => {
    setLocal(prev => {
      const next = { ...prev };
      next.assessments = (next.assessments || []).slice();
      const a = { ...next.assessments[aIdx] };
      a.items = (a.items || []).concat([{ name: 'New item', grade: '', maxGrade: 100 }]);
      next.assessments[aIdx] = a;
      next._computedGrade = calculateCourseGrade(next.assessments);
      return next;
    });
  };

  const removeItemFromAssessment = (aIdx, iIdx) => {
    if (!window.confirm('Remove this item?')) return;
    setLocal(prev => {
      const next = { ...prev };
      next.assessments = (next.assessments || []).slice();
      const a = { ...next.assessments[aIdx] };
      a.items = (a.items || []).slice();
      a.items.splice(iIdx, 1);
      next.assessments[aIdx] = a;
      next._computedGrade = calculateCourseGrade(next.assessments);
      return next;
    });
  };

  const addAssessment = () => {
    setLocal(prev => {
      const next = { ...prev };
      next.assessments = (next.assessments || []).concat([{ name: 'New assessment', weight: 0, items: [{ name: 'Item', grade: '', maxGrade: 100 }] }]);
      next._computedGrade = calculateCourseGrade(next.assessments);
      return next;
    });
  };

  const deleteAssessment = (idx) => {
    if (!window.confirm('Delete this assessment?')) return;
    setLocal(prev => {
      const next = { ...prev };
      next.assessments = (next.assessments || []).slice();
      next.assessments.splice(idx, 1);
      next._computedGrade = calculateCourseGrade(next.assessments);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      // prepare payload - send the updated course object
      const payload = JSON.parse(JSON.stringify(local));
      // ensure numeric fields
      payload.assessments = (payload.assessments || []).map(a => ({ ...a, weight: Number(a.weight) || 0, items: (a.items || []).map(it => ({ ...it, grade: it.grade === '' ? '' : Number(it.grade), maxGrade: it.maxGrade === '' ? '' : Number(it.maxGrade) })) }));
      const res = await fetch('/api/grades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId: payload.id, course: payload }) });
      if (!res.ok) throw new Error('Save failed');
      const js = await res.json();
      // locally compute the course grade and return updated object
      const updated = { ...payload, _computedGrade: calculateCourseGrade(payload.assessments) };
      onSaved && onSaved(updated);
      onClose && onClose();
    } catch (e) {
      console.error('Failed to save course', e);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const validateLocal = () => {
    if (!local) return false;
    if (!local.name || !local.name.trim()) return false;
    for (const a of (local.assessments || [])) {
      if (!a.name || !a.name.trim()) return false;
      for (const it of (a.items || [])) {
        if (it.grade !== '' && (isNaN(Number(it.grade)) || Number(it.grade) < 0)) return false;
        if (it.maxGrade !== '' && (isNaN(Number(it.maxGrade)) || Number(it.maxGrade) <= 0)) return false;
      }
    }
    return true;
  };
  const isValid = validateLocal();

  const footer = (
    <>
      {!isValid && <div className="form-error" style={{ marginRight: 'auto' }}>Fix validation errors before saving</div>}
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" onClick={save} disabled={saving || !isValid}>{saving ? 'Saving…' : 'Save changes'}</button>
    </>
  );

  return (
    <Modal title={`${local.name} — Details`} open={open} onClose={onClose} footer={footer} size="lg">
      <div className="modal-two-col" style={{ display: 'flex', gap: 18 }}>
        <aside style={{ width: 320 }}>
          <div style={{ fontSize: 14, color: 'var(--muted-600)' }}>{local.code} • {local.semester}</div>
          <h3 style={{ marginTop: 8 }}>{local.name}</h3>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--muted-600)' }}>Course grade</div>
            <div style={{ fontWeight: 800, fontSize: 28 }}>{local._computedGrade}%</div>
          </div>
          <div style={{ marginTop: 18 }}>
            <button className="btn" onClick={addAssessment}>+ Add assessment</button>
          </div>
        </aside>

        <div style={{ flex: 1 }}>
          <h5 style={{ margin: '0 0 8px 0' }}>Assessments</h5>
          <div style={{ display: 'grid', gap: 8 }}>
            {(local.assessments || []).map((a, ai) => (
              <div key={ai} className="card cozy" style={{ padding: 12 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <input className="form-control" value={a.name} placeholder="Assessment name" onChange={e => updateAssessment(ai, { name: e.target.value })} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input type="number" min="0" step="1" className="form-control" style={{ width: 120 }} value={a.weight} onChange={e => updateAssessment(ai, { weight: e.target.value })} />
                      <div style={{ flex: 1 }}>
                        {(a.items || []).map((it, ii) => (
                          <div key={ii} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                            <input className="form-control" style={{ flex: 1 }} value={it.name} placeholder="Item name" onChange={e => updateAssessmentItem(ai, ii, 'name', e.target.value)} />
                            <input type="number" min="0" step="0.1" className="form-control" style={{ width: 100 }} placeholder="Grade" value={it.grade} onChange={e => updateAssessmentItem(ai, ii, 'grade', e.target.value)} />
                            <input type="number" min="1" step="1" className="form-control" style={{ width: 100 }} placeholder="Max" value={it.maxGrade} onChange={e => updateAssessmentItem(ai, ii, 'maxGrade', e.target.value)} />
                            <button className="btn" onClick={() => removeItemFromAssessment(ai, ii)} aria-label="Remove item">Remove</button>
                          </div>
                        ))}
                        <div style={{ marginTop: 6 }}>
                          <button className="btn" onClick={() => addItemToAssessment(ai)}>Add item</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ width: 140, textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{calculateAssessmentGrade(a.items || [])}%</div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button className="btn" onClick={() => deleteAssessment(ai)}>Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
