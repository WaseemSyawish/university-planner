// Lightweight health endpoint to verify deployment and presence of env vars.
// Returns only boolean flags for env var presence to avoid leaking secrets.
export default function handler(req, res) {
  try {
    res.status(200).json({
      status: 'ok',
      env: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        hasDebugEventsSecret: !!process.env.DEBUG_EVENTS_SECRET,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Health endpoint error', err);
    res.status(500).json({ status: 'error', error: String(err) });
  }
}
export default function handler(req, res) {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
}
