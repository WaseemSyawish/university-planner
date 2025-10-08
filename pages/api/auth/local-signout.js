import { serialize } from 'cookie';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    // Clear the demo user cookies set by local-signin
    const clearUserId = serialize('userId', '', { path: '/', httpOnly: true, maxAge: 0, sameSite: 'lax' });
    const clearDebug = serialize('debug_userId', '', { path: '/', maxAge: 0, sameSite: 'lax' });
    res.setHeader('Set-Cookie', [clearUserId, clearDebug]);
    // also return OK so callers can continue to next-auth signOut
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('local-signout error', err);
    res.status(500).json({ ok: false });
  }
}
