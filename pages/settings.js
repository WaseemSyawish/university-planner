import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import Alert, { AlertDescription } from '@/components/ui/alert';

const DEFAULTS = {
  theme: 'system',
  weekStartsOn: 'monday',
  defaultView: 'week',
  notifications: true,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem('up:settings');
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULTS;
  }
}

function saveSettings(obj) {
  try {
    localStorage.setItem('up:settings', JSON.stringify(obj));
    return true;
  } catch (e) {
    return false;
  }
}

export default function Settings() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/users/settings');
        if (res.ok) {
          const json = await res.json();
          if (!mounted) return;
          const server = json?.settings;
          if (server) {
            setSettings({ ...DEFAULTS, ...server });
            // persist locally too
            try { localStorage.setItem('up:settings', JSON.stringify({ ...DEFAULTS, ...server })); } catch (e) {}
            return;
          }
        }
      } catch (e) {
        // ignore - fallback to local
      }
      const local = loadSettings();
      setSettings(local);
      // sync next-themes on load
      try { if (setTheme && typeof setTheme === 'function') setTheme(local.theme || 'system'); } catch (e) {}
    })();
    return () => { mounted = false; };
  }, []);

  function update(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  // Whenever the theme selection changes locally, tell next-themes to update
  useEffect(() => {
    try {
      if (setTheme && typeof setTheme === 'function') {
        setTheme(settings.theme || 'system');
      }
    } catch (e) {
      // ignore
    }
  }, [settings.theme, setTheme]);

  async function handleSave() {
    setError('');
    // First, try to persist to server when authenticated
    try {
      const res = await fetch('/api/users/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      if (res.ok) {
        const json = await res.json();
        const persisted = json?.settings ?? settings;
        try { localStorage.setItem('up:settings', JSON.stringify(persisted)); } catch (e) {}
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app:settings:changed', { detail: persisted }));
        return;
      }
      // if unauthorized or server error, fallback to localStorage
    } catch (e) {
      // ignore
    }

    const ok = saveSettings(settings);
    if (!ok) {
      setError('Failed to save settings — localStorage may be unavailable.');
      setSaved(false);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app:settings:changed', { detail: settings }));
  }

  return (
    <div className="p-6">
      <div className="card" style={{ maxWidth: 900, margin: '32px auto', padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Settings</h2>
        <p className="muted">Adjust your account and application preferences.</p>

        {error && (
          <div style={{ marginTop: 12 }}>
            <Alert variant="danger"><AlertDescription>{error}</AlertDescription></Alert>
          </div>
        )}

        {saved && (
          <div style={{ marginTop: 12 }}>
            <Alert variant="success"><AlertDescription>Settings saved</AlertDescription></Alert>
          </div>
        )}

        <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
          <label>
            <div className="text-sm font-medium">Theme</div>
            <select value={settings.theme} onChange={(e) => update('theme', e.target.value)} className="mt-2">
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>

          <label>
            <div className="text-sm font-medium">Week starts on</div>
            <select value={settings.weekStartsOn} onChange={(e) => update('weekStartsOn', e.target.value)} className="mt-2">
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </select>
          </label>

          <label>
            <div className="text-sm font-medium">Default calendar view</div>
            <select value={settings.defaultView} onChange={(e) => update('defaultView', e.target.value)} className="mt-2">
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" checked={settings.notifications} onChange={(e) => update('notifications', e.target.checked)} />
            <div>
              <div className="text-sm font-medium">Enable notifications</div>
              <div className="text-xs muted">Show reminders and alerts for scheduled events</div>
            </div>
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={handleSave} variant="default">Save</Button>
            <Button onClick={() => { setSettings(loadSettings()); setSaved(false); }} variant="outline">Revert</Button>
          </div>
        </div>
      </div>
    </div>
  );
}


