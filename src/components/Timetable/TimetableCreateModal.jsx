import React, { useState } from 'react';
import CreateStepModal from './CreateStepModal';
import ModalShell from '../UI/ModalShell';

export default function TimetableCreateModal({ visible = true, initial = {}, onClose = () => {}, onConfirm = () => {} }) {
  const [choice, setChoice] = useState('template-only');
  const [count, setCount] = useState(10);
  const [until, setUntil] = useState('');

  function handleConfirm() {
    // Build an action payload describing user's choice
    const payload = { choice, materializeCount: choice === 'materialize-count' ? Number(count) : undefined, materializeUntil: choice === 'materialize-until' ? until : undefined };
    onConfirm(payload);
    onClose();
  }

  return (
    <CreateStepModal visible={visible} onClose={onClose} ariaLabel="Create timetable options">
      <ModalShell title="Create timetable" subtitle="Save as template or materialize occurrences" onClose={onClose} actions={(
        <>
          <button onClick={onClose} className="px-4 py-2 border rounded-md text-gray-700">Cancel</button>
          <button onClick={handleConfirm} className="px-4 py-2 bg-indigo-600 text-white rounded-md">Create</button>
        </>
      )}>
        <p className="text-sm text-gray-500 mb-4">Choose whether to save this as a timetable template (no occurrences) or materialize upcoming classes now.</p>

        <div className="space-y-3">
          <label className={`block p-3 rounded-md ${choice === 'template-only' ? 'bg-indigo-50 border-indigo-100' : 'cozy'}`}>
            <input type="radio" name="tplChoice" value="template-only" checked={choice === 'template-only'} onChange={() => setChoice('template-only')} />
            <span className="ml-3 font-medium">Save as template only</span>
            <div className="text-xs text-gray-500 mt-1">Create an editable timetable template. No class occurrences will be created unless you choose to materialize.</div>
          </label>

          <label className={`block p-3 rounded-md ${choice === 'materialize-count' ? 'bg-indigo-50 border-indigo-100' : 'cozy'}`}>
            <div className="flex items-center">
              <input type="radio" name="tplChoice" value="materialize-count" checked={choice === 'materialize-count'} onChange={() => setChoice('materialize-count')} />
              <span className="ml-3 font-medium">Materialize next N occurrences</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} className="w-24 p-2 border rounded" />
              <div className="text-xs text-gray-500">occurrences will be created immediately</div>
            </div>
          </label>

          <label className={`block p-3 rounded-md ${choice === 'materialize-until' ? 'bg-indigo-50 border-indigo-100' : 'cozy'}`}>
            <div className="flex items-center">
              <input type="radio" name="tplChoice" value="materialize-until" checked={choice === 'materialize-until'} onChange={() => setChoice('materialize-until')} />
              <span className="ml-3 font-medium">Materialize until a date</span>
            </div>
            <div className="mt-2">
              <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="p-2 border rounded" />
              <div className="text-xs text-gray-500 mt-1">All occurrences until this date (inclusive) will be created.</div>
            </div>
          </label>
        </div>
      </ModalShell>
    </CreateStepModal>
  );
}
