// pages/api/grades.js
import fs from 'fs';
import path from 'path';

const dataFilePath = path.join(process.cwd(), 'data', 'grades.json');

// Ensure data directory exists
const ensureDataDirectory = () => {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Read grades data which is stored as an object keyed by userId: { [userId]: Course[] }
const readGradesData = () => {
  try {
    ensureDataDirectory();
    if (fs.existsSync(dataFilePath)) {
      const data = fs.readFileSync(dataFilePath, 'utf8');
      return JSON.parse(data || '{}');
    }
    return {};
  } catch (error) {
    console.error('Error reading grades data:', error);
    return {};
  }
};

// Write grades data (object keyed by userId)
const writeGradesData = (data) => {
  try {
    ensureDataDirectory();
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing grades data:', error);
    return false;
  }
};

// Resolve demo/auth user id using next-auth/jwt getToken
// Try to load Prisma client (shared instance). If unavailable we'll fall back to file storage.
let prismaClient = null;
try {
  // use require to load the CommonJS export from lib/prisma
  // lib/prisma exports module.exports = prisma
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  prismaClient = require('../../lib/prisma');
} catch (e) {
  prismaClient = null;
}

const resolveUserId = async (req) => {
  try {
    const { getToken } = await import('next-auth/jwt');
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
    // token may contain userId or sub; fall back to a demo cookie if present
    if (token && token.userId) return token.userId;
    if (token && token.sub) return token.sub;
    // Allow passing a userId as a query param or header for testing and API clients.
    // Note: accepting user id from query/header in production is potentially
    // insecure; prefer standard authenticated tokens. If a user id is supplied
    // and Prisma is available, ensure a minimal User record exists so FK
    // constraints won't block creating courses/assessments. This helps external
    // API clients and non-auth dev flows persist data reliably.
    if (req && req.query && req.query.userId) {
      const supplied = String(req.query.userId);
      try {
        if (prismaClient) {
          try {
            const existing = await prismaClient.user.findUnique({ where: { id: supplied } });
            if (existing) return existing.id;
            // create a minimal user record for the supplied id
            const created = await prismaClient.user.create({ data: { id: supplied, email: `${supplied}@example.dev`, name: supplied } });
            console.warn('[api/grades] created minimal user for supplied userId:', supplied, ' (ensure this behavior is acceptable for your deployment)');
            return created.id;
          } catch (e) {
            console.warn('[api/grades] failed to ensure user exists for supplied userId, falling back to supplied id:', e && e.message ? e.message : e);
            return supplied;
          }
        }
      } catch (e) {}
      return supplied;
    }
    // also allow an explicit header X-User-Id (useful for tests or API clients)
    if (req && req.headers && req.headers['x-user-id']) return req.headers['x-user-id'];
    // fallback to demo-user cookie (for dev/demo flows)
    const raw = req.headers && req.headers.cookie ? req.headers.cookie : '';
    const m = raw.match(/demo-user=([^;]+)/);
    if (m && m[1]) return decodeURIComponent(m[1]);
    return null;
  } catch (e) {
    console.error('resolveUserId error', e);
    return null;
  }
};

export default async function handler(req, res) {
  const { method } = req;

  switch (method) {
    case 'GET':
      // Get courses for authenticated user only
      try {
        const userId = await resolveUserId(req);
        if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

        // Dev-only: quick inspect single course by id for debugging
        if (process.env.NODE_ENV === 'development' && req.query && req.query.devInspectCourse) {
          const inspectId = req.query.devInspectCourse;
          if (prismaClient) {
            try {
              console.log('[api/grades] DEV inspect course', inspectId, 'for user', userId);
              const course = await prismaClient.course.findFirst({ where: { id: inspectId, user_id: userId }, include: { assessments: true } });
              return res.status(200).json({ success: true, data: course || null, dev: true });
            } catch (err) {
              console.error('[api/grades] DEV inspect failed', err);
            }
          }
        }

        if (prismaClient) {
          try {
            console.log('[api/grades] Prisma GET for user:', userId);
            const courses = await prismaClient.course.findMany({ where: { user_id: userId }, include: { assessments: true } });
            console.log(`[api/grades] Found ${courses.length} courses (user=${userId})`);
            // normalize to previous shape: assessments is array with items parsed from JSON
            const normalized = courses.map(c => ({
              id: c.id,
              name: c.name,
              code: c.code || '',
              semester: c.semester || '',
              instructor: c.instructor || '',
              description: c.description || '',
              created_at: c.created_at,
              updated_at: c.updated_at,
              assessments: Array.isArray(c.assessments) ? c.assessments.map(a => ({
                id: a.id,
                name: a.name,
                weight: a.weight || 0,
                items: a.items || [],
                created_at: a.created_at,
                updated_at: a.updated_at
              })) : []
            }));
            return res.status(200).json({ success: true, data: normalized });
          } catch (e) {
            console.error('Prisma GET /api/grades error', e);
            // fallback to file
          }
        }

        const db = readGradesData();
        const courses = db[userId] || [];
        console.log('[api/grades] File-fallback GET for user', userId, 'courses:', courses.length);
        res.status(200).json({ success: true, data: courses });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch courses' });
      }
      break;

    case 'POST':
      // Add new course
      try {
        const { name, code, semester } = req.body;
        if (!name || !semester) {
          return res.status(400).json({ success: false, error: 'Missing required fields: name, semester' });
        }

        const userId = await resolveUserId(req);
        if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

        if (prismaClient) {
          try {
            const created = await prismaClient.course.create({ data: { name, code: code || '', semester, user_id: userId } });
            const out = { id: created.id, name: created.name, code: created.code || '', semester: created.semester || '', assessments: [] };
            return res.status(201).json({ success: true, data: out });
          } catch (e) {
            console.error('Prisma POST /api/grades error', e);
            // fallback to file mode
          }
        }
        const db = readGradesData();
        const userCourses = db[userId] || [];
        const newCourse = {
          id: Date.now(),
          name,
          code: code || '',
          semester,
          assessments: []
        };

        userCourses.push(newCourse);
        db[userId] = userCourses;

        const ok = writeGradesData(db);
        console.log('[api/grades] File-fallback POST for user', userId, 'createdCourseId=', newCourse.id, 'writeOk=', ok);
        if (ok) {
          res.status(201).json({ success: true, data: newCourse });
        } else {
          res.status(500).json({ success: false, error: 'Failed to save course' });
        }
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to create course' });
      }
      break;

    case 'PUT':
      // Update course (add/edit/delete assessments or replace full course)
      try {
        const { courseId, action, assessment, assessmentIndex, course } = req.body;
        if (!courseId) return res.status(400).json({ success: false, error: 'Missing required field: courseId' });

        const userId = await resolveUserId(req);
        if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

        if (prismaClient) {
          try {
            console.log('[api/grades] Prisma PUT for user:', userId, 'courseId:', courseId, 'action:', action ? action : 'replace');
            // If a full course object was provided, replace course fields and assessments
            if (course) {
              const existing = await prismaClient.course.findFirst({ where: { id: courseId, user_id: userId } });
              console.log('[api/grades] Found existing course?', !!existing);
              if (!existing) return res.status(404).json({ success: false, error: 'Course not found' });

              await prismaClient.course.update({ where: { id: courseId }, data: { name: course.name || existing.name, code: course.code || existing.code, semester: course.semester || existing.semester, description: course.description || existing.description } });

              // replace assessments: delete existing and recreate
              await prismaClient.assessment.deleteMany({ where: { course_id: courseId, user_id: userId } });
              const toCreate = Array.isArray(course.assessments) ? course.assessments.map(a => ({ name: a.name || 'Assessment', weight: a.weight !== undefined ? Number(a.weight) : undefined, items: a.items || [], course_id: courseId, user_id: userId })) : [];
              console.log('[api/grades] Recreating assessments count=', toCreate.length);
              for (const a of toCreate) {
                await prismaClient.assessment.create({ data: a });
              }

              // Fetch the canonical course with assessments and return the full object
              const canonical = await prismaClient.course.findFirst({ where: { id: courseId, user_id: userId }, include: { assessments: true } });
              console.log('[api/grades] After replace, returning canonical course (assessments):', (canonical && canonical.assessments ? canonical.assessments.length : 0));
              return res.status(200).json({ success: true, data: canonical });
            }

            // Otherwise, support action granularity similar to the old API
            switch (action) {
              case 'add_assessment':
                if (!assessment || !assessment.name) return res.status(400).json({ success: false, error: 'Missing assessment name' });
                  console.log('[api/grades] add_assessment for course', courseId, 'user', userId);
                  await prismaClient.assessment.create({ data: { name: assessment.name, weight: assessment.weight !== undefined ? Number(assessment.weight) : undefined, items: assessment.items || [], course_id: courseId, user_id: userId } });
                  // return canonical course
                  const afterAdd = await prismaClient.course.findFirst({ where: { id: courseId, user_id: userId }, include: { assessments: true } });
                  return res.status(200).json({ success: true, data: afterAdd });

              case 'update_assessment':
                if (!assessment || !assessment.id) return res.status(400).json({ success: false, error: 'Missing assessment id or data' });
                  console.log('[api/grades] update_assessment', assessment.id);
                  await prismaClient.assessment.updateMany({ where: { id: assessment.id, course_id: courseId, user_id: userId }, data: { name: assessment.name || undefined, weight: assessment.weight !== undefined ? Number(assessment.weight) : undefined, items: assessment.items || undefined } });
                  const afterUpdate = await prismaClient.course.findFirst({ where: { id: courseId, user_id: userId }, include: { assessments: true } });
                  return res.status(200).json({ success: true, data: afterUpdate });

              case 'delete_assessment':
                if (!assessment || !assessment.id) return res.status(400).json({ success: false, error: 'Missing assessment id' });
                  console.log('[api/grades] delete_assessment', assessment.id);
                  await prismaClient.assessment.deleteMany({ where: { id: assessment.id, course_id: courseId, user_id: userId } });
                  const afterDelete = await prismaClient.course.findFirst({ where: { id: courseId, user_id: userId }, include: { assessments: true } });
                  return res.status(200).json({ success: true, data: afterDelete });

              default:
                return res.status(400).json({ success: false, error: 'Invalid action' });
            }
          } catch (e) {
            console.error('Prisma PUT /api/grades error', e);
            // fallback to file mode
          }
        }

        // fallback file-based logic (legacy)
        const { action: legacyAction, assessment: legacyAssessment, assessmentIndex: legacyIndex } = req.body;
        const db = readGradesData();
        const userCourses = db[userId] || [];
        const courseIndex = userCourses.findIndex(course => course.id === courseId);
        if (courseIndex === -1) return res.status(404).json({ success: false, error: 'Course not found' });

          console.log('[api/grades] File-fallback PUT user=', userId, 'courseIndex=', courseIndex, 'action=', legacyAction || 'replace');

        switch (legacyAction) {
          case 'add_assessment':
            if (!legacyAssessment || !legacyAssessment.name || legacyAssessment.weight === undefined) {
              return res.status(400).json({ success: false, error: 'Missing assessment name or weight' });
            }
            const existingTotal = userCourses[courseIndex].assessments.reduce((s, a) => s + (a.weight || 0), 0);
            const newWeight = parseFloat(legacyAssessment.weight) || 0;
            if (existingTotal + newWeight > 100) {
              return res.status(400).json({ success: false, error: 'Total assessment weights cannot exceed 100%.' });
            }
            userCourses[courseIndex].assessments.push({ name: legacyAssessment.name, weight: newWeight, items: [] });
            break;

          case 'update_assessment':
            if (legacyIndex === undefined || !legacyAssessment) return res.status(400).json({ success: false, error: 'Missing assessment index or data' });
            if (userCourses[courseIndex].assessments[legacyIndex]) {
              const updated = { ...legacyAssessment };
              const updatedWeight = updated.weight !== undefined ? parseFloat(updated.weight) : userCourses[courseIndex].assessments[legacyIndex].weight;
              const otherTotal = userCourses[courseIndex].assessments.reduce((s, a, idx) => idx === legacyIndex ? s : s + (a.weight || 0), 0);
              if ((otherTotal + (isNaN(updatedWeight) ? 0 : updatedWeight)) > 100) {
                return res.status(400).json({ success: false, error: 'Total assessment weights cannot exceed 100%.' });
              }
              if (Array.isArray(updated.items)) {
                updated.items = updated.items.map(it => ({ ...it, weight: it.weight !== undefined && it.weight !== '' ? parseFloat(it.weight) : undefined, grade: it.grade === '' || it.grade === undefined ? it.grade : parseFloat(it.grade), maxGrade: it.maxGrade === '' || it.maxGrade === undefined ? it.maxGrade : parseFloat(it.maxGrade) }));
              }
              updated.weight = isNaN(updatedWeight) ? userCourses[courseIndex].assessments[legacyIndex].weight : updatedWeight;
              userCourses[courseIndex].assessments[legacyIndex] = updated;
            }
            break;

          case 'delete_assessment':
            if (legacyIndex === undefined) return res.status(400).json({ success: false, error: 'Missing assessment index' });
            userCourses[courseIndex].assessments.splice(legacyIndex, 1);
            break;

          default:
            return res.status(400).json({ success: false, error: 'Invalid action' });
        }

        db[userId] = userCourses;
        const ok = writeGradesData(db);
        console.log('[api/grades] File-fallback PUT writeOk=', ok, 'user=', userId, 'courseId=', courseId);
        if (ok) {
          res.status(200).json({ success: true, data: userCourses[courseIndex] });
        } else {
          res.status(500).json({ success: false, error: 'Failed to update course' });
        }
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update course' });
      }
      break;

    case 'DELETE':
      // Delete course
      try {
        const { courseId } = req.body;
        if (!courseId) return res.status(400).json({ success: false, error: 'Missing courseId' });

        const userId = await resolveUserId(req);
        if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
        if (prismaClient) {
          try {
            // deleteMany to be safe: ensure user owns the course
            const del = await prismaClient.course.deleteMany({ where: { id: courseId, user_id: userId } });
            if (del.count === 0) return res.status(404).json({ success: false, error: 'Course not found' });
            return res.status(200).json({ success: true, message: 'Course deleted successfully' });
          } catch (e) {
            console.error('Prisma DELETE /api/grades error', e);
            // fallback to file mode
          }
        }

        const db = readGradesData();
        const userCourses = db[userId] || [];
        const initialLength = userCourses.length;
        const updated = userCourses.filter(course => course.id !== courseId);

        if (updated.length === initialLength) return res.status(404).json({ success: false, error: 'Course not found' });

        db[userId] = updated;
        if (writeGradesData(db)) {
          res.status(200).json({ success: true, message: 'Course deleted successfully' });
        } else {
          res.status(500).json({ success: false, error: 'Failed to delete course' });
        }
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete course' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}