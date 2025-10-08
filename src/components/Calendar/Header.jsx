import React from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

export default function Header({ title, viewMode, onSetViewMode, onPrev, onNext, onToday, onAdd }) {
  return (
    <div className="cozy border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
            <button
              onClick={onToday}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Today
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onPrev}
              className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold text-gray-800 min-w-[200px] text-center">
              {/* parent should render title content here */}
            </h2>

            <button
              onClick={onNext}
              className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => onSetViewMode('day')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'day' ? 'cozy text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Day
              </button>
              <button
                onClick={() => onSetViewMode('week')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'week' ? 'cozy text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Week
              </button>
              <button
                onClick={() => onSetViewMode('month')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'month' ? 'cozy text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Month
              </button>
              <button
                onClick={() => onSetViewMode('agenda')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'agenda' ? 'cozy text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Agenda
              </button>
            </div>

            <button
              onClick={onAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
