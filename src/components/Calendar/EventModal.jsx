import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2 } from 'lucide-react';
import CreateStepModal from '../Timetable/CreateStepModal';
import EventForm from './EventForm';
import RepeatOptionsModal from '../Timetable/RepeatOptionsModal';
import EditScopeModal from '../Timetable/EditScopeModal';
import ModalShell from '../UI/ModalShell';

export default function EventModal({ visible = true, selectedEvent, modalMode = 'edit', onClose, onSave, onDelete, onOpenRepeat, courseOptions = [] }) {
  const [formData, setFormData] = useState({});
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [deleteScope, setDeleteScope] = useState('single'); // 'single' | 'all'
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showScopeModal, setShowScopeModal] = useState(false);
  const titleRef = useRef(null);

  // Only reinitialize the form when a different event is opened for edit.
  // This prevents external state updates from clobbering the user's in-progress edits.
  useEffect(() => {
    // Reinitialize whenever the selectedEvent object's content changes.
    // Using JSON.stringify as a pragmatic change detector — keeps UX deterministic
    // when clicking different events/modules that may share ids or mutated refs.
    const evKey = selectedEvent ? JSON.stringify(selectedEvent) : null;
    if (!evKey) {
      setFormData({});
      setConfirmingDelete(false);
      return;
    }
    // Derive sensible defaults for end time from duration if available
    const start = selectedEvent?.time || (selectedEvent && selectedEvent.raw && selectedEvent.raw.time) || '09:00';
    let end = '10:00';
    try {
      const dur = (selectedEvent?.durationMinutes ?? selectedEvent?.duration ?? (selectedEvent && selectedEvent.raw && selectedEvent.raw.durationMinutes)) || null;
      if (dur && typeof dur === 'number') {
        const [sh, sm] = String(start).split(':').map(Number);
        const startMinutes = (isNaN(sh) ? 9 : sh) * 60 + (isNaN(sm) ? 0 : sm);
        const endMinutes = startMinutes + Number(dur);
        const eh = Math.floor(endMinutes / 60);
        const em = endMinutes % 60;
        end = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
      } else if (selectedEvent?.endTime) {
        end = selectedEvent.endTime;
      }
    } catch (e) { /* ignore */ }

    setFormData({
      title: selectedEvent?.title || selectedEvent?.subject || '',
      selectedCourse: selectedEvent?.courseId ? String(selectedEvent.courseId) : (selectedEvent && selectedEvent.raw && selectedEvent.raw.course_id ? String(selectedEvent.raw.course_id) : ''),
      startTime: start,
      endTime: end,
      date: selectedEvent?.date || (selectedEvent && selectedEvent.raw && selectedEvent.raw.date) || '',
      room: selectedEvent?.location || selectedEvent?.room || '',
      description: selectedEvent?.description || (selectedEvent && selectedEvent.raw && selectedEvent.raw.description) || '',
      durationMinutes: selectedEvent?.durationMinutes || selectedEvent?.duration || (selectedEvent && selectedEvent.raw && selectedEvent.raw.durationMinutes) || 60,
      repeatOption: selectedEvent?.repeatOption ?? (selectedEvent && selectedEvent.raw && selectedEvent.raw.repeatOption) ?? null,
      type: selectedEvent?.type || 'class',
      color: selectedEvent?.color || '#60A5FA'
    });
    setConfirmingDelete(false);
    setTimeout(() => titleRef.current?.focus?.(), 0);
  }, [selectedEvent ? JSON.stringify(selectedEvent) : null]);

  function handleSave() {
    const finalDescription = formData.room ? `${formData.description || ''}\n\nLocation: ${formData.room}`.trim() : formData.description;
    const payload = {
      id: selectedEvent?.id,
      title: formData.title,
      description: finalDescription || undefined,
      date: formData.date || undefined,
      time: formData.startTime,
      endTime: formData.endTime,
      durationMinutes: formData.durationMinutes,
      courseId: formData.selectedCourse || undefined,
      room: formData.room || undefined,
      location: formData.room || undefined
    };
    try { console.log('EventModal saving payload (sanitized):', payload); } catch (e) {}
    onSave && onSave(payload);
  }

  function handleDeleteConfirm() {
    // pass the full selected event to the delete handler so caller can determine id/template behavior
    if (!selectedEvent) return;
    // send delete scope as a second param so callers can handle series deletion
    onDelete && onDelete(selectedEvent, deleteScope);
    onClose && onClose();
  }

  return (
    <CreateStepModal visible={visible} onClose={onClose} ariaLabel={modalMode === 'edit' ? 'Edit event' : 'Add event'}>
      <ModalShell title={formData.title || (modalMode === 'edit' ? 'Edit event' : 'Create event')} subtitle={formData.date || selectedEvent?.date || ''} onClose={onClose} actions={(
        <>
          <div className="flex items-center">
            {modalMode === 'edit' && (
              !confirmingDelete ? (
                <button onClick={() => setConfirmingDelete(true)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md flex items-center gap-2 mr-4">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              ) : (
                <div className="flex items-center gap-2 mr-4">
                  <button onClick={() => setConfirmingDelete(false)} className="px-3 py-1 border rounded-md text-gray-700">Cancel</button>
                  <button onClick={() => setShowScopeModal(true)} className="px-3 py-1 bg-red-600 text-white rounded-md">Confirm Delete</button>
                </div>
              )
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md text-gray-700">Close</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md shadow-sm">{modalMode === 'edit' ? 'Save changes' : 'Create event'}</button>
          </div>
        </>
      )}>
        <div className="space-y-4">
          <EventForm values={formData} onChange={(next) => setFormData(next)} courseOptions={courseOptions} repeatOption={formData.repeatOption} date={selectedEvent?.date} onOpenRepeat={() => setShowRepeatModal(true)} />
        </div>
      </ModalShell>
      <RepeatOptionsModal visible={showRepeatModal} value={formData.repeatOption} onClose={() => setShowRepeatModal(false)} onSave={(val) => setFormData(fd => ({ ...(fd || {}), repeatOption: val }))} />
      <EditScopeModal visible={showScopeModal} mode={'delete'} onClose={() => setShowScopeModal(false)} onConfirm={(scope) => {
        // when user confirms scope, call delete handler
        setShowScopeModal(false);
        onDelete && onDelete(selectedEvent, scope);
        onClose && onClose();
      }} />
    </CreateStepModal>
  );
}
