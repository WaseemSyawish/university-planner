import React from 'react';
import Head from 'next/head';
export default function Profile() {
  const [profile, setProfile] = React.useState(null);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', email: '', avatarColor: '' });
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // check auth first
        const am = await fetch('/api/auth/me');
        const jm = am.ok ? await am.json() : null;
        if (!jm || !jm.authenticated) { window.location.href = '/signin'; return; }
        const res = await fetch(`/api/users/${jm.id}`);
        if (!mounted) return;
        if (res.ok) setProfile(await res.json());
      } catch (e) {}
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div style={{ padding: 36 }}>
      <Head>
        <title>Profile — University Planner</title>
      </Head>
      <div className="card" style={{ maxWidth: 720, margin: '48px auto' }}>
        <h2 style={{ marginTop: 0 }}>Profile</h2>
        {!profile ? (
          <p className="muted">Loading…</p>
        ) : (
          <div>
            {!editing ? (
              <div>
                <div className="text-sm font-semibold">{profile.name}</div>
                <div className="text-xs muted">{profile.email}</div>
                <div style={{ marginTop: 12 }}>
                  <button className="btn-primary" onClick={() => { setForm({ name: profile.name || '', email: profile.email || '', avatarColor: profile.avatarColor || '' }); setEditing(true); }}>Edit profile</button>
                </div>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault(); setSaving(true);
                try {
                  // resolve current user id and patch
                  const am = await fetch('/api/auth/me');
                  const jm = am.ok ? await am.json() : null;
                  if (!jm || !jm.authenticated) { alert('Not signed in'); setSaving(false); return; }
                  const res = await fetch(`/api/users/${jm.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
                  if (res.ok) {
                    const j = await res.json();
                    if (j && j.user) setProfile({ name: j.user.name, email: j.user.email, avatarColor: j.user.avatarColor });
                    setEditing(false);
                  } else {
                    alert('Failed to save');
                  }
                } catch (e) { alert('Failed to save'); }
                setSaving(false);
              }}>
                <div>
                  <label className="text-xs">Full name</label>
                  <input className="cozy-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <label className="text-xs">Email</label>
                  <input className="cozy-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <label className="text-xs">Avatar color</label>
                  <input type="color" value={form.avatarColor || '#7c3aed'} onChange={e => setForm(f => ({ ...f, avatarColor: e.target.value }))} />
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                  <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


