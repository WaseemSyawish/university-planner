import React from 'react';
import { Home, Settings } from 'lucide-react';

export default function CalendarHeader({ userName }) {
  return (
    <header className="bg-white/95 backdrop-blur-xl border-b border-slate-200/60 px-6 py-4 sticky top-0 z-40 shadow-sm">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Home className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">University Planner</h1>
            <p className="text-xs text-slate-700 dark:text-slate-300">Overview</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            className="inline-flex items-center gap-2 text-base font-medium text-purple-600 bg-purple-50 hover:bg-purple-600 hover:text-white px-6 py-2 rounded-lg transition-colors"
            onClick={() => window.location.href = '/settings'}
            aria-label="Open settings"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700" onClick={async () => {
            try {
              try { await fetch('/api/auth/local-signout', { method: 'POST' }); } catch (e) { /* ignore */ }
              window.location.href = '/signin';
            } catch (e) {
              window.location.href = '/signout';
            }
          }}>
            SIGN OUT
          </button>
        </div>
      </div>
    </header>
  );
}
