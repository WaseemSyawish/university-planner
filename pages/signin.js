import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import { GraduationCap, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';

export default function SignIn() {
  const router = useRouter();
  const returnTo = Array.isArray(router.query.returnTo) ? router.query.returnTo[0] : (router.query.returnTo || '/overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [justRegistered, setJustRegistered] = useState(false);

  // When redirected from the signup page, show a friendly success banner.
  useEffect(() => {
    if (!router || !router.query) return;
    if (router.query.registered === '1' || router.query.registered === 'true') {
      setJustRegistered(true);
      // Clear the param from the URL so refresh doesn't keep showing it.
      const url = new URL(window.location.href);
      url.searchParams.delete('registered');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get('email');
    const password = form.get('password');

    try {
      const result = await signIn('credentials', { redirect: false, email, password, callbackUrl: returnTo });
      if (!result) {
        setError('Sign in failed (no response)');
        setLoading(false);
        return;
      }
      if (result.error) {
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
  <div className="min-h-screen signin-root bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <style jsx global>{`
        /* Page-scoped override: ensure form inputs are readable in dark mode */
        .signin-root input, .signin-root textarea, .signin-root select {
          background: var(--card-bg) !important;
          color: #0b1220 !important;
          caret-color: #0b1220 !important;
          -webkit-text-fill-color: #0b1220 !important; /* Chrome */
        }
        .signin-root input::placeholder, .signin-root textarea::placeholder { color: rgba(51,65,85,0.45) !important; }
        html.dark .signin-root input::placeholder, html.dark .signin-root textarea::placeholder { color: rgba(230,238,251,0.7) !important; }

        /* Dark-mode explicit overrides */
        html.dark .signin-root input, html.dark .signin-root textarea, html.dark .signin-root select {
          color: #e6eefb !important;
          caret-color: #e6eefb !important;
          -webkit-text-fill-color: #e6eefb !important;
        }

        /* Autofill (Chrome / Edge) - force the autofill background to match our card
           and make the text visible. Use high specificity and !important. */
        .signin-root input:-webkit-autofill,
        .signin-root input:-webkit-autofill:hover,
        .signin-root input:-webkit-autofill:focus,
        .signin-root input:-webkit-autofill:active {
          -webkit-text-fill-color: #0b1220 !important;
          -webkit-box-shadow: 0 0 0px 1000px var(--card-bg) inset !important;
          box-shadow: 0 0 0px 1000px var(--card-bg) inset !important;
          caret-color: #0b1220 !important;
        }
        html.dark .signin-root input:-webkit-autofill,
        html.dark .signin-root input:-webkit-autofill:hover,
        html.dark .signin-root input:-webkit-autofill:focus,
        html.dark .signin-root input:-webkit-autofill:active {
          -webkit-text-fill-color: #e6eefb !important;
          -webkit-box-shadow: 0 0 0px 1000px var(--card-bg) inset !important;
          box-shadow: 0 0 0px 1000px var(--card-bg) inset !important;
          caret-color: #e6eefb !important;
        }
      `}</style>
      <Head>
        <title>Sign in — University Planner</title>
      </Head>
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-2xl mb-4 shadow-lg">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ color: '#0b1220' }}>Welcome back</h1>
          <p className="text-slate-700" style={{ color: '#334155' }}>Sign in to continue to University Planner</p>
        </div>

        {/* Sign In Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* Show a success banner if redirected from signup */}
          {justRegistered && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-sm text-green-800">
              Account created successfully — please sign in.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <input type="hidden" name="returnTo" value={returnTo} />
            
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400"
                  style={{ background: 'var(--card-bg)', color: 'var(--brand-900)', caretColor: 'var(--brand-900)' }}
                  placeholder="you@university.edu"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400"
                  style={{ background: 'var(--card-bg)', color: 'var(--brand-900)', caretColor: 'var(--brand-900)' }}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Don't have an account?</span>
            </div>
          </div>

          {/* Sign Up Link */}
          <Link
            href="/signup"
            className="block w-full text-center py-3 px-4 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all"
          >
            Create an account
          </Link>
        </div>

        {/* Back to Landing */}
        <div className="mt-6 text-center">
          <Link href="/landing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}