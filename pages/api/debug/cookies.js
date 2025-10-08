export default function handler(req, res) {
  // Only enable in dev
  if (process.env.NODE_ENV === 'production') return res.status(404).end();
  try {
    const cookies = req.cookies || {};
    const raw = req.headers.cookie || '';
    res.status(200).json({ ok: true, cookies, raw });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
