import { useState, useRef, useEffect } from 'react';
import { buildLocalDateFromParts } from '../lib/dateHelpers';

export default function TaskForm({ onCreate, onCancel }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [subtasks, setSubtasks] = useState([]);
  const [subtaskText, setSubtaskText] = useState('');
  const [attachments, setAttachments] = useState([]);

  function addSubtask() {
    if (!subtaskText.trim()) return;
    setSubtasks(s => [...s, { id: 's-' + Date.now(), text: subtaskText, done: false }]);
    setSubtaskText('');
  }

  function removeSubtask(id) {
    setSubtasks(s => s.filter(x => x.id !== id));
  }

  function handleAttach(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const meta = files.map(f => ({ name: f.name, type: f.type, size: f.size }));
    setAttachments(a => [...a, ...meta]);
  }

  const titleRef = useRef(null);
  useEffect(() => { if (titleRef.current) titleRef.current.focus(); }, []);

  function submit(e) {
    e.preventDefault();
    const ev = {
      id: 'tmp-' + Date.now(),
      title: title || 'Untitled task',
      // build local Date when time provided, otherwise keep date ISO string
      date: date ? (time ? buildLocalDateFromParts(date, time) : new Date(date + 'T00:00:00')) : new Date().toISOString(),
      subtasks,
  attachments: attachments.map(f => ({ name: f.name, type: f.type, size: f.size })),
      createdAt: new Date().toISOString(),
      type: 'task'
    };
    onCreate && onCreate(ev);
  }

  return (
    <form className="task-form" onSubmit={submit}>
      <div className="task-header">
        <div className="task-title-input">
          <input ref={titleRef} placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} className="p-2" />
        </div>
        <div className="task-actions">
          <button type="button" className="btn btn-ghost">Mark as complete</button>
        </div>
      </div>

        <div className="task-meta" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="pill">
            <input type="checkbox" />
            <span>Remind me</span>
          </label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="p-2" />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className="p-2" />
        </div>

      <div className="task-section">
        <div className="section-label">Subtasks <span className="muted-sm">{subtasks.length}/0</span></div>
        <div className="subtasks">
          {subtasks.map(st => (
            <div className="subtask" key={st.id}>
              <input type="checkbox" />
              <div className="subtask-text">{st.text}</div>
              <button type="button" className="btn btn-ghost" onClick={() => removeSubtask(st.id)}>✕</button>
            </div>
          ))}
          <div className="subtask-add">
            <input placeholder="Add a new subtask" value={subtaskText} onChange={e => setSubtaskText(e.target.value)} className="p-2" />
            <button type="button" className="btn btn-primary" onClick={addSubtask}>Add</button>
          </div>
        </div>
      </div>

      <div className="task-section">
        <div className="section-label">Attachments</div>
        <label className="attach-drop">
          <input type="file" multiple onChange={handleAttach} style={{ display: 'none' }} />
          <div>Click to add / drop your files here</div>
        </label>
        {attachments.length > 0 && (
          <ul className="attach-list">
            {attachments.map((f, i) => <li key={i}>{f.name}</li>)}
          </ul>
        )}
      </div>

      <div className="task-form-actions" style={{ marginTop: 12 }}>
        <button type="submit" className="btn btn-primary">Create</button>
        <button type="button" className="btn btn-ghost" onClick={() => { if (typeof onCancel === 'function') onCancel(); }}>Cancel</button>
      </div>
    </form>
  );
}
