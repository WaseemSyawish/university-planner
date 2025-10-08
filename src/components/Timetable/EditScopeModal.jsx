import React from 'react';
import CreateStepModal from './CreateStepModal';
import ModalShell from '../UI/ModalShell';

export default function EditScopeModal({ visible = true, mode = 'edit', onClose = () => {}, onConfirm = () => {} }) {
  const isDelete = mode === 'delete';

  function handleConfirm(scope) {
    onConfirm(scope);
    onClose();
  }

  return (
    <CreateStepModal visible={visible} onClose={onClose} ariaLabel={isDelete ? 'Delete scope' : 'Edit scope'}>
      <ModalShell title={`${isDelete ? 'Delete' : 'Edit'} scope`} subtitle={`Choose which classes to ${isDelete ? 'delete' : 'edit'}`} onClose={onClose} actions={(
        <button onClick={onClose} className="px-4 py-2 border rounded-md text-gray-700">Cancel</button>
      )}>
        <div className="space-y-3">
          <button onClick={() => handleConfirm('single')} className="w-full text-left p-3 rounded-md bg-white hover:bg-gray-50">{isDelete ? 'Delete this class only' : 'Edit only this class'}</button>
          <button onClick={() => handleConfirm('future')} className="w-full text-left p-3 rounded-md bg-white hover:bg-gray-50">{isDelete ? 'Delete this and future classes' : 'Edit this and future classes'}</button>
          <button onClick={() => handleConfirm('all')} className="w-full text-left p-3 rounded-md bg-white hover:bg-gray-50">{isDelete ? 'Delete the entire timetable' : 'Edit the whole timetable'}</button>
        </div>
      </ModalShell>
    </CreateStepModal>
  );
}
