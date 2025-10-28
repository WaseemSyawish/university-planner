// pages/_app.js
import Head from 'next/head'
import '../src/App.css'
import '../src/index.css'
import '../src/styles/calendar-theme.css'
import Layout from '../src/components/Layout'
import * as NextUI from '@nextui-org/react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { NextUIProvider as NextUISystemProvider } from '@nextui-org/system'
import React, { useEffect, useState } from 'react'
import ModalProvider from '@/providers/modal-context'

function NavEnhancer() {
  useEffect(() => {
    function onDocClick(e) {
      const a = e.target.closest && e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      // Smooth scroll for same-page anchors
      if (href.startsWith('#')) {
        const id = href.slice(1);
        const el = document.getElementById(id);
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // close mobile menu if open
        const toggle = document.getElementById('nav-toggle');
        if (toggle) toggle.checked = false;
        return;
      }
      // Close mobile menu when a nav link is clicked (non-anchor)
      if (a.closest && a.closest('.nav-right')) {
        const toggle = document.getElementById('nav-toggle');
        if (toggle) toggle.checked = false;
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        const toggle = document.getElementById('nav-toggle');
        if (toggle) toggle.checked = false;
      }
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  return null;
}

export default function App({ Component, pageProps }) {
  // Track and apply theme for global CSS vars and NextUI provider
  const [activeTheme, setActiveTheme] = useState('light');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyTheme = (theme) => {
      const root = document.documentElement;
      root.classList.remove('dark');
      if (theme === 'dark') {
        root.classList.add('dark');
        setActiveTheme('dark');
      } else if (theme === 'system') {
        try {
          const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark) {
            root.classList.add('dark');
            setActiveTheme('dark');
          } else setActiveTheme('light');
        } catch (e) {
          setActiveTheme('light');
        }
      } else {
        setActiveTheme('light');
      }
    };

    const loadAndApply = () => {
      try {
        const raw = localStorage.getItem('up:settings');
        if (!raw) return applyTheme('system');
        const parsed = JSON.parse(raw);
        applyTheme(parsed?.theme || 'system');
      } catch (e) {
        applyTheme('system');
      }
    };

    loadAndApply();

    const onSettings = (e) => {
      const detail = e?.detail || {};
      if (detail.theme) applyTheme(detail.theme);
    };

    window.addEventListener('app:settings:changed', onSettings);

    const mql = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    const onPref = () => {
      try {
        const raw = localStorage.getItem('up:settings');
        const parsed = raw ? JSON.parse(raw) : {};
        if (!parsed || parsed.theme === 'system') {
          applyTheme('system');
        }
      } catch (e) {
        // ignore
      }
    };
    if (mql) {
      if (mql.addEventListener) mql.addEventListener('change', onPref);
      else mql.addListener(onPref);
    }

    return () => {
      window.removeEventListener('app:settings:changed', onSettings);
      if (mql) {
        if (mql.removeEventListener) mql.removeEventListener('change', onPref);
        else mql.removeListener(onPref);
      }
    };
  }, []);

  const content = (
    <>
      {/* stylesheet moved to pages/_document.js */}
      <Layout>
        <NavEnhancer />
        <Component {...pageProps} />
      </Layout>
    </>
  );

  // We'll use next-themes to toggle the `class` on <html> (so our CSS
  // variables in src/index.css take effect). Wrap the app in NextThemesProvider
  // then use the system NextUI provider for consistent portals/navigation.
  // Note: NextUI theming can be handled either via its `createTheme` helper
  // or via CSS variables; here we prefer CSS variables already defined in
  // src/index.css and rely on next-themes to toggle the html.dark class.
  return (
    <NextThemesProvider attribute="class" defaultTheme="system">
      <NextUISystemProvider navigate={undefined}>
        <ModalProvider>
          {content}
        </ModalProvider>
      </NextUISystemProvider>
    </NextThemesProvider>
  );
}