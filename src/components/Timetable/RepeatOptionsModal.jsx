import React, { useState } from 'react';
import CreateStepModal from './CreateStepModal';
import ModalShell from '../UI/ModalShell';

const REPEAT_OPTIONS = [
  { value: 'every-week', label: 'Every week', description: 'Repeat this class weekly' },
  { value: 'every-2-weeks', label: 'Every 2 weeks', description: 'Repeat every other week' },
  { value: 'every-month', label: 'Every month', description: 'Repeat on the same day each month' },
  { value: 'every-year', label: 'Every year', description: 'Repeat yearly' },
  { value: 'never', label: 'Never', description: 'No repetition' }
];

export default function RepeatOptionsModal({ 
  visible = true, 
  value = 'every-week', 
  onClose = () => {}, 
  onSave = () => {} 
}) {
  const [sel, setSel] = useState(value || 'every-week');

  const handleSave = () => {
    onSave(sel);
    onClose();
  };

  return (
    <CreateStepModal visible={visible} onClose={onClose} ariaLabel="Repeat options">
      <ModalShell 
        title="Repeat" 
        subtitle="Choose how this class repeats" 
        onClose={onClose} 
        actions={
          <>
            <button 
              onClick={onClose} 
              className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Save
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {REPEAT_OPTIONS.map(({ value, label, description }) => (
            <label 
              key={value}
              className={`block p-3 rounded-md border cursor-pointer transition-colors ${
                sel === value 
                  ? 'bg-indigo-50 border-indigo-200' 
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start">
                <input 
                  type="radio" 
                  name="repeatOpt" 
                  value={value} 
                  checked={sel === value} 
                  onChange={() => setSel(value)}
                  className="mt-1"
                />
                <div className="ml-3">
                  <span className="block font-medium text-gray-900">{label}</span>
                  <div className="text-xs text-gray-500 mt-1">{description}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </ModalShell>
    </CreateStepModal>
  );
}