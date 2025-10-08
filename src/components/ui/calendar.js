import React, { useMemo, useState, useEffect } from 'react'

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }

function getMonthGrid(date) {
  const start = startOfMonth(date)
  const days = []
  // find first day of week for start (Sunday)
  const startDay = new Date(start)
  startDay.setDate(start.getDate() - start.getDay())
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDay)
    d.setDate(startDay.getDate() + i)
    days.push(d)
  }
  return days
}

export function Calendar({ mode = 'single', selected, onSelect }) {
  const today = new Date()
  // maintain internal focused month so prev/next work
  const [focused, setFocused] = useState(selected instanceof Date ? new Date(selected) : today)

  // sync when parent changes selected to a different month/date
  useEffect(() => {
    if (selected instanceof Date) setFocused(new Date(selected))
  }, [selected && selected.toString()])

  const grid = useMemo(() => getMonthGrid(focused), [focused.getFullYear(), focused.getMonth()])

  const monthLabel = focused.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  function goPrev() {
    setFocused(new Date(focused.getFullYear(), focused.getMonth() - 1, 1))
  }

  function goNext() {
    setFocused(new Date(focused.getFullYear(), focused.getMonth() + 1, 1))
  }

  return (
    <div className="cozy border rounded-lg shadow p-2 w-[240px]">
      <div className="flex items-center justify-between px-2 py-1">
        <button aria-label="Previous month" onClick={goPrev} className="p-1 rounded-md text-slate-900 dark:text-slate-100 hover:bg-gray-50">◀</button>
        <div className="text-sm font-medium text-gray-700">{monthLabel}</div>
        <button aria-label="Next month" onClick={goNext} className="p-1 rounded-md text-slate-900 dark:text-slate-100 hover:bg-gray-50">▶</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-xs text-gray-400 px-2 mt-2">
        <div className="text-center">Su</div><div className="text-center">Mo</div><div className="text-center">Tu</div><div className="text-center">We</div><div className="text-center">Th</div><div className="text-center">Fr</div><div className="text-center">Sa</div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 p-1 mt-1">
  {grid.map((d, idx) => {
          const isCurrentMonth = d.getMonth() === focused.getMonth()
          const isSelected = selected && (new Date(selected)).toDateString() === d.toDateString()
          return (
            <button
              key={idx}
              onClick={() => onSelect && onSelect(new Date(d))}
              className={`w-full h-8 flex items-center justify-center rounded ${isSelected ? 'bg-indigo-600 text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-400'} hover:bg-white/6`}
              style={isSelected ? { boxShadow: '0 2px 0 rgba(0,0,0,0.04)' } : undefined}
            >
              <span className={`inline-flex items-center justify-center ${isSelected ? 'w-6 h-6 rounded-full' : ''}`}>{d.getDate()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default Calendar
