// scripts/import_grades_to_prisma.js
// Simple importer to migrate data/grades.json into Prisma DB.
// Usage: node scripts/import_grades_to_prisma.js

const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

async function run() {
  const file = path.join(process.cwd(), 'data', 'grades.json');
  if (!fs.existsSync(file)) {
    console.error('No data/grades.json found. Nothing to import.');
    process.exit(1);
  }
  const raw = fs.readFileSync(file, 'utf8');
  const db = JSON.parse(raw || '{}');

  for (const userId of Object.keys(db)) {
    const courses = db[userId] || [];
    // ensure user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.warn(`Skipping user ${userId} — user not found in database.`);
      continue;
    }
    for (const c of courses) {
      try {
        const createdCourse = await prisma.course.create({ data: { name: c.name || 'Untitled', code: c.code || '', semester: c.semester || '', user_id: userId, description: c.description || '' } });
        if (Array.isArray(c.assessments)) {
          for (const a of c.assessments) {
            await prisma.assessment.create({ data: { name: a.name || 'Assessment', weight: a.weight !== undefined ? Number(a.weight) : undefined, items: a.items || [], course_id: createdCourse.id, user_id: userId } });
          }
        }
        console.log(`Imported course ${c.name} for user ${userId}`);
      } catch (e) {
        console.error('Failed to import course', c.name, e.message || e);
      }
    }
  }
  console.log('Import complete.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(2); });
