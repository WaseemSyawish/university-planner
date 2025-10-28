import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { GraduationCap, Mail, Lock, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function SignInPolished() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit() {
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      console.log('Sign in successful');
      setLoading(false);
      // Redirect to overview/dashboard after successful sign-in
      try {
        router.push('/overview');
      } catch (e) {
        // fallback: no-op
      }
    }, 1500);
  }

  return (
    <>
      <title>Sign in — University Planner</title>
      <div className="min-h-screen flex items-center justify-center p-4" style={{
        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)'
      }}>
        <div className="w-full max-w-md">
          {/* Logo and Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg" style={{
              background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)'
            }}>
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#0f172a' }}>
              Welcome back
            </h1>
            <p style={{ color: '#64748b' }}>
              Sign in to continue to University Planner
            </p>
          </div>

          {/* Sign In Card */}
          <div className="rounded-xl p-8 shadow-xl" style={{
            background: '#ffffff',
            border: '1px solid rgba(15, 23, 42, 0.06)',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)'
          }}>
            <div className="space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: '#334155' }}>
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ zIndex: 10 }}>
                    <Mail className="h-5 w-5" style={{ color: '#94a3b8' }} />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="you@university.edu"
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.75rem 1rem 0.75rem 2.5rem',
                      borderRadius: '0.5rem',
                      backgroundColor: '#f8fafc',
                      color: '#0f172a',
                      border: '1px solid #e2e8f0',
                      outline: 'none',
                      fontSize: '1rem',
                      lineHeight: '1.5',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: '#334155' }}>
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ zIndex: 10 }}>
                    <Lock className="h-5 w-5" style={{ color: '#94a3b8' }} />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="••••••••"
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.75rem 3rem 0.75rem 2.5rem',
                      borderRadius: '0.5rem',
                      backgroundColor: '#f8fafc',
                      color: '#0f172a',
                      border: '1px solid #e2e8f0',
                      outline: 'none',
                      fontSize: '1rem',
                      lineHeight: '1.5',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    style={{ color: '#64748b', zIndex: 10 }}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-lg p-4 flex items-start gap-3" style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)'
                }}>
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                  <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
                </div>
              )}

              {/* Sign In Button */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-3 px-4 rounded-lg font-medium focus:outline-none transition-all flex items-center justify-center gap-2 shadow-lg"
                style={{
                  background: loading ? '#9333ea' : 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 10px 30px rgba(168, 85, 247, 0.3)'
                }}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" 
                         style={{ animation: 'spin 0.8s linear infinite' }} />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full" style={{ borderTop: '1px solid #e2e8f0' }} />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4" style={{ background: '#ffffff', color: '#64748b' }}>
                  Don't have an account?
                </span>
              </div>
            </div>

            {/* Sign Up Link */}
            <button
              className="block w-full text-center py-3 px-4 rounded-lg font-medium transition-all"
              style={{
                border: '1px solid #cbd5e1',
                color: '#334155',
                backgroundColor: 'transparent',
                cursor: 'pointer'
              }}
              onClick={() => router.push('/signup')}
            >
              Create an account
            </button>
          </div>

          {/* Back to Landing */}
          <div className="mt-6 text-center">
            <a href="/landing" className="text-sm transition-colors" style={{ color: '#64748b' }}>
              ← Back to home
            </a>
          </div>
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          
          * {
            box-sizing: border-box;
          }
          
          /* Nuclear option - force override everything */
          input[type="text"],
          input[type="email"],
          input[type="password"],
          input[name="email"],
          input[name="password"],
          input#email,
          input#password {
            background-color: #f8fafc !important;
            background: #f8fafc !important;
            background-image: none !important;
            color: #0f172a !important;
            border: 1px solid #e2e8f0 !important;
            -webkit-text-fill-color: #0f172a !important;
            color-scheme: light !important;
          }
          
          input[type="text"]:hover,
          input[type="email"]:hover,
          input[type="password"]:hover,
          input[type="text"]:focus,
          input[type="email"]:focus,
          input[type="password"]:focus,
          input[type="text"]:active,
          input[type="email"]:active,
          input[type="password"]:active {
            background-color: #f8fafc !important;
            background: #f8fafc !important;
            background-image: none !important;
            color: #0f172a !important;
            border: 1px solid #e2e8f0 !important;
            outline: none !important;
            -webkit-text-fill-color: #0f172a !important;
            color-scheme: light !important;
          }
          
          input[type="text"]::placeholder,
          input[type="email"]::placeholder,
          input[type="password"]::placeholder {
            color: #94a3b8 !important;
            opacity: 1 !important;
          }
          
          /* Autofill overrides */
          input:-webkit-autofill,
          input:-webkit-autofill:hover,
          input:-webkit-autofill:focus,
          input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 1000px #f8fafc inset !important;
            box-shadow: 0 0 0 1000px #f8fafc inset !important;
            -webkit-text-fill-color: #0f172a !important;
            background-color: #f8fafc !important;
            color: #0f172a !important;
            border: 1px solid #e2e8f0 !important;
          }
        `}</style>
      </div>
    </>
  );
}