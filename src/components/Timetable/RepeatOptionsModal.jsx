import React, { useState } from 'react';
import CreateStepModal from './CreateStepModal';
import ModalShell from '../UI/ModalShell';

export default function RepeatOptionsModal({ visible = true, value = 'every-week', onClose = () => {}, onSave = () => {} }) {
  const [sel, setSel] = useState(value || 'every-week');

  function handleSave() {
    onSave(sel);
    onClose();
  }

  return (
    <CreateStepModal visible={visible} onClose={onClose} ariaLabel="Repeat options">
      <ModalShell title="Repeat" subtitle="Choose how this class repeats" onClose={onClose} actions={(
        <>
          <button onClick={onClose} className="px-4 py-2 border rounded-md text-gray-700">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-md">Save</button>
        </>
      )}>
        <div className="space-y-3">
          <label className={`block p-3 rounded-md ${sel === 'every-week' ? 'bg-indigo-50 border-indigo-100' : 'bg-white'}`}>
            <input type="radio" name="repeatOpt" value="every-week" checked={sel === 'every-week'} onChange={() => setSel('every-week')} />
            <span className="ml-3">Every week</span>
            <div className="text-xs text-gray-500 mt-1">Repeat this class weekly</div>
          </label>

          <label className={`block p-3 rounded-md ${sel === 'every-2-weeks' ? 'bg-indigo-50 border-indigo-100' : 'bg-white'}`}>
            <input type="radio" name="repeatOpt" value="every-2-weeks" checked={sel === 'every-2-weeks'} onChange={() => setSel('every-2-weeks')} />
            <span className="ml-3">Every 2 weeks</span>
            <div className="text-xs text-gray-500 mt-1">Repeat every other week</div>
          </label>

          <label className={`block p-3 rounded-md ${sel === 'every-month' ? 'bg-indigo-50 border-indigo-100' : 'bg-white'}`}>
            <input type="radio" name="repeatOpt" value="every-month" checked={sel === 'every-month'} onChange={() => setSel('every-month')} />
            <span className="ml-3">Every month</span>
            <div className="text-xs text-gray-500 mt-1">Repeat on the same day each month</div>
          </label>

          <label className={`block p-3 rounded-md ${sel === 'every-year' ? 'bg-indigo-50 border-indigo-100' : 'bg-white'}`}>
            <input type="radio" name="repeatOpt" value="every-year" checked={sel === 'every-year'} onChange={() => setSel('every-year')} />
            <span className="ml-3">Every year</span>
            <div className="text-xs text-gray-500 mt-1">Repeat yearly</div>
          </label>

          <label className={`block p-3 rounded-md ${sel === 'never' ? 'bg-indigo-50 border-indigo-100' : 'bg-white'}`}>
            <input type="radio" name="repeatOpt" value="never" checked={sel === 'never'} onChange={() => setSel('never')} />
            <span className="ml-3">Never</span>
            <div className="text-xs text-gray-500 mt-1">No repetition</div>
          </label>
        </div>
      </ModalShell>
    </CreateStepModal>
  );
}
