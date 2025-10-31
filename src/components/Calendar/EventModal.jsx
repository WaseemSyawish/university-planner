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
  const [pendingSavePayload, setPendingSavePayload] = useState(null);
  const [showEditScopeModal, setShowEditScopeModal] = useState(false);
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

  // Helper: extract template/repeat metadata from an event (used to detect series)
  const extractTplFromDescription = (obj) => {
    try {
      if (!obj) return null;
      if (obj.repeatOption) return obj.repeatOption;
      if (obj.template_id) return obj.template_id;
      if (obj.templateId) return obj.templateId;
      if (obj.raw && (obj.raw.template_id || obj.raw.templateId)) return obj.raw.template_id || obj.raw.templateId;
      const desc = obj.description || (obj.raw && obj.raw.description) || '';
      if (desc && typeof desc === 'string') {
        const m = String(desc).match(/\[META\]([\s\S]*?)\[META\]/);
        if (m && m[1]) {
          try { const parsed = JSON.parse(m[1]); return parsed?.template_id || parsed?.templateId || parsed?.repeatOption || null; } catch (e) { return null; }
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  };

  const isSeriesEvent = !!extractTplFromDescription(selectedEvent);

  // Build the payload object for save operations (used by Save and the split-button)
  const buildSavePayload = () => {
    const finalDescription = formData.room ? `${formData.description || ''}\n\nLocation: ${formData.room}`.trim() : formData.description;
    return {
      id: selectedEvent?.id,
      title: formData.title,
      description: finalDescription || undefined,
      date: formData.date || undefined,
      time: formData.startTime,
      endTime: formData.endTime,
      durationMinutes: formData.durationMinutes,
      type: formData.type,
      color: formData.color,
      courseId: formData.selectedCourse || undefined,
      room: formData.room || undefined,
      location: formData.room || undefined
    };
  };

  // Provide a visible debug banner and console log to help diagnose why the
  // edit-scope chooser may not appear for some events. This only appears in
  // development to avoid UI noise in production.
  React.useEffect(() => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[EventModal] selectedEvent debug:', { selectedEvent, isSeriesEvent });
      }
    } catch (e) { /* ignore */ }
  }, [selectedEvent, isSeriesEvent]);
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
      type: formData.type,
      color: formData.color,
      courseId: formData.selectedCourse || undefined,
      room: formData.room || undefined,
      location: formData.room || undefined
    };
    try { console.log('EventModal saving payload (sanitized):', payload); } catch (e) {}
    // If this event is part of a repeating series, ask user whether to apply
    // edits to only this instance or broader scope. We consider an event to be
    // part of a series when it has an explicit repeatOption or a template id
    // on the raw payload.
    // Detect whether this event is part of a series. Look for explicit template ids
    // or embedded [META] JSON in the description so materialized occurrences
    // without direct template_id fields are still recognized.
    const extractTplFromDescription = (obj) => {
      try {
        if (!obj) return null;
        if (obj.repeatOption) return obj.repeatOption;
        if (obj.template_id) return obj.template_id;
        if (obj.templateId) return obj.templateId;
        if (obj.raw && (obj.raw.template_id || obj.raw.templateId)) return obj.raw.template_id || obj.raw.templateId;
        const desc = obj.description || (obj.raw && obj.raw.description) || '';
        if (desc && typeof desc === 'string') {
          const m = String(desc).match(/\[META\]([\s\S]*?)\[META\]/);
          if (m && m[1]) {
            try { const parsed = JSON.parse(m[1]); return parsed?.template_id || parsed?.templateId || parsed?.repeatOption || null; } catch (e) { return null; }
          }
        }
      } catch (e) { /* ignore */ }
      return null;
    };
    const isSeries = !!extractTplFromDescription(selectedEvent);
    if (isSeries) {
      // Store pending payload and show scope chooser modal for edits
      console.debug('[EventModal] Detected series event, showing edit-scope modal', { id: selectedEvent && selectedEvent.id });
      setPendingSavePayload(payload);
      setShowEditScopeModal(true);
      return;
    }

    onSave && onSave(payload);
  }

  async function handleDeleteConfirm() {
    // pass the full selected event to the delete handler so caller can determine id/template behavior
    if (!selectedEvent) return;
    // send delete scope as a second param so callers can handle series deletion
    if (onDelete) {
      try { onDelete(selectedEvent, deleteScope); } catch (e) {}
    } else {
      // Fallback: if a scheduler handler is exposed on window, use it (used by timetable page)
      try {
        const schedulerHandlers = (typeof window !== 'undefined') ? window.__schedulerHandlers : null;
        if (schedulerHandlers && typeof schedulerHandlers.handleDeleteEvent === 'function') {
          // map 'all' scope through; provider expects (id, scope?)
          await schedulerHandlers.handleDeleteEvent(selectedEvent.id, deleteScope === 'all' ? 'all' : undefined);
        } else {
          // last-resort: try direct API delete for the single id (will delete one instance)
          try { await fetch(`/api/events/${encodeURIComponent(selectedEvent.id)}`, { method: 'DELETE' }); } catch (e) {}
        }
      } catch (e) {
        // swallow — best-effort delete
      }
    }

    onClose && onClose();
  }

  return (
    <CreateStepModal visible={visible} onClose={onClose} ariaLabel={modalMode === 'edit' ? 'Edit event' : 'Add event'}>
      <ModalShell title={formData.title || (modalMode === 'edit' ? 'Edit event' : 'Create event')} subtitle={formData.date || selectedEvent?.date || ''} onClose={onClose} actions={(
        <>
          <div className="flex items-center">
            {modalMode === 'edit' && (
              // Open the delete scope chooser immediately for clarity and discoverability
              <button onClick={() => setShowScopeModal(true)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md flex items-center gap-2 mr-4">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md text-gray-700">Close</button>
            {modalMode === 'edit' ? (
              // Always show split button in edit mode so users can explicitly open
              // the EditScope modal even when automatic detection fails.
              <div className="flex items-center rounded-md overflow-hidden">
                <button onClick={handleSave} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-l-md shadow-sm">Save changes</button>
                <button
                  onClick={() => {
                    // Prepare payload and show scope chooser regardless of detection
                    const payload = buildSavePayload();
                    setPendingSavePayload(payload);
                    setShowEditScopeModal(true);
                  }}
                  className="px-3 py-2 text-sm bg-indigo-700/90 text-white rounded-r-md hover:bg-indigo-800 transition-colors"
                  aria-label="More save options"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
            ) : (
              <button onClick={handleSave} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md shadow-sm">{modalMode === 'edit' ? 'Save changes' : 'Create event'}</button>
            )}
          </div>
        </>
      )}>
        <div className="space-y-4">
          {/* Development-only diagnostics: show selectedEvent shape and detection result inline so users
              can copy/paste without opening DevTools. This helps troubleshoot why the EditScopeModal
              does or doesn't appear for a given event object. */}
          {typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development' && (
            <div className="bg-gray-50 border border-gray-200 p-3 rounded text-xs text-gray-700 max-h-48 overflow-auto mb-2">
              <div className="font-medium text-sm mb-1">Debug (dev only): selectedEvent shape</div>
              <div className="mb-2"><strong>isSeriesEvent:</strong> {String(isSeriesEvent)}</div>
              <pre className="whitespace-pre-wrap break-words">{JSON.stringify(selectedEvent, null, 2)}</pre>
            </div>
          )}
          <EventForm values={formData} onChange={(next) => setFormData(next)} courseOptions={courseOptions} repeatOption={formData.repeatOption} date={selectedEvent?.date} onOpenRepeat={() => setShowRepeatModal(true)} />
        </div>
      </ModalShell>
      <RepeatOptionsModal visible={showRepeatModal} value={formData.repeatOption} onClose={() => setShowRepeatModal(false)} onSave={(val) => setFormData(fd => ({ ...(fd || {}), repeatOption: val }))} />
      <EditScopeModal visible={showScopeModal} mode={'delete'} onClose={() => setShowScopeModal(false)} onConfirm={async (scope) => {
        // when user confirms scope, call delete handler
        setShowScopeModal(false);
        if (onDelete) {
          try { onDelete(selectedEvent, scope); } catch (e) {}
        } else {
          try {
            const schedulerHandlers = (typeof window !== 'undefined') ? window.__schedulerHandlers : null;
            if (schedulerHandlers && typeof schedulerHandlers.handleDeleteEvent === 'function') {
              await schedulerHandlers.handleDeleteEvent(selectedEvent.id, scope === 'all' ? 'all' : undefined);
            } else {
              // Best-effort direct API call
              try { await fetch(`/api/events/${encodeURIComponent(selectedEvent.id)}`, { method: 'DELETE' }); } catch (e) {}
            }
          } catch (e) {}
        }
        onClose && onClose();
      }} />
      <EditScopeModal visible={showEditScopeModal} mode={'edit'} onClose={() => { setShowEditScopeModal(false); setPendingSavePayload(null); }} onConfirm={async (scope) => {
        // when user confirms edit scope, call save handler with chosen scope
        setShowEditScopeModal(false);
        try {
          if (!pendingSavePayload) return;
          if (onSave && typeof onSave === 'function') {
            await onSave(pendingSavePayload, scope);
          } else {
            // Fallback for legacy callers: perform a client-side bulk update when
            // user chose 'all'. This mirrors the timetable bulk-update heuristic
            // and ensures 'Update All' updates materialized occurrences even when
            // provider/server linkage is missing.
            try {
              if (scope === 'all') {
                try {
                  const listResp = await fetch('/api/events');
                  const listJson = listResp && listResp.ok ? await listResp.json().catch(() => null) : null;
                  const eventsList = Array.isArray(listJson?.events) ? listJson.events : (Array.isArray(listJson) ? listJson : []);

                  const tplId = selectedEvent && (selectedEvent.template_id || (selectedEvent.raw && (selectedEvent.raw.template_id || selectedEvent.raw.templateId))) || null;
                  const baseDateStr = selectedEvent && (selectedEvent.date || (selectedEvent.raw && selectedEvent.raw.date) || selectedEvent.startDate) || null;

                  const toPatch = eventsList.filter(ev => {
                    try {
                      const evTpl = ev && (ev.template_id || (ev.raw && (ev.raw.template_id || ev.raw.templateId))) || null;
                      if (tplId && evTpl && String(evTpl) === String(tplId)) return true;

                      // check embedded META JSON for template_id
                      try {
                        const desc = ev.description || (ev.raw && ev.raw.description) || '';
                        const m = String(desc).match(/\[META\]([\s\S]*?)\[META\]/);
                        if (m && m[1]) {
                          try { const parsed = JSON.parse(m[1]); if (parsed && parsed.template_id && tplId && String(parsed.template_id) === String(tplId)) return true; } catch (e) {}
                        }
                      } catch (e) {}

                      // fallback: match by title and time
                      const titleMatch = pendingSavePayload && pendingSavePayload.title ? String(ev.title || ev.subject || '').trim() === String(pendingSavePayload.title).trim() : false;
                      const timeMatch = pendingSavePayload && pendingSavePayload.time ? String(ev.time || ev.startTime || ev.start_time || (ev.raw && (ev.raw.time || ev.raw.startTime || ev.raw.start_time)) || '').slice(0,5) === String(pendingSavePayload.time || '').slice(0,5) : false;
                      return titleMatch && timeMatch;
                    } catch (e) { return false; }
                  });

                  try { console.debug('[EventModal] bulk update candidates:', toPatch.length, toPatch.map((x) => x && x.id)); } catch (e) {}
                  for (const ev of toPatch) {
                    try {
                      const resp = await fetch(`/api/events/${encodeURIComponent(ev.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pendingSavePayload) });
                      try { console.debug('[EventModal] PATCH', ev && ev.id, 'status', resp && resp.status); } catch (e) {}
                    } catch (e) { console.warn('Bulk patch failed for', ev && ev.id, e); }
                  }

                  // Force a visible refresh so user sees updated occurrences
                  try { if (typeof window !== 'undefined') window.location.reload(); } catch (e) {}
                } catch (e) {
                  console.warn('[EventModal] client-side bulk update failed', e);
                }
              } else {
                // Non-'all' fallback: try provider handlers then direct PATCH
                const schedulerHandlers = (typeof window !== 'undefined') ? window.__schedulerHandlers : null;
                if (schedulerHandlers && typeof schedulerHandlers.handleUpdateEvent === 'function') {
                  // Pass the event payload, id and scope
                  await schedulerHandlers.handleUpdateEvent(pendingSavePayload, selectedEvent && selectedEvent.id, scope === 'all' ? 'all' : scope === 'future' ? 'future' : undefined);
                } else if (typeof window !== 'undefined') {
                  // As a last resort, attempt direct API PATCH with scope param
                  try {
                    const id = selectedEvent && selectedEvent.id;
                    if (id) {
                      const url = `/api/events/${encodeURIComponent(id)}${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`;
                      await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pendingSavePayload) });
                    }
                  } catch (e) { /* ignore */ }
                }
              }
            } catch (e) {
              console.warn('[EventModal] fallback onConfirm handler failed', e);
            }
          }
        } finally {
          setPendingSavePayload(null);
          onClose && onClose();
        }
      }} />
    </CreateStepModal>
  );
}
