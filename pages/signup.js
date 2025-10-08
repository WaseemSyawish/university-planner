import Link from 'next/link';
import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function SignUp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  return (
    <div style={{ padding: 36 }}>
      <div className="card" style={{ maxWidth: 560, margin: '48px auto' }}>
        <h2 style={{ marginTop: 0 }}>Create account</h2>
        <p className="muted">Create a new account to save your planner data.</p>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          setLoading(true);
          const form = e.currentTarget;
          const name = form.querySelector('input[name=name]').value.trim();
          const email = form.querySelector('input[name=email]').value.trim();
          const password = form.querySelector('input[name=password]').value;
          // Client-side password policy
          if (password.length < 8) {
            setError('Password must be at least 8 characters');
            setLoading(false);
            return;
          }
          if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            setError('Password should include at least one uppercase letter and one number');
            setLoading(false);
            return;
          }
          try {
            const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
            if (res.status === 201) {
              // Prefer programmatic next-auth sign-in so the session is created centrally.
              // If that doesn't result in a usable cookie we fall back to the legacy form submit.
              const params = new URLSearchParams(window.location.search);
              const returnTo = params.get('returnTo') || '/overview';
              try {
                const result = await signIn('credentials', { redirect: false, email, password });
                console.log('[signup] next-auth signIn result', result);

                // Verify session by calling our server-side /api/auth/me endpoint.
                try {
                  const check = await fetch('/api/auth/me');
                  if (check.ok) {
                    const json = await check.json().catch(()=>null);
                    if (json && json.authenticated) {
                      const dest = result?.url || returnTo || '/overview';
                      window.location.href = dest;
                      return;
                    }
                  }
                } catch (e) {
                  console.warn('[signup] /api/auth/me check failed', e);
                }

                // If programmatic signIn didn't provide a usable session, perform
                // a redirect-based NextAuth signIn so the server-side callback can set cookies.
                try {
                  await signIn('credentials', { redirect: true, email, password, callbackUrl: returnTo });
                  return;
                } catch (e) {
                  console.error('[signup] final redirect signIn failed', e);
                  setError('Account created but sign-in failed. You can sign in manually.');
                }
              } catch (e) {
                console.error('[signup] next-auth signIn failed', e);
                setError('Account created but sign-in failed. You can sign in manually.');
              }
            } else {
              const payload = await res.json().catch(()=>({}));
              setError(payload.error || 'Registration failed');
            }
          } catch (err) {
            console.error(err);
            setError('Registration failed');
          } finally {
            setLoading(false);
          }
        }}>
          <div style={{ marginTop: 12 }}>
            <label className="text-xs">Full name</label>
            <input name="name" className="cozy-input" style={{ width: '100%' }} />
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="text-xs">Email</label>
            <input name="email" className="cozy-input" type="email" required style={{ width: '100%' }} />
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="text-xs">Password</label>
            <input name="password" className="cozy-input" type="password" required style={{ width: '100%' }} />
            <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
              Password must be at least 8 characters and include an uppercase letter and a number.
            </div>
          </div>
          {error && <div style={{ marginTop: 12 }} className="text-error">{error}</div>}
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button className="btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
            <Link href="/signin" className="btn-secondary">Already have an account?</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
