import bcrypt from 'bcryptjs';
const prisma = require('../../../lib/prisma');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { name, email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'A user with that email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, name: name || null, password_hash: hash } });

    return res.status(201).json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    console.error('Register error', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
