import React, { useEffect, useRef, useCallback } from 'react';

// Presentational TaskEditPane used by Calendar EventModal
export default function TaskEditPane(props) {
  const {
    modalRef,
    mounted,
    notification,
    setNotification,
    titleRef,
    eventData,
    setEventData,
    errorMsg,
    eventTypeOptions,
    courses,
    parseLocalDateTime,
    MIN_SCHEDULE_OFFSET_MS,
    addSubtaskInputRef,
    addSubtask,
    toggleSubtask,
    updateSubtaskText,
    removeSubtask,
    isEditing,
    handleSubmit,
    handleClose,
    isSubmitting
  } = props;

  // Auto-dismiss notifications
  useEffect(() => {
    if (!notification) return;
    const to = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(to);
  }, [notification, setNotification]);

  // Drag & drop state for subtasks
  const dragIndexRef = useRef(null);
  const dragOverIndexRef = useRef(null);

  const handleDragStart = useCallback((e, idx) => {
    dragIndexRef.current = idx;
    try { e.dataTransfer.setData('text/plain', String(idx)); } catch (err) { /* some browsers */ }
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, idx) => {
    e.preventDefault(); // necessary to allow drop
    dragOverIndexRef.current = idx;
  }, []);

  const handleDrop = useCallback((e, idx) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    const to = typeof dragOverIndexRef.current === 'number' ? dragOverIndexRef.current : idx;
    if (from == null || to == null || from === to) {
      dragIndexRef.current = null;
      dragOverIndexRef.current = null;
      return;
    }
    setEventData(prev => {
      const subtasks = Array.isArray(prev.subtasks) ? [...prev.subtasks] : [];
      const [moved] = subtasks.splice(from, 1);
      subtasks.splice(to, 0, moved);
      return { ...prev, subtasks };
    });
    dragIndexRef.current = null;
    dragOverIndexRef.current = null;
  }, [setEventData]);

  const moveSubtask = useCallback((id, direction) => {
    setEventData(prev => {
      const subtasks = Array.isArray(prev.subtasks) ? [...prev.subtasks] : [];
      const idx = subtasks.findIndex(s => s.id === id);
      if (idx === -1) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= subtasks.length) return prev;
      const [moved] = subtasks.splice(idx, 1);
      subtasks.splice(newIdx, 0, moved);
      return { ...prev, subtasks };
    });
  }, [setEventData]);

  // Helper: format display date safely (handle YYYY-MM-DD and ISO datetimes)
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString();
      }
      const dt = new Date(dateStr);
      if (isNaN(dt.getTime())) return String(dateStr);
      return dt.toLocaleDateString();
    } catch (e) {
      return String(dateStr);
    }
  };

  return (
    <div
      ref={modalRef}
      className={`cozy rounded-2xl shadow-md w-full max-w-md max-h-[86vh] transform transition-all duration-150 ease-[cubic-bezier(.2,.9,.28,1)] flex flex-col ${mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-[0.995]'}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Minimal Modal Header */}
  <div className="px-5 py-3 border-b border-gray-100 rounded-t-2xl cozy">
        <div className="flex items-center justify-between">
          <div className="text-center w-full">
            <h2 className="text-base font-semibold text-gray-800">{isEditing ? 'Edit Event' : 'New Event'}</h2>
            <p className="text-gray-400 mt-0.5 text-xs">{new Date(eventData.date).toLocaleDateString()}</p>
          </div>
          <button onClick={handleClose} aria-label="Close" className="ml-3 w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.4 6.8L6.8 16.4M6.8 6.8L16.4 16.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {/* Modal Content (scrollable middle) */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        <div className="absolute top-6 right-6 z-50">
          {notification && (
            <div className={`px-4 py-3 rounded-lg shadow-md ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              <div className="text-sm">{notification.message}</div>
            </div>
          )}
        </div>

        {/* Title Field */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Event Title *</label>
          <input
            ref={titleRef}
            type="text"
            placeholder="Enter event title..."
            value={eventData.title}
            onChange={(e) => setEventData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-4 py-3 bg-[var(--card-bg)] border border-gray-200 rounded-xl focus:outline-none focus:ring-3 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-lg"
          />
          <div className="min-h-[2.25rem]">
            {errorMsg && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                {errorMsg}
              </div>
            )}
          </div>
        </div>

        {/* Event Type & Course Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Event Type</label>
            <div className="flex flex-wrap gap-2">
              {eventTypeOptions.map(option => {
                const active = option.value === eventData.type;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setEventData(prev => ({ ...prev, type: option.value }))}
                    className={`px-3 py-2 rounded-full text-sm font-medium transition-shadow duration-150 flex items-center gap-2 ${active ? `bg-gradient-to-r ${option.color} text-white shadow-md` : 'bg-gray-100 text-gray-700 hover:shadow-sm'}`}
                  >
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {courses.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Course (Optional)</label>
              <select value={eventData.courseId} onChange={(e) => setEventData(prev => ({ ...prev, courseId: e.target.value }))} className="w-full px-4 py-3 bg-[var(--card-bg)] border border-gray-200 rounded-xl focus:outline-none focus:ring-3 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 appearance-none cursor-pointer">
                <option value="">No course selected</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.code ? `${course.code} - ${course.name}` : course.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Date & Time Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Date</label>
            <input
              type="date"
              value={eventData.date}
              min={isEditing ? undefined : new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                const newDate = e.target.value;
                const now = new Date();
                const minAllowed = new Date(now.getTime() + MIN_SCHEDULE_OFFSET_MS);
                const candidate = parseLocalDateTime(newDate, eventData.time);
                if (!isEditing && candidate < minAllowed) {
                  const yyyy = String(minAllowed.getFullYear());
                  const mm = String(minAllowed.getMonth() + 1).padStart(2, '0');
                  const dd = String(minAllowed.getDate()).padStart(2, '0');
                  const hh = String(minAllowed.getHours()).padStart(2, '0');
                  const min = String(minAllowed.getMinutes()).padStart(2, '0');
                  setEventData(prev => ({ ...prev, date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` }));
                } else {
                  setEventData(prev => ({ ...prev, date: newDate }));
                }
              }}
              className="w-full px-4 py-3 bg-[var(--card-bg)] border border-gray-200 rounded-xl focus:outline-none focus:ring-3 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Time</label>
            <input
              type="time"
              value={eventData.time}
              onChange={(e) => {
                const newTime = e.target.value;
                const now = new Date();
                const minAllowed = new Date(now.getTime() + MIN_SCHEDULE_OFFSET_MS);
                const candidate = parseLocalDateTime(eventData.date, newTime);
                if (!isEditing && candidate < minAllowed) {
                  const yyyy = String(minAllowed.getFullYear());
                  const mm = String(minAllowed.getMonth() + 1).padStart(2, '0');
                  const dd = String(minAllowed.getDate()).padStart(2, '0');
                  const hh = String(minAllowed.getHours()).padStart(2, '0');
                  const min = String(minAllowed.getMinutes()).padStart(2, '0');
                  setEventData(prev => ({ ...prev, date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` }));
                } else {
                  setEventData(prev => ({ ...prev, time: newTime }));
                }
              }}
              className="w-full px-4 py-3 bg-[var(--card-bg)] border border-gray-200 rounded-xl focus:outline-none focus:ring-3 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
            />
          </div>
        </div>

        {/* Subtasks editor (compact) */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Subtasks</label>
          <div className="flex gap-2">
            <input ref={addSubtaskInputRef} type="text" placeholder="New subtask" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-[var(--card-bg)]" />
            <button type="button" onClick={() => addSubtask(addSubtaskInputRef.current?.value)} className="px-3 py-2 bg-blue-600 text-white rounded-lg">Add</button>
          </div>

          <div className="space-y-2">
            {eventData.subtasks && eventData.subtasks.length > 0 ? (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2">
                {eventData.subtasks.map((s, idx) => (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    className="flex items-center gap-3 cozy border border-gray-100 rounded-lg px-3 py-2"
                  >
                    <input type="checkbox" checked={!!s.done} onChange={() => toggleSubtask(s.id)} className="w-4 h-4" />
                    <input value={s.text} onChange={(e) => updateSubtaskText(s.id, e.target.value)} className="flex-1 bg-transparent focus:outline-none text-sm" />

                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => moveSubtask(s.id, 'up')} aria-label="Move up" className="p-1 rounded hover:bg-gray-100 text-xs">▲</button>
                      <button type="button" onClick={() => moveSubtask(s.id, 'down')} aria-label="Move down" className="p-1 rounded hover:bg-gray-100 text-xs">▼</button>
                      <button onClick={() => removeSubtask(s.id)} className="text-red-500 px-2 text-sm">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400">No subtasks yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Footer (minimal) */}
      <div className="px-5 py-3 bg-white border-t border-gray-100 flex-shrink-0 rounded-b-2xl">
        <div className="flex items-center justify-end gap-3">
          <button onClick={handleClose} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors duration-150">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting || !eventData.title.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg transition-colors duration-150">
            {isSubmitting ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}
