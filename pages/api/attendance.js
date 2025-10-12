// Consolidated attendance API handler below.
// Removed an earlier simplistic file-based handler to avoid duplicate default exports.
import { PrismaClient } from '@prisma/client';

let prisma;
let prismaUsable = true;

function initPrisma() {
  if (prisma) return prisma;
  try {
    prisma = new PrismaClient();
    return prisma;
  } catch (err) {
    console.error('Prisma init error:', err);
    prismaUsable = false;
    return null;
  }
}

function getPrisma() {
  if (!prismaUsable) return null;
  return prisma || initPrisma();
}

let attendanceFallback;
let coursesFallback;

async function getAttendanceFallback() {
  if (attendanceFallback) return attendanceFallback;
  const mod = await import('../../lib/attendanceFallback.js');
  attendanceFallback = mod.default || mod;
  return attendanceFallback;
}

async function getCoursesFallback() {
  if (coursesFallback) return coursesFallback;
  const mod = await import('../../lib/coursesFallback.js');
  coursesFallback = mod.default || mod;
  return coursesFallback;
}

function isPrismaEngineError(err) {
  if (!err) return false;
  const msg = err.message || '';
  return msg.includes('Query Engine') || msg.includes('could not locate the Query Engine') || err.name === 'PrismaClientInitializationError';
}

export default async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return await handleGet(req, res);
      case 'POST':
        return await handlePost(req, res);
      case 'PUT':
        return await handlePut(req, res);
      case 'DELETE':
        return await handleDelete(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ 
          success: false, 
          error: `Method ${method} not allowed` 
        });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    // Intentionally do NOT disconnect the global Prisma client here. Disconnecting
    // per-request causes connection churn and slower responses. The client is
    // managed globally and should be disconnected only on process shutdown.
  }
}

// GET /api/attendance - Fetch attendance sessions for a course
async function handleGet(req, res) {
  const { courseId } = req.query;

  if (!courseId) {
    return res.status(400).json({ 
      success: false,
      error: 'courseId parameter is required' 
    });
  }

  // Resolve user from next-auth token only (required)
  let effectiveUserId = null;
  try {
    const { getToken } = await import('next-auth/jwt');
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
    effectiveUserId = token && token.userId ? token.userId : null;
  } catch (e) {
    console.warn('Failed to resolve token in attendance GET', e);
  }

  if (!effectiveUserId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  try {
    // Verify the course belongs to the user (or resolve fallback)
    const p = getPrisma();
    let course;
    if (!p) {
      const fb = await getCoursesFallback();
      course = fb.find(courseId);
    } else {
      try {
        course = await p.course.findFirst({ where: { id: courseId, user_id: effectiveUserId } });
      } catch (err) {
        if (isPrismaEngineError(err)) {
          console.warn('Prisma engine not available during course find; using fallback');
          const fb = await getCoursesFallback();
          course = fb.find(courseId);
        } else throw err;
      }
    }

    if (!course) {
      return res.status(404).json({ 
        success: false,
        error: 'Course not found or you do not have permission to access it' 
      });
    }

    // Fetch attendance sessions for the course (oldest first)
    const p2 = getPrisma();
    let sessions = [];
    if (!p2) {
      const fb = await getAttendanceFallback();
      sessions = fb.list({ courseId, userId: effectiveUserId });
    } else {
      try {
        sessions = await p2.attendanceSession.findMany({
    where: { course_id: courseId, user_id: effectiveUserId },
          orderBy: { date: 'asc' },
          include: { courses: { select: { name: true, code: true, color: true } } }
        });
      } catch (err) {
        if (isPrismaEngineError(err)) {
          console.warn('Prisma engine not available during attendance findMany; using fallback');
          const fb = await getAttendanceFallback();
          sessions = fb.list({ courseId, userId: effectiveUserId });
        } else throw err;
      }
    }

    const formattedSessions = sessions.map(session => ({
      id: session.id,
      date: (typeof session.date === 'string' ? session.date.split('T')[0] : session.date.toISOString().split('T')[0]),
      status: session.status,
      points: session.points || 0,
      notes: session.notes || '',
      course: {
        name: session.courses ? session.courses.name : course.name,
        code: session.courses ? session.courses.code : course.code,
        color: session.courses ? session.courses.color : course.color
      },
      createdAt: session.created_at,
      updatedAt: session.updated_at
    }));

    return res.status(200).json({ success: true, sessions: formattedSessions, total: formattedSessions.length, course: { id: course.id, name: course.name, code: course.code, color: course.color } });
  } catch (error) {
    console.error('Error fetching attendance sessions:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to fetch attendance sessions',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// POST /api/attendance - Create a new attendance session
async function handlePost(req, res) {
  const { date, status, points, courseId, notes } = req.body;

  // Resolve user id from token (required)
  let effectiveUserId = null;
  try {
    const { getToken } = await import('next-auth/jwt');
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
    effectiveUserId = token && token.userId ? token.userId : null;
  } catch (e) {
    console.warn('Failed to resolve token in attendance POST', e);
  }

  if (!effectiveUserId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  if (!date || !status || !courseId) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing required fields: date, status, courseId' 
    });
  }

  if (!isValidStatus(status)) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid status. Must be one of: PRESENT, ABSENT, LATE, HOLIDAY, EXCUSED' 
    });
  }

  try {
  // Verify the course belongs to the user
  const p = getPrisma();
    let course;
    if (!p) {
      const fb = await getCoursesFallback();
      course = fb.find(courseId);
      if (course) {
        if (!effectiveUserId || course.user_id !== effectiveUserId) effectiveUserId = course.user_id;
      }
    } else {
      try {
        course = await p.course.findFirst({ where: { id: courseId, user_id: effectiveUserId } });
        if (!course) {
          // Do not fallback to other owners — enforce strict ownership
          return res.status(403).json({ success: false, error: 'Not authorized to add attendance for this course' });
        }
      } catch (err) {
        if (isPrismaEngineError(err)) {
          console.warn('Prisma engine not available during course find (POST); using fallback');
          const fb = await getCoursesFallback();
          course = fb.find(courseId);
          if (course) {
            if (!effectiveUserId || course.user_id !== effectiveUserId) effectiveUserId = course.user_id;
          }
        } else throw err;
      }
    }

    if (!course) {
      return res.status(404).json({ success: false, error: 'Course not found or you do not have permission to access it' });
    }

    const sessionDate = new Date(date);
    
    if (isNaN(sessionDate.getTime())) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid date format' 
      });
    }

    // Check for duplicate session on the same date
    // Check for duplicate session on the same date
    const p2 = getPrisma();
    let existingSession;
    if (!p2) {
      const fb = await getAttendanceFallback();
      existingSession = fb.list({ courseId, userId: effectiveUserId }).find(s => s.date.split('T')[0] === sessionDate.toISOString().split('T')[0]);
    } else {
      try {
        existingSession = await p2.attendanceSession.findFirst({ where: { date: sessionDate, course_id: courseId, user_id: effectiveUserId } });
      } catch (err) {
        if (isPrismaEngineError(err)) {
          console.warn('Prisma engine not available during duplicate check; using fallback');
          const fb = await getAttendanceFallback();
          existingSession = fb.list({ courseId, userId: effectiveUserId }).find(s => s.date.split('T')[0] === sessionDate.toISOString().split('T')[0]);
        } else throw err;
      }
    }

    if (existingSession) return res.status(400).json({ success: false, error: 'An attendance session already exists for this date and course' });

    // Calculate points based on status if not provided
    const sessionPoints = points !== undefined ? parseInt(points) || 0 : getDefaultPoints(status);

    // Create the attendance session
    // Create the attendance session (Prisma or fallback)
    const p3 = getPrisma();
    let newSession;
    if (!p3) {
      const fb = await getAttendanceFallback();
      newSession = fb.create({ date: sessionDate.toISOString(), status, points: sessionPoints, notes, userId: effectiveUserId, courseId });
    } else {
      try {
        newSession = await p3.attendanceSession.create({ data: { date: sessionDate, status: status.toUpperCase(), points: sessionPoints, notes: notes?.trim() || null, user_id: effectiveUserId, course_id: courseId }, include: { courses: { select: { name: true, code: true, color: true } } } });
      } catch (err) {
        if (isPrismaEngineError(err)) {
          console.warn('Prisma engine not available during attendance.create; using fallback');
          const fb = await getAttendanceFallback();
          newSession = fb.create({ date: sessionDate.toISOString(), status, points: sessionPoints, notes, userId: effectiveUserId, courseId });
        } else throw err;
      }
    }

    const formattedSession = {
      id: newSession.id,
      date: (typeof newSession.date === 'string' ? newSession.date.split('T')[0] : newSession.date.toISOString().split('T')[0]),
      status: newSession.status,
      points: newSession.points || 0,
      notes: newSession.notes || '',
      course: { name: newSession.courses ? newSession.courses.name : course.name, code: newSession.courses ? newSession.courses.code : course.code, color: newSession.courses ? newSession.courses.color : course.color },
      createdAt: newSession.created_at,
      updatedAt: newSession.updated_at
    };

    return res.status(201).json({
      success: true,
      session: formattedSession,
      message: 'Attendance session created successfully'
    });
  } catch (error) {
    console.error('Error creating attendance session:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        success: false,
        error: 'An attendance session already exists for this date and course' 
      });
    }
    
    return res.status(500).json({ 
      success: false,
      error: 'Failed to create attendance session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// PUT /api/attendance - Update an existing attendance session
// Identity is resolved from next-auth token only; client must not supply userId
async function handlePut(req, res) {
  const { id, date, status, points, notes } = req.body;

  if (!id) {
    return res.status(400).json({ 
      success: false,
      error: 'Session ID is required' 
    });
  }

  try {
    // Resolve auth token to identify user and verify the session belongs to them
    let tokenUserId = null;
    try {
      const { getToken } = await import('next-auth/jwt');
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
      tokenUserId = token && token.userId ? token.userId : null;
    } catch (e) {
      console.warn('Failed to resolve token in attendance PUT', e);
    }

    if (!tokenUserId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const p4 = getPrisma();
    let existingSession;
    if (!p4) {
      const fb = await getAttendanceFallback();
      existingSession = fb.find(id);
      if (existingSession && existingSession.user_id !== tokenUserId) existingSession = null;
      if (existingSession && !existingSession.courses) existingSession.courses = { name: existingSession.course || null };
    } else {
      try {
        existingSession = await p4.attendanceSession.findFirst({ where: { id: id, user_id: tokenUserId }, include: { courses: true } });
      } catch (err) {
        if (isPrismaEngineError(err)) {
          console.warn('Prisma engine not available during session find (PUT); using fallback');
          const fb = await getAttendanceFallback();
          existingSession = fb.find(id);
          if (existingSession && existingSession.user_id !== tokenUserId) existingSession = null;
          if (existingSession && !existingSession.courses) existingSession.courses = { name: existingSession.course || null };
        } else throw err;
      }
    }

    // Validate status if provided
    if (status && !isValidStatus(status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid status. Must be one of: PRESENT, ABSENT, LATE, HOLIDAY, EXCUSED' 
      });
    }

    // Prepare update data
    const updateData = {};
    
    if (date) {
      const sessionDate = new Date(date);
      if (isNaN(sessionDate.getTime())) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid date format' 
        });
      }
      
        // Check for duplicate date (excluding current session)
        const p5 = getPrisma();
        let duplicateSession;
        if (!p5) {
          const fb = await getAttendanceFallback();
          duplicateSession = fb.list({ courseId: existingSession.course_id, userId: tokenUserId }).find(s => s.date.split('T')[0] === sessionDate.toISOString().split('T')[0] && s.id !== id);
        } else {
          try {
            duplicateSession = await p5.attendanceSession.findFirst({ where: { date: sessionDate, course_id: existingSession.course_id, user_id: tokenUserId, id: { not: id } } });
          } catch (err) {
            if (isPrismaEngineError(err)) {
              console.warn('Prisma engine not available during duplicate check (PUT); using fallback');
              const fb = await getAttendanceFallback();
              duplicateSession = fb.list({ courseId: existingSession.course_id, userId: tokenUserId }).find(s => s.date.split('T')[0] === sessionDate.toISOString().split('T')[0] && s.id !== id);
            } else throw err;
          }
        }

        if (duplicateSession) return res.status(400).json({ success: false, error: 'Another attendance session already exists for this date and course' });
      
      updateData.date = sessionDate;
    }
    
    if (status) {
      updateData.status = status.toUpperCase();
      // Auto-update points based on new status if points not explicitly provided
      if (points === undefined) {
        updateData.points = getDefaultPoints(status);
      }
    }
    
    if (points !== undefined) {
      updateData.points = parseInt(points) || 0;
    }
    
    if (notes !== undefined) {
      updateData.notes = notes?.trim() || null;
    }

    updateData.updated_at = new Date();

    // Update the session (Prisma or fallback)
    const p6 = getPrisma();
    let updatedSession;
    if (!p6) {
      const fb = await getAttendanceFallback();
      updatedSession = fb.update(id, updateData);
      if (updatedSession && !updatedSession.courses) updatedSession.courses = { name: updatedSession.course || null };
    } else {
      try {
        updatedSession = await p6.attendanceSession.update({ where: { id }, data: updateData, include: { courses: { select: { name: true, code: true, color: true } } } });
      } catch (err) {
        if (isPrismaEngineError(err)) {
          console.warn('Prisma engine not available during attendance.update; using fallback');
          const fb = await getAttendanceFallback();
          updatedSession = fb.update(id, updateData);
          if (updatedSession && !updatedSession.courses) updatedSession.courses = { name: updatedSession.course || null };
        } else throw err;
      }
    }

    const formattedSession = {
      id: updatedSession.id,
      date: updatedSession.date.toISOString().split('T')[0],
      status: updatedSession.status,
      points: updatedSession.points || 0,
      notes: updatedSession.notes || '',
      course: {
        name: updatedSession.courses.name,
        code: updatedSession.courses.code,
        color: updatedSession.courses.color
      },
      createdAt: updatedSession.created_at,
      updatedAt: updatedSession.updated_at
    };

    return res.status(200).json({
      success: true,
      session: formattedSession,
      message: 'Attendance session updated successfully'
    });
  } catch (error) {
    console.error('Error updating attendance session:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        success: false,
        error: 'Another attendance session already exists for this date and course' 
      });
    }
    
    return res.status(500).json({ 
      success: false,
      error: 'Failed to update attendance session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// DELETE /api/attendance - Delete an attendance session
async function handleDelete(req, res) {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ 
      success: false,
      error: 'Session ID is required' 
    });
  }

  // Resolve user id from token (required)
  let tokenUserId = null;
  try {
    const { getToken } = await import('next-auth/jwt');
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
    tokenUserId = token && token.userId ? token.userId : null;
  } catch (e) {
    console.warn('Failed to resolve token in attendance DELETE', e);
  }

  if (!tokenUserId) return res.status(401).json({ success: false, error: 'Not authenticated' });

  try {
    // Verify the session belongs to the user and delete (Prisma or fallback)
    const p7 = getPrisma();
    let existingDelSession;
    if (!p7) {
      const fb = await getAttendanceFallback();
      existingDelSession = fb.find(id);
      if (existingDelSession && existingDelSession.user_id !== tokenUserId) existingDelSession = null;
      if (!existingDelSession) return res.status(404).json({ success: false, error: 'Attendance session not found or you do not have permission to delete it' });
      fb.delete(id);
      return res.status(200).json({ success: true, message: `Attendance session for ${existingDelSession.course || existingDelSession.course_id} deleted successfully`, deletedSession: { id: existingDelSession.id, date: existingDelSession.date.split('T')[0], course: existingDelSession.course || existingDelSession.course_id } });
    } else {
      try {
        existingDelSession = await p7.attendanceSession.findFirst({ where: { id: id, user_id: tokenUserId }, include: { courses: { select: { name: true } } } });
        if (!existingDelSession) return res.status(404).json({ success: false, error: 'Attendance session not found or you do not have permission to delete it' });
        await p7.attendanceSession.delete({ where: { id } });
        return res.status(200).json({ success: true, message: `Attendance session for ${existingDelSession.courses.name} deleted successfully`, deletedSession: { id: existingDelSession.id, date: existingDelSession.date.toISOString().split('T')[0], course: existingDelSession.courses.name } });
      } catch (err) {
        if (isPrismaEngineError(err)) {
          console.warn('Prisma engine not available during delete; using fallback');
          const fb = await getAttendanceFallback();
          existingDelSession = fb.find(id);
          if (!existingDelSession || existingDelSession.user_id !== tokenUserId) return res.status(404).json({ success: false, error: 'Attendance session not found or you do not have permission to delete it' });
          fb.delete(id);
          return res.status(200).json({ success: true, message: `Attendance session for ${existingDelSession.course || existingDelSession.course_id} deleted successfully`, deletedSession: { id: existingDelSession.id, date: existingDelSession.date.split('T')[0], course: existingDelSession.course || existingDelSession.course_id } });
        }
        throw err;
      }
    }
  } catch (error) {
    console.error('Error deleting attendance session:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to delete attendance session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Helper functions
function isValidStatus(status) {
  const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'HOLIDAY', 'EXCUSED'];
  return validStatuses.includes(status.toUpperCase());
}

function getDefaultPoints(status) {
  switch (status.toUpperCase()) {
    case 'PRESENT':
      return 2;
    case 'EXCUSED':
      return 1;
    case 'LATE':
      return 1; // idk what late is worth
    case 'ABSENT':
      return 0;
    case 'HOLIDAY':
      return null;
    default:
      return 0;
  }
}