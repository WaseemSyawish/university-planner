import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import CreateStepModal from './CreateStepModal';
import EventForm from '../../components/Calendar/EventForm';
import RepeatOptionsModal from './RepeatOptionsModal';

function ymdToLocalDateString(ymd) {
  // ymd expected as 'YYYY-MM-DD' — construct a local Date to avoid timezone shifts
  if (!ymd) return '';
  const parts = String(ymd).split('-').map(p => Number(p));
  if (parts.length !== 3) return String(ymd);
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export default function QuickCreateModal({ visible = true, slot, courseOptions = [], repeatOption = 'every-week', onSave, onClose, onBack, onEntered, onOpenRepeat }) {
  const { date, time: slotTime, courseId } = slot || {};
  const [form, setForm] = useState(() => ({
    title: '',
    selectedCourse: String(courseId || (courseOptions[0] && courseOptions[0].id) || ''),
    // prefer 08:30 placeholder for nicer default span if slot indicates 30 or early morning
    startTime: slotTime || (slot && slot.time ? slot.time : '08:30'),
    endTime: (() => {
      try {
        const [h, m] = ((slot && slot.time) || slotTime || '09:00').split(':').map(Number);
        const total = h * 60 + m + 60;
        const hh = String(Math.floor(total / 60)).padStart(2, '0');
        const mm = String(total % 60).padStart(2, '0');
        return `${hh}:${mm}`;
      } catch (e) { return '10:00'; }
    })(),
    durationMinutes: slot && slot.durationMinutes ? slot.durationMinutes : 60,
    room: '',
    description: ''
  }));
  const modalRef = useRef(null);
  const inputRef = useRef(null);
  const [room, setRoom] = useState('');
  const [localRepeat, setLocalRepeat] = useState(repeatOption || 'every-week');
  const [showRepeatModal, setShowRepeatModal] = useState(false);

  useEffect(() => {
    if (courseId) setForm(f => ({ ...f, selectedCourse: String(courseId) }));
    if (courseOptions && courseOptions.length && !form.title) {
      const c = courseOptions.find(c => String(c.id) === String(courseId)) || courseOptions[0];
      if (c) setForm(f => ({ ...f, title: c.code || c.name || 'New Class' }));
    }
    if (slotTime) setForm(f => ({ ...f, startTime: slotTime }));
  }, [slot, courseOptions, courseId]);

  // keep form.durationMinutes in sync (EventForm will compute it when start/end change)

  useEffect(() => {
    // focus trap & escape handling
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose && onClose();
      }
      if (e.key === 'Tab') {
        const root = modalRef.current;
        if (!root) return;
        const focusable = root.querySelectorAll('a[href], button:not([disabled]), textarea, input, select');
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleBack() {
    if (onBack) onBack();
    else onClose && onClose();
  }

  function handleSave() {
    const course = courseOptions.find(c => String(c.id) === String(form.selectedCourse)) || {};
    const payload = {
      id: 'tmp-' + Date.now(),
      courseId: form.selectedCourse,
      title: form.title || (course.code || course.name) || 'New Class',
      subject: form.title || (course.code || course.name) || 'New Class',
      date, // keep as YYYY-MM-DD
      time: form.startTime || '09:00',
      endTime: form.endTime || '10:00',
      durationMinutes: form.durationMinutes || 60,
      repeatOption: localRepeat,
      type: 'class',
      location: form.room || '',
      description: form.description || '',
      color: course.color || '#9CA3AF'
    };
    try { console.debug('[QuickCreateModal] handleSave payload ->', payload); } catch (e) { }
    onSave?.(payload);
    // close
    onClose && onClose();
  }

  if (!slot) return null;

  return (
    <CreateStepModal visible={visible} onClose={onClose} onEntered={() => { inputRef.current?.focus?.(); onEntered && onEntered(); }} ariaLabel="Quick create event">
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="quickcreate-title" className="relative w-full max-w-2xl mx-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <div id="quickcreate-title" className="text-xs text-gray-500">Quick add</div>
            <div className="font-semibold text-gray-900 text-xl">{ymdToLocalDateString(date)}</div>
            <div className="text-sm text-gray-500">{form.startTime} → {form.endTime}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleBack} className="px-3 py-2 text-sm border rounded-md btn btn-ghost">Back</button>
            <button onClick={onClose} aria-label="Close" className="p-2 text-gray-500 rounded hover:bg-gray-100"><X className="w-5 h-5"/></button>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-auto">
          <EventForm values={form} onChange={(next) => setForm(next)} courseOptions={courseOptions} repeatOption={localRepeat} onOpenRepeat={() => setShowRepeatModal(true)} date={date} />
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md btn btn-ghost">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md btn btn-primary">Save</button>
        </div>
      </div>
      <RepeatOptionsModal visible={showRepeatModal} value={localRepeat} onClose={() => setShowRepeatModal(false)} onSave={(val) => { setLocalRepeat(val); setShowRepeatModal(false); }} />
    </CreateStepModal>
  );
}
