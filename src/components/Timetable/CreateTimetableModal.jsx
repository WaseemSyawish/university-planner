import React, { useState } from 'react';
import CreateStepModal from './CreateStepModal';

export default function CreateTimetableModal({ visible = true, onClose = () => {}, onCreated = () => {} }) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch('/api/timetables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
      if (!res.ok) throw new Error('failed');
      const j = await res.json();
      onCreated && onCreated(j.template);
      onClose && onClose();
    } catch (e) { console.error('create timetable failed', e); }
    setSaving(false);
  }

  return (
    <CreateStepModal visible={visible} onClose={onClose} ariaLabel="Create timetable">
      <div className="w-full max-w-md mx-auto p-6">
        <h3 className="text-lg font-semibold mb-3">Create timetable</h3>
        <p className="text-sm text-gray-500 mb-4">Create a new, empty timetable. You can add modules to it from the timetable editor.</p>
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Spring 2026" className="w-full p-2 border rounded" />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-md text-gray-700">Cancel</button>
          <button onClick={handleCreate} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-md">{saving ? 'Creating...' : 'Create'}</button>
        </div>
      </div>
    </CreateStepModal>
  );
}
