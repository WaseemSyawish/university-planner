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

        if (prismaClient) {
          try {
            const courses = await prismaClient.course.findMany({ where: { user_id: userId }, include: { assessments: true } });
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

        if (writeGradesData(db)) {
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
            // If a full course object was provided, replace course fields and assessments
            if (course) {
              const existing = await prismaClient.course.findFirst({ where: { id: courseId, user_id: userId } });
              if (!existing) return res.status(404).json({ success: false, error: 'Course not found' });

              await prismaClient.course.update({ where: { id: courseId }, data: { name: course.name || existing.name, code: course.code || existing.code, semester: course.semester || existing.semester, description: course.description || existing.description } });

              // replace assessments: delete existing and recreate
              await prismaClient.assessment.deleteMany({ where: { course_id: courseId, user_id: userId } });
              const toCreate = Array.isArray(course.assessments) ? course.assessments.map(a => ({ name: a.name || 'Assessment', weight: a.weight !== undefined ? Number(a.weight) : undefined, items: a.items || [], course_id: courseId, user_id: userId })) : [];
              for (const a of toCreate) {
                await prismaClient.assessment.create({ data: a });
              }

              const updatedAssessments = await prismaClient.assessment.findMany({ where: { course_id: courseId, user_id: userId } });
              return res.status(200).json({ success: true, data: { id: courseId, assessments: updatedAssessments } });
            }

            // Otherwise, support action granularity similar to the old API
            switch (action) {
              case 'add_assessment':
                if (!assessment || !assessment.name) return res.status(400).json({ success: false, error: 'Missing assessment name' });
                const created = await prismaClient.assessment.create({ data: { name: assessment.name, weight: assessment.weight !== undefined ? Number(assessment.weight) : undefined, items: assessment.items || [], course_id: courseId, user_id: userId } });
                return res.status(200).json({ success: true, data: created });

              case 'update_assessment':
                if (!assessment || !assessment.id) return res.status(400).json({ success: false, error: 'Missing assessment id or data' });
                await prismaClient.assessment.updateMany({ where: { id: assessment.id, course_id: courseId, user_id: userId }, data: { name: assessment.name || undefined, weight: assessment.weight !== undefined ? Number(assessment.weight) : undefined, items: assessment.items || undefined } });
                const upd = await prismaClient.assessment.findUnique({ where: { id: assessment.id } });
                return res.status(200).json({ success: true, data: upd });

              case 'delete_assessment':
                if (!assessment || !assessment.id) return res.status(400).json({ success: false, error: 'Missing assessment id' });
                await prismaClient.assessment.deleteMany({ where: { id: assessment.id, course_id: courseId, user_id: userId } });
                return res.status(200).json({ success: true, message: 'Assessment deleted' });

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
        if (writeGradesData(db)) {
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