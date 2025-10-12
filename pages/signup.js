import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { GraduationCap, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';

export default function SignUp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  return (
  <div className="min-h-screen signup-root bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <style jsx global>{`
        /* Page-scoped override: ensure form inputs are readable in dark mode */
        .signup-root input, .signup-root textarea, .signup-root select {
          background: var(--card-bg) !important;
          color: #0b1220 !important;
          caret-color: #0b1220 !important;
          -webkit-text-fill-color: #0b1220 !important; /* Chrome */
        }
        .signup-root input::placeholder, .signup-root textarea::placeholder { color: rgba(51,65,85,0.45) !important; }
        html.dark .signup-root input::placeholder, html.dark .signup-root textarea::placeholder { color: rgba(230,238,251,0.7) !important; }

        /* Dark-mode explicit overrides */
        html.dark .signup-root input, html.dark .signup-root textarea, html.dark .signup-root select {
          color: #e6eefb !important;
          caret-color: #e6eefb !important;
          -webkit-text-fill-color: #e6eefb !important;
        }

        /* Autofill (Chrome / Edge) - ensure saved values remain visible */
        .signup-root input:-webkit-autofill,
        .signup-root input:-webkit-autofill:hover,
        .signup-root input:-webkit-autofill:focus,
        .signup-root input:-webkit-autofill:active {
          -webkit-text-fill-color: #0b1220 !important;
          -webkit-box-shadow: 0 0 0px 1000px var(--card-bg) inset !important;
          box-shadow: 0 0 0px 1000px var(--card-bg) inset !important;
          caret-color: #0b1220 !important;
        }
        html.dark .signup-root input:-webkit-autofill,
        html.dark .signup-root input:-webkit-autofill:hover,
        html.dark .signup-root input:-webkit-autofill:focus,
        html.dark .signup-root input:-webkit-autofill:active {
          -webkit-text-fill-color: #e6eefb !important;
          -webkit-box-shadow: 0 0 0px 1000px var(--card-bg) inset !important;
          box-shadow: 0 0 0px 1000px var(--card-bg) inset !important;
          caret-color: #e6eefb !important;
        }
      `}</style>
      <Head>
        <title>Sign up — University Planner</title>
      </Head>
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-2xl mb-4 shadow-lg">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ color: '#0b1220' }}>Create your account</h1>
          <p className="text-slate-700" style={{ color: '#334155' }}>Get started with University Planner today</p>
        </div>

        {/* Sign Up Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
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
              const res = await fetch('/api/auth/register', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ name, email, password }) 
              });

              if (res.status === 201) {
                // Simple, clear UX: redirect to sign-in page with a flag so
                // the sign-in page can show a success banner. This avoids
                // confusing multi-step auto sign-in flows and makes it
                // explicit to the user that the account was created.
                try {
                  window.location.href = '/signin?registered=1';
                  return;
                } catch (e) {
                  // Fallback: show message and instruct user to sign in
                  setError('Account created. Please sign in.');
                  setLoading(false);
                  return;
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
          }} className="space-y-6">
            
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400"
                  style={{ background: 'var(--card-bg)', color: 'var(--brand-900)', caretColor: 'var(--brand-900)' }}
                  placeholder="John Doe"
                />
              </div>
            </div>

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
                  autoComplete="new-password"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400"
                  style={{ background: 'var(--card-bg)', color: 'var(--brand-900)', caretColor: 'var(--brand-900)' }}
                  placeholder="••••••••"
                />
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <CheckCircle className="w-3 h-3" />
                  <span>At least 8 characters</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <CheckCircle className="w-3 h-3" />
                  <span>One uppercase letter and one number</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Create Account Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create account
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
              <span className="px-4 bg-white text-gray-500">Already have an account?</span>
            </div>
          </div>

          {/* Sign In Link */}
          <Link
            href="/signin"
            className="block w-full text-center py-3 px-4 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all"
          >
            Sign in instead
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