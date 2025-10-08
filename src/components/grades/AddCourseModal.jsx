import React, { useState, useRef, useEffect } from 'react';
import Modal from '../Modal';

export default function AddCourseModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', code: '', semester: '' });
  const firstRef = useRef(null);
  useEffect(() => { if (open) setTimeout(() => firstRef.current && firstRef.current.focus(), 10); }, [open]);

  const submit = async () => {
    if (!form.name.trim()) { alert('Please enter a course name'); return; }
    try {
      const resp = await fetch('/api/grades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const js = await resp.json();
      if (js && js.success) {
        onCreate && onCreate(js.data);
        onClose();
      } else {
        alert('Failed to create course');
      }
    } catch (e) { console.error(e); alert('Failed to create course'); }
  };

  const valid = form.name && form.name.trim().length > 0;

  const footer = (
    <>
      {!valid && <div className="form-error" style={{ marginRight: 'auto' }}>Please enter a course name</div>}
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" onClick={submit} disabled={!valid}>Create</button>
    </>
  );

  return (
    <Modal title="Add course" open={open} onClose={onClose} footer={footer} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input ref={firstRef} className="form-control" placeholder="Course name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-control" placeholder="Code (optional)" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
          <input className="form-control" placeholder="Semester (optional)" value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}
