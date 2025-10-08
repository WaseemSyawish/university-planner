export default async function handler(req, res) {
  try {
    const { getToken } = await import('next-auth/jwt');
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
    const cookies = req.headers.cookie || null;
    return res.status(200).json({ ok: true, token: token || null, cookies });
  } catch (err) {
    console.error('auth/debug error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
