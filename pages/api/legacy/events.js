// pages/api/legacy/events.js
const prisma = require('../../../lib/prisma');
const fallback = require('../../../lib/eventsFallback');
const { MIN_SCHEDULE_OFFSET_MS, MIN_SCHEDULE_OFFSET_LABEL } = require('../../../lib/config');

console.log('DEBUG: process.env.DATABASE_URL =', process.env.DATABASE_URL);

export default async function handler(req, res) {
  const { method } = req;
  
  console.log('Events API (legacy) called with method:', method);
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  
  try {
    switch (method) {
      case 'GET': {
        // Optionally filter by userId and date range
        const { userId, date } = req.query;
        const { showArchived } = req.query;

        if (showArchived && (showArchived === 'true' || showArchived === true)) {
          // Return archived events from the ArchivedEvent table
          const where = {};
          if (userId) where.user_id = userId;
          if (date) where.date = new Date(date);

          const events = await prisma.archivedEvent.findMany({
            where,
            include: { courses: true },
            orderBy: { date: 'asc' }
          });

          return res.status(200).json({ success: true, events });
        }

        // Default: return active events
        const where = {};
        if (userId) where.user_id = userId;
        if (date) where.date = new Date(date);
        where.archived = false;

        const events = await prisma.event.findMany({
          where,
          include: { courses: true },
          orderBy: { date: 'asc' }
        });

        return res.status(200).json({ success: true, events });
      }
      
      case 'POST': {
        // Create new event
        const { title, type, courseId, date: evDate, time, description, userId, archived } = req.body;
        
        if (!title || !userId || !evDate) {
          return res.status(400).json({ 
            success: false, 
            error: 'title, date and userId are required' 
          });
        }

        // Server-side: only enforce minimum scheduling offset when a time is provided
        try {
          if (time) {
            const now = new Date();
            const minAllowed = new Date(now.getTime() + MIN_SCHEDULE_OFFSET_MS);
            // Combine date and time into a single Date for comparison
            const [hh, mm] = String(time).split(':').map(Number);
            const [y, mo, d] = String(evDate).split('-').map(Number);
            const incoming = new Date(y, (mo || 1) - 1, d || 1, hh || 0, mm || 0);
            if (isNaN(incoming.getTime())) {
              return res.status(400).json({ code: 'INVALID_DATE', message: 'Invalid date or time format' });
            }
            if (incoming < minAllowed) {
              return res.status(400).json({ code: 'SCHED_MIN_OFFSET', message: `Please schedule events at least ${MIN_SCHEDULE_OFFSET_LABEL} from now.` });
            }
          }
        } catch (err) {
          return res.status(400).json({ code: 'INVALID_DATE', message: 'Invalid date or time format' });
        }
        
        // Attempt to create using Prisma, but fall back to file storage on any Prisma/runtime error
        try {
          // Build a local Date object from YYYY-MM-DD + HH:MM components to avoid UTC/ISO parsing shifts
          const buildLocalDate = (dateStr, timeStr) => {
            try {
              const [y, mo, d] = String(dateStr).split('-').map(Number);
              if (timeStr) {
                const [hh = 0, mm = 0] = String(timeStr).split(':').map(Number);
                return new Date(y, (mo || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
              }
              return new Date(y, (mo || 1) - 1, d || 1);
            } catch (e) {
              return new Date(dateStr);
            }
          };

          const created = await prisma.event.create({
            data: {
              title: title.trim(),
              type: type || 'assignment',
              course_id: courseId || null,
              // Store date using explicit local-time construction when time is provided
              date: time ? buildLocalDate(evDate, time) : buildLocalDate(evDate, null),
              time: time || null,
              description: description || null,
              completed: false,
              archived: !!archived,
              user_id: userId
            },
            include: {
              courses: true, // Note: using 'courses' to match your schema relation name
            }
          });
          return res.status(201).json({ success: true, event: created });
        } catch (errCreate) {
          console.error('Prisma create failed, attempting fallback. Error:', errCreate && errCreate.message ? errCreate.message : errCreate);
          // Treat any Prisma-related failure as a signal to use fallback storage
          try {
            const payload = {
              title: title.trim(),
              type: type || 'assignment',
              course_id: courseId || null,
              date: evDate,
              time: time || null,
              description: description || null,
              completed: false,
              user_id: userId
            };
            const created = fallback.create(payload);
            return res.status(201).json({ success: true, event: created, fallback: true });
          } catch (fbErr) {
            console.error('Fallback create also failed:', fbErr);
            // fall through to outer catch below
            throw fbErr;
          }
        }
      }
      
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ 
          success: false, 
          error: `Method ${method} Not Allowed` 
        });
    }
  } catch (error) {
    console.error('Events API (legacy) error:', error);
    
  // If Prisma can't reach DB, fallback to file-based storage
  if (error.code === 'P1001' || error.message?.includes("Can't reach database")) {
      console.log('Using fallback storage for events');
      
      if (method === 'GET') {
        const events = fallback.list();
        return res.status(200).json({ success: true, events });
      }
      
      if (method === 'POST') {
        const payload = req.body;
        const created = fallback.create({
          title: payload.title,
          type: payload.type,
          course_id: payload.courseId || null,
          date: payload.date,
          time: payload.time,
          description: payload.description,
          completed: false,
          user_id: payload.userId
        });
        return res.status(201).json({ success: true, event: created });
      }
    }
    
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error', details: error.message });
  }
}
