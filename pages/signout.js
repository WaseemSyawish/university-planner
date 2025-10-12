import { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { signOut } from 'next-auth/react';

export default function SignOut() {
  const router = useRouter();
  useEffect(() => {
    // Ask next-auth to sign out and redirect the browser to the landing page.
    // Using redirect:true + callbackUrl ensures cookies/session are cleared
    // and the user lands on '/'.
    (async () => {
      try {
        // clear our local demo cookies first so middleware won't leave a stale demo user cookie
        try {
          await fetch('/api/auth/local-signout', { method: 'POST' });
        } catch (e) {
          // ignore failures; proceed to next-auth signOut
        }
        await signOut({ redirect: true, callbackUrl: '/landing' });
      } catch (e) {
        // Fallback: if redirect fails for any reason, navigate client-side.
        try {
          router.replace('/landing');
        } catch (err) {
          /* ignore */
        }
      }
    })();
  }, []);
  return (
    <div style={{ padding: 36 }}>
      <Head>
        <title>Sign out — University Planner</title>
      </Head>
      <div className="card" style={{ maxWidth: 680, margin: '48px auto', textAlign: 'center' }}>
        <h2>Signed out</h2>
        <p className="muted">You're being returned to the welcome page.</p>
      </div>
    </div>
  );
}
