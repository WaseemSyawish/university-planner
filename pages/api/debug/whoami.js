import { getToken } from 'next-auth/jwt';

export default async function handler(req, res) {
  try {
    const secret = process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret';
    const token = await getToken({ req, secret });
    return res.status(200).json({ ok: true, token });
  } catch (err) {
    console.error('debug/whoami error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
