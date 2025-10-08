import React from 'react';
import { X } from 'lucide-react';

export default function ModalShell({ visible = true, title = '', subtitle = '', showBack = false, onBack = null, onClose = () => {}, actions = null, children }) {
  return (
    <div className={`w-full max-w-3xl mx-auto`}>
  <div className="px-6 pt-5 pb-4 border-b cozy">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
            {showBack ? <button onClick={onBack} className="text-gray-600 dark:text-slate-300 hover:text-gray-800 dark:hover:text-white">◀</button> : null}
            <div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</div>
              {subtitle ? <div className="text-sm text-slate-700 dark:text-slate-300">{subtitle}</div> : null}
            </div>
          </div>
          <div>
            <button onClick={onClose} className="text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      <div className="p-6 cozy">
        {children}
      </div>

      {actions ? (
        <div className="px-6 py-4 border-t cozy sticky bottom-0 flex items-center justify-end gap-3">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
