import React from 'react';
import { X } from 'lucide-react';

export default function EditScopeModal({ 
  visible = false, 
  mode = 'edit', // 'edit' or 'delete'
  onClose, 
  onConfirm,
  initialScope = null, // 'single' | 'all'
}) {
  const [selectedScope, setSelectedScope] = React.useState(initialScope || 'single');

  // Reset selection when the modal becomes visible so previous selection doesn't persist
  React.useEffect(() => {
    if (visible) {
      try { console.debug('[EditScopeModal] opened, resetting selectedScope to single or initialScope', initialScope); } catch (e) {}
      setSelectedScope(initialScope || 'single');
    }
  }, [visible, initialScope]);

  const isEdit = mode === 'edit';
  const isDelete = mode === 'delete';

  const options = [
    {
      value: 'single',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: isEdit ? 'This Event Only' : 'Delete This Event',
      description: isEdit 
        ? 'Only update this occurrence' 
        : 'Remove only this occurrence',
      gradient: 'from-blue-500 to-cyan-500'
    },
    // 'future' scope removed — we support only 'single' or 'all'
    {
      value: 'all',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      title: isEdit ? 'All Events' : 'Delete All Events',
      description: isEdit 
        ? 'Update all occurrences in the series' 
        : 'Remove all occurrences in the series',
      gradient: 'from-orange-500 to-red-500'
    }
  ];

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div 
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {isEdit ? 'Update Recurring Event' : 'Delete Recurring Event'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Choose which events to {isEdit ? 'update' : 'delete'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Options */}
          <div className="p-6 space-y-3">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedScope(option.value)}
                className={`w-full text-left transition-all duration-200 rounded-xl overflow-hidden ${
                  selectedScope === option.value
                    ? `bg-gradient-to-br ${option.gradient} shadow-lg scale-[1.02]`
                    : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750'
                }`}
              >
                <div className="p-4 flex items-start gap-4">
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedScope === option.value
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}>
                    {option.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold mb-1 ${
                      selectedScope === option.value
                        ? 'text-white'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {option.title}
                    </div>
                    <div className={`text-sm ${
                      selectedScope === option.value
                        ? 'text-white/80'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {option.description}
                    </div>
                  </div>

                  {/* Check indicator */}
                  {selectedScope === option.value && (
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Info */}
          <div className="mx-6 mb-6 p-4 rounded-lg border bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {isEdit 
                  ? "Changes will be applied based on your selection. Other occurrences will remain unchanged unless specified."
                  : "This action cannot be undone. Consider updating instead of deleting if you need to preserve event history."
                }
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 px-6 pb-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(selectedScope)}
              className={`px-6 py-2 text-sm font-bold text-white rounded-lg transition-all shadow-lg ${
                isDelete
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30 hover:shadow-red-500/50'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30 hover:shadow-blue-500/50'
              }`}
            >
              {isEdit ? 'Update Events' : 'Delete Events'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoom-in-95 {
          from { 
            opacity: 0;
            transform: scale(0.95);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-in {
          animation-fill-mode: both;
        }
        .fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .zoom-in-95 {
          animation: zoom-in-95 0.2s ease-out;
        }
      `}</style>
    </>
  );
}
