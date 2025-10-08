import React from 'react';
import { Plus, MoreVertical } from 'lucide-react';

export default function SettingsPanel({ visible = true, timetables = [], onClose = () => {}, onAdd = () => {}, onEdit = () => {} }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
  <div className="relative w-full max-w-lg cozy rounded-2xl shadow-2xl overflow-auto p-6">
        <div className="w-full flex items-center justify-between mb-4">
          <h3 className="text-2xl font-semibold">Settings</h3>
          <button onClick={onClose} className="text-gray-500 p-2 rounded hover:bg-gray-100">Close</button>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-2">TIMETABLES</div>
          <div className="space-y-3">
            {timetables && timetables.length ? timetables.map(t => (
              <div key={t.id} className="p-3 rounded-lg bg-indigo-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full cozy flex items-center justify-center border">✓</div>
                    <div className="font-medium">{t.title}</div>
                  </div>
                  <div>
                    <button onClick={() => onEdit(t)} className="p-2 rounded hover:bg-gray-100"><MoreVertical className="w-4 h-4 text-gray-600"/></button>
                  </div>
                </div>
                {Array.isArray(t.modules) && t.modules.length ? (
                  <div className="mt-2 text-sm text-gray-700">
                    <div className="text-xs text-gray-500">Modules ({t.modules.length})</div>
                    <ul className="mt-1 list-inside list-disc text-sm">
                      {t.modules.slice(0,5).map((m, idx) => (
                        <li key={idx}>{m.title || m.subject || `${m.dayOfWeek != null ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][m.dayOfWeek] : ''} ${m.time || ''}`} {m.room ? `— ${m.room}` : ''}</li>
                      ))}
                      {t.modules.length > 5 && <li className="text-xs text-gray-500">and {t.modules.length - 5} more…</li>}
                    </ul>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-gray-500">No modules in this template</div>
                )}
              </div>
            )) : (
              <div className="p-4 rounded-lg bg-gray-50 text-sm text-gray-500">No timetables yet</div>
            )}

            <button onClick={onAdd} className="w-full mt-2 p-3 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center gap-2"><Plus className="w-4 h-4"/> Add Timetable</button>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-xs text-gray-500 mb-2">LAYOUT</div>
          <div className="p-4 rounded-lg bg-gray-50 flex items-center gap-4">
            <div className="flex-1">
              <div className="font-medium">Week</div>
              <div className="text-sm text-gray-500">Shows full week grid</div>
            </div>
            <div className="text-indigo-600 font-medium">Selected</div>
          </div>
        </div>

      </div>
    </div>
  );
}
