import React from 'react';

export default function ErrorPage({ statusCode }) {
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 40 }}>
      <h1 style={{ fontSize: 28 }}>Something went wrong</h1>
      <p style={{ color: '#334155' }}>An internal error occurred while rendering the page. This often happens when a server-side dependency (like the database) is not configured in the deployment environment.</p>
      <p style={{ color: '#475569' }}>Help us debug by checking one of these:</p>
      <ul style={{ color: '#475569' }}>
        <li>Visit <code>/api/health</code> — should return a JSON with status 'ok'.</li>
        <li>Check your Vercel deployment logs (Build & Runtime) for stack traces and errors.</li>
        <li>Ensure environment variables such as <code>DATABASE_URL</code> and <code>NEXTAUTH_SECRET</code> are set in the Vercel project settings.</li>
      </ul>
      <p style={{ color: '#64748b' }}>If you'd like, I can guide you through retrieving the Vercel logs or add a small debug endpoint that reports environment variable presence (non-secret values only).</p>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 500;
  return { statusCode };
};
