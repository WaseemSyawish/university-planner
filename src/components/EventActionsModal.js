import React from 'react';
import ReactDOM from 'react-dom';
import { Edit3, Trash2, X } from 'lucide-react';

// Any.do-esque action modal for events
const EventActionsModal = ({ event, onClose, onEdit, onDelete }) => {
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to permanently delete this event?')) {
      await onDelete(event);
      onClose();
    }
  };

  // Render via portal so parent stacking/context doesn't clip the modal
  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
  <div className="cozy rounded-xl shadow-lg w-full max-w-md p-4 transform transition-all duration-150 ease-[cubic-bezier(.2,.9,.28,1)] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between mb-3">
          <div className="pr-3 flex-1 min-w-0">
            <h4 className="text-base font-semibold text-gray-800 truncate">Event actions</h4>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{event.title || '—'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-white/6 btn btn-ghost">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1 space-y-2">
          <button
            onClick={() => { onEdit(event); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold shadow-sm btn"
          >
            <Edit3 className="w-4 h-4" />
            Edit event
          </button>

          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-100 btn btn-ghost"
          >
            <Trash2 className="w-4 h-4" />
            Delete event
          </button>
        </div>

        <div className="mt-3 text-xs text-gray-400">Some actions are undoable for a short time and can be undone via the Undo toast.</div>
      </div>
    </div>
  );

  const portalRoot = (typeof document !== 'undefined') ? document.body : null;
  if (portalRoot) return ReactDOM.createPortal(modal, portalRoot);
  return null;
};

export default EventActionsModal;
