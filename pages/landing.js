import Head from 'next/head';
import Link from 'next/link';

export default function Welcome() {
  return (
    <div className="landing-root">
      <Head>
        <title>University Planner</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </Head>
      <a href="#landing-hero" className="skip-link">Skip to content</a>
      <header className="landing-nav" role="banner">
        <div className="container nav-row">
          <div className="nav-left">
            <Link href="/landing" className="brand" aria-label="University Planner home">
              <span className="brand-logo" aria-hidden="true">
                <svg width="34" height="34" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="8" width="44" height="28" rx="6" fill="#4f46e5" />
                  <path d="M12 18h18v2H12z" fill="white" opacity="0.95" />
                  <path d="M12 24h12v2H12z" fill="white" opacity="0.9" />
                </svg>
              </span>
              <span className="brand-text text-slate-900 dark:text-slate-50" style={{ color: '#0b1220' }}>University Planner</span>
            </Link>
          </div>

          <nav className="nav-right" role="navigation" aria-label="Main navigation">
            <input type="checkbox" id="nav-toggle" className="nav-toggle" aria-hidden="true" />
            <label htmlFor="nav-toggle" className="nav-hamburger" aria-hidden="false" aria-label="Toggle menu">
              <svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect y="1" width="22" height="2" rx="1" fill="currentColor" />
                <rect y="8" width="22" height="2" rx="1" fill="currentColor" />
                <rect y="15" width="22" height="2" rx="1" fill="currentColor" />
              </svg>
            </label>
            <ul className="nav-list" role="menubar">
              <li role="none"><Link role="menuitem" href="#features" className="nav-link text-slate-900 dark:text-slate-100" style={{ color: '#0b1220' }}>Features</Link></li>
              <li role="none"><Link role="menuitem" href="#testimonials" className="nav-link text-slate-900 dark:text-slate-100" style={{ color: '#0b1220' }}>Customers</Link></li>
              <li role="none"><Link role="menuitem" href="/docs" className="nav-link muted text-slate-700 dark:text-slate-300" style={{ color: '#334155' }}>Docs</Link></li>
            </ul>
            <div className="nav-ctas">
              <Link href="/signin" className="nav-link nav-signin">Sign in</Link>
              <Link href="/signup" className="btn btn-primary nav-cta">Get started</Link>
            </div>
          </nav>
        </div>
      </header>

      <main id="landing-hero" className="landing-hero" role="main">
        <div className="container hero-grid">
          <div className="hero-left">
            <h1 className="hero-title">Plan smarter. Achieve more.</h1>
            <p className="hero-sub">University Planner helps students and staff organize courses, assignments and timetables with a clean, secure, and scalable workflow.</p>
            <div className="hero-cta">
              <Link href="/signup" className="btn btn-primary">Create account</Link>
              <Link href="/signin" className="btn btn-ghost">Sign in</Link>
            </div>
            <ul className="hero-bullets">
              <li>Intuitive calendar & agenda</li>
              <li>Course & assessment tracking</li>
              <li>Secure accounts with enterprise-ready sessions</li>
            </ul>
          </div>
          <div className="hero-right">
            <div className="hero-illustration card" aria-hidden="true">
              {/* Inline illustrative SVG: stylized dashboard + calendar */}
              <svg viewBox="0 0 520 360" className="illustration-svg" role="img" focusable="false">
                <defs>
                  <linearGradient id="lg" x1="0" x2="1">
                    <stop offset="0%" stopColor="#eef2ff" />
                    <stop offset="100%" stopColor="#f8fafc" />
                  </linearGradient>
                  <linearGradient id="lg2" x1="0" x2="1">
                    <stop offset="0%" stopColor="#fff" />
                    <stop offset="100%" stopColor="#f6f9ff" />
                  </linearGradient>
                </defs>
                <rect x="16" y="24" width="488" height="312" rx="14" fill="url(#lg2)" stroke="rgba(2,6,23,0.04)" />
                <rect x="44" y="60" width="420" height="32" rx="6" fill="#fff" />
                <rect x="44" y="106" width="160" height="16" rx="4" fill="#f3f4ff" />
                <rect x="44" y="132" width="420" height="10" rx="4" fill="#f8fafc" />
                <rect x="44" y="152" width="420" height="10" rx="4" fill="#f8fafc" />
                <rect x="44" y="176" width="260" height="10" rx="4" fill="#eef2ff" />
                <circle cx="420" cy="92" r="28" fill="#6366f1" opacity="0.95" />
                <circle cx="420" cy="92" r="16" fill="#fff" />
                <g transform="translate(52,220)">
                  <rect width="120" height="64" rx="8" fill="#fff" stroke="rgba(2,6,23,0.03)" />
                  <rect x="8" y="10" width="36" height="10" rx="3" fill="#eef2ff" />
                  <rect x="8" y="28" width="80" height="10" rx="3" fill="#f8fafc" />
                </g>
                <g transform="translate(200,220)">
                  <rect width="120" height="64" rx="8" fill="#fff" stroke="rgba(2,6,23,0.03)" />
                  <rect x="8" y="10" width="80" height="10" rx="3" fill="#eef2ff" />
                  <rect x="8" y="28" width="52" height="10" rx="3" fill="#f8fafc" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </main>

  <section id="features" className="container features">
        <h2 className="section-title">Built for academic workflows</h2>
        <div className="feature-grid">
          <div className="feature card">
            <h3>Unified calendar</h3>
            <p className="muted">See lectures, deadlines and study time in one clear view.</p>
          </div>
          <div className="feature card">
            <h3>Course management</h3>
            <p className="muted">Track modules, tasks and grades across terms.</p>
          </div>
          <div className="feature card">
            <h3>Team-friendly</h3>
            <p className="muted">Share schedules and collaborate with classmates and tutors.</p>
          </div>
        </div>
      </section>

  <section id="testimonials" className="container testimonials" aria-label="Customer testimonials">
        <h2 className="section-title">Trusted by students and tutors</h2>
        <div className="testimonial-grid">
          <div className="testimonial card">
            <p className="muted">“University Planner transformed how I organise my semester — everything in one place, synced and predictable.”</p>
            <div className="testimonial-meta">— Alex M., Student</div>
          </div>
          <div className="testimonial card">
            <p className="muted">“Our department uses it for timetable coordination; it's lightweight and reliable.”</p>
            <div className="testimonial-meta">— Dr. Chen, Lecturer</div>
          </div>
          <div className="testimonial card">
            <p className="muted">“Great UX and fast to set up for new cohorts.”</p>
            <div className="testimonial-meta">— Student Services</div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div>© {new Date().getFullYear()} University Planner — Designed for higher education</div>
          <div className="muted">Privacy • Terms</div>
        </div>
      </footer>
    </div>
  );
}