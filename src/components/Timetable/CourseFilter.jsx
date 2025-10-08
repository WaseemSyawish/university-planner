import React from 'react';

export default function CourseFilter({ courses = [], selected = {}, onToggle, onSelectAll, onClearAll, search = '', onSearch }) {
  return (
    <aside className="sticky top-20">
      <div className="cozy rounded-xl p-4 shadow-sm">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {courses.map(course => {
            const isChecked = !!selected[course.id];
            const color = course.color || 'bg-gray-300';
            return (
              <label key={course.id} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={isChecked} onChange={() => onToggle?.(course.id)} />
                <div className={`w-4 h-4 rounded ${color}`} />
                <div className="text-sm">{course.code || course.name}</div>
              </label>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
