const prisma = require('../../../lib/prisma');

async function resolveUserId(req) {
  try {
    const { getToken } = await import('next-auth/jwt');
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
    const tokenUserId = token && token.userId ? token.userId : null;
    if (!tokenUserId) return null;
    return tokenUserId;
  } catch (err) {
    console.error('resolveUserId error', err);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET,POST,PUT,DELETE,OPTIONS');
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    try {
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
      const where = { user_id: userId };
      let courses = await prisma.course.findMany({ where, orderBy: { name: 'asc' } });
      // normalize color tokens to an inline hex fallback for client convenience
      const tailwindToHex = {
        'indigo-500': '#6366F1',
        'blue-500': '#3B82F6',
        'green-500': '#10B981',
        'red-500': '#EF4444',
        'yellow-500': '#F59E0B',
        'gray-500': '#6B7280',
        'purple-500': '#8B5CF6',
        'pink-500': '#EC4899',
        'teal-500': '#14B8A6'
      };
      const normalize = (c) => {
        try {
          const v = c && c.color ? String(c.color).trim() : '';
          if (!v) return { ...c, colorHex: null };
          if (v.startsWith('#') || v.startsWith('rgb')) return { ...c, colorHex: v };
          if (v.startsWith('bg-')) {
            const key = v.replace(/^bg-/, '');
            return { ...c, colorHex: tailwindToHex[key] || null };
          }
          // shorthand token like 'indigo-500'
          if (/^[a-z]+-\d{3,4}$/i.test(v)) {
            return { ...c, colorHex: tailwindToHex[v] || null };
          }
          // otherwise treat as color name
          return { ...c, colorHex: v };
        } catch (e) { return { ...c, colorHex: null }; }
      };
      courses = courses.map(normalize);
      return res.status(200).json({ success: true, courses });
    } catch (err) {
      console.error('GET /api/courses error', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch courses' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, professor, instructor, color, credits, semester, code, description } = req.body || {};
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

      const created = await prisma.course.create({ data: {
        name,
        code: code || null,
        instructor: instructor ?? professor ?? null,
        color: color || null,
        credits: Number.isFinite(Number(credits)) ? Number(credits) : 3,
        semester: semester || null,
        description: description || null,
        user_id: userId
      }});
      // attach colorHex for convenience
      const tailwindToHex = {
        'indigo-500': '#6366F1',
        'blue-500': '#3B82F6',
        'green-500': '#10B981',
        'red-500': '#EF4444',
        'yellow-500': '#F59E0B',
        'gray-500': '#6B7280',
        'purple-500': '#8B5CF6',
        'pink-500': '#EC4899',
        'teal-500': '#14B8A6'
      };
      let colorHex = null;
      try {
        const v = created && created.color ? String(created.color).trim() : '';
        if (v) {
          if (v.startsWith('#') || v.startsWith('rgb')) colorHex = v;
          else if (v.startsWith('bg-')) colorHex = tailwindToHex[v.replace(/^bg-/, '')] || null;
          else if (/^[a-z]+-\d{3,4}$/i.test(v)) colorHex = tailwindToHex[v] || null;
          else colorHex = v;
        }
      } catch (e) {
        colorHex = null;
      }
      return res.status(201).json({ success: true, course: { ...created, colorHex } });
    } catch (err) {
      console.error('POST /api/courses error', err);
      return res.status(500).json({ success: false, error: 'Failed to create course' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, name, professor, color, credits, semester, instructor, description } = req.body;
      if (!id) return res.status(400).json({ success: false, error: 'Missing course id' });
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

      // ensure course belongs to user
      const existing = await prisma.course.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ success: false, error: 'Course not found' });
      if (existing.user_id !== userId) {
        return res.status(403).json({ success: false, error: 'Not authorized to edit this course' });
      }
      const updated = await prisma.course.update({ where: { id }, data: {
        name: name ?? existing.name,
        instructor: instructor ?? (professor ?? existing.instructor),
        color: color ?? existing.color,
        credits: credits ?? existing.credits,
        semester: semester ?? existing.semester,
        description: description ?? existing.description
      }});
      // attach normalized colorHex
      const tailwindToHex = {
        'indigo-500': '#6366F1',
        'blue-500': '#3B82F6',
        'green-500': '#10B981',
        'red-500': '#EF4444',
        'yellow-500': '#F59E0B',
        'gray-500': '#6B7280',
        'purple-500': '#8B5CF6',
        'pink-500': '#EC4899',
        'teal-500': '#14B8A6'
      };
      let colorHex = null;
      try {
        const v = updated && updated.color ? String(updated.color).trim() : '';
        if (v) {
          if (v.startsWith('#') || v.startsWith('rgb')) colorHex = v;
          else if (v.startsWith('bg-')) colorHex = tailwindToHex[v.replace(/^bg-/, '')] || null;
          else if (/^[a-z]+-\d{3,4}$/i.test(v)) colorHex = tailwindToHex[v] || null;
          else colorHex = v;
        }
      } catch (e) { colorHex = null; }
      return res.status(200).json({ success: true, course: { ...updated, colorHex } });
    } catch (err) {
      console.error('PUT /api/courses error', err);
      return res.status(500).json({ success: false, error: 'Failed to update course' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ success: false, error: 'Missing course id' });
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

      const existing = await prisma.course.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ success: false, error: 'Course not found' });
      if (existing.user_id !== userId) {
        return res.status(403).json({ success: false, error: 'Not authorized to delete this course' });
      }
      await prisma.course.delete({ where: { id } });
      return res.status(200).json({ success: true, message: 'Course deleted' });
    } catch (err) {
      console.error('DELETE /api/courses error', err);
      return res.status(500).json({ success: false, error: 'Failed to delete course' });
    }
  }

  res.setHeader('Allow', 'GET,POST,PUT,DELETE,OPTIONS');
  res.status(405).end();
}
