const { Pool } = require('pg');

export default async function handler(req, res) {
  const url = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!url) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const pool = new Pool({ connectionString: url });
  try {
    const q = `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' ORDER BY ordinal_position`; 
    const r = await pool.query(q);
    await pool.end();
    return res.status(200).json({ columns: r.rows });
  } catch (e) {
    try { await pool.end(); } catch (er) {}
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
