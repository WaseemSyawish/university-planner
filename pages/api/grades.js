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
      // Update course (add/edit/delete assessments)
      try {
        const { courseId, action, assessment, assessmentIndex } = req.body;
        if (!courseId || !action) {
          return res.status(400).json({ success: false, error: 'Missing required fields: courseId, action' });
        }

        const userId = await resolveUserId(req);
        if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

        const db = readGradesData();
        const userCourses = db[userId] || [];
        const courseIndex = userCourses.findIndex(course => course.id === courseId);
        if (courseIndex === -1) return res.status(404).json({ success: false, error: 'Course not found' });

        switch (action) {
          case 'add_assessment':
            if (!assessment || !assessment.name || assessment.weight === undefined) {
              return res.status(400).json({ success: false, error: 'Missing assessment name or weight' });
            }
            const existingTotal = userCourses[courseIndex].assessments.reduce((s, a) => s + (a.weight || 0), 0);
            const newWeight = parseFloat(assessment.weight) || 0;
            if (existingTotal + newWeight > 100) {
              return res.status(400).json({ success: false, error: 'Total assessment weights cannot exceed 100%.' });
            }
            userCourses[courseIndex].assessments.push({ name: assessment.name, weight: newWeight, items: [] });
            break;

          case 'update_assessment':
            if (assessmentIndex === undefined || !assessment) return res.status(400).json({ success: false, error: 'Missing assessment index or data' });
            if (userCourses[courseIndex].assessments[assessmentIndex]) {
              const updated = { ...assessment };
              const updatedWeight = updated.weight !== undefined ? parseFloat(updated.weight) : userCourses[courseIndex].assessments[assessmentIndex].weight;
              const otherTotal = userCourses[courseIndex].assessments.reduce((s, a, idx) => idx === assessmentIndex ? s : s + (a.weight || 0), 0);
              if ((otherTotal + (isNaN(updatedWeight) ? 0 : updatedWeight)) > 100) {
                return res.status(400).json({ success: false, error: 'Total assessment weights cannot exceed 100%.' });
              }
              if (Array.isArray(updated.items)) {
                updated.items = updated.items.map(it => ({ ...it, weight: it.weight !== undefined && it.weight !== '' ? parseFloat(it.weight) : undefined, grade: it.grade === '' || it.grade === undefined ? it.grade : parseFloat(it.grade), maxGrade: it.maxGrade === '' || it.maxGrade === undefined ? it.maxGrade : parseFloat(it.maxGrade) }));
              }
              updated.weight = isNaN(updatedWeight) ? userCourses[courseIndex].assessments[assessmentIndex].weight : updatedWeight;
              userCourses[courseIndex].assessments[assessmentIndex] = updated;
            }
            break;

          case 'delete_assessment':
            if (assessmentIndex === undefined) return res.status(400).json({ success: false, error: 'Missing assessment index' });
            userCourses[courseIndex].assessments.splice(assessmentIndex, 1);
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