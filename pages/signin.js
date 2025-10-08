import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function SignIn() {
  const router = useRouter();
  const returnTo = Array.isArray(router.query.returnTo) ? router.query.returnTo[0] : (router.query.returnTo || '/overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get('email');
    const password = form.get('password');

    // Use next-auth signIn with credentials provider. Use redirect: false to inspect result,
    // then navigate to the callback URL so NextAuth sets its session cookie correctly.
    try {
      const result = await signIn('credentials', { redirect: false, email, password, callbackUrl: returnTo });
      if (!result) {
        setError('Sign in failed (no response)');
        setLoading(false);
        return;
      }
      if (result.error) {
        // next-auth often returns short error codes (e.g. 'CredentialsSignin').
        // Map known codes to friendly messages for users while logging details
        // for diagnostics.
        const code = typeof result.error === 'string' ? result.error : '';
        console.warn('[signin] next-auth returned error code', code, result);
        const friendly = (c) => {
          if (!c) return 'Invalid credentials';
          if (c.toLowerCase().includes('credentials')) return 'Invalid email or password';
          if (c.toLowerCase().includes('csrf')) return 'Security check failed. Try again.';
          return c;
        };
        setError(friendly(code));
        setLoading(false);
        return;
      }
      console.log('[signin] next-auth signIn result', result);
      // Verify session server-side by calling our /api/auth/me endpoint. If the session is active
      // the middleware and server will accept the user. This guards against cookie not being set.
      try {
        const check = await fetch('/api/auth/me');
        if (check.ok) {
          const json = await check.json().catch(()=>null);
          if (json && json.authenticated) {
            const dest = result.url || returnTo || '/overview';
            window.location.href = dest;
            return;
          }
        }
      } catch (e) {
        console.warn('[signin] /api/auth/me check failed', e);
      }

      // If programmatic signIn didn't attach a usable session, do a redirect-based signIn
      // so the server callback can set cookies.
      try {
        await signIn('credentials', { redirect: true, email, password, callbackUrl: returnTo });
        return;
      } catch (e) {
        console.error('[signin] final redirect signIn failed', e);
        setError('Sign in failed. Please try again.');
      }
    } catch (err) {
      console.error('Sign in error', err);
      setError(err?.message || 'Sign in failed');
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 36 }}>
      <div className="card" style={{ maxWidth: 480, margin: '48px auto' }}>
        <h2 style={{ marginTop: 0 }}>Sign in</h2>
        <p className="muted">Sign in to access your planner.</p>

        <form onSubmit={handleSubmit}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <div style={{ marginTop: 12 }}>
            <label className="text-xs">Email</label>
            <input name="email" className="cozy-input" type="email" required style={{ width: '100%' }} />
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="text-xs">Password</label>
            <input name="password" className="cozy-input" type="password" required style={{ width: '100%' }} />
          </div>
          {error ? <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div> : null}
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button className="btn-primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
            <Link href="/landing" className="btn-secondary">Back</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
