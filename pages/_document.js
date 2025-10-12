import React from 'react'
import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          {/* External stylesheet moved to Document per Next.js recommendations */}
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />
          {/* Inline script to set initial theme before React loads (prevents FOUC) */}
          <script dangerouslySetInnerHTML={{ __html: `
            (function(){
              try {
                // If this is the public landing page we should not apply a saved
                // per-user theme (because we don't know which user is browsing).
                // Instead, follow only the system preference for landing to avoid
                // showing another user's saved dark mode before sign-in.
                var path = (typeof location !== 'undefined' && location.pathname) ? location.pathname : '/';
                var isLanding = path === '/' || path === '/landing' || path.indexOf('/landing') === 0;

                var raw = localStorage.getItem('up:settings');
                var parsed = raw ? JSON.parse(raw || '{}') : {};
                var theme = parsed.theme || 'system';

                if (isLanding) {
                  // Landing: force light theme for anonymous visitors. Do not apply
                  // any saved or system dark preference here so guests see the
                  // marketing site in the consistent light style.
                  try { document.documentElement.classList.remove('dark'); } catch(e){}
                  return;
                }

                // Non-landing pages: respect saved user theme as before
                if (theme === 'dark') document.documentElement.classList.add('dark');
                if (theme === 'system') {
                  try { if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark'); } catch(e){}
                }
              } catch(e){}
            })();
          ` }} />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
