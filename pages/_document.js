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
                var raw = localStorage.getItem('up:settings');
                if (!raw) return;
                var parsed = JSON.parse(raw || '{}');
                var theme = parsed.theme || 'system';
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
