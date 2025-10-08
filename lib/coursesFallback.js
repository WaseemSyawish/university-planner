const fs = require('fs');
const path = require('path');

const dataFile = path.join(process.cwd(), 'data', 'courses.json');

function ensureFile() {
  const dir = path.dirname(dataFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify({ courses: [], nextId: 1 }, null, 2));
}

function read() {
  ensureFile();
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function write(obj) {
  fs.writeFileSync(dataFile, JSON.stringify(obj, null, 2));
}

module.exports = {
  list(userId) {
    const obj = read();
    return obj.courses.filter(c => c.user_id === userId);
  },
  create(payload) {
    const obj = read();
    const id = String(Date.now());
    const now = new Date().toISOString();
    const course = {
      id,
      name: payload.name,
      code: payload.code || null,
      credits: payload.credits || 3,
      color: payload.color || '#3B82F6',
      semester: payload.semester || '2025-1',
      instructor: payload.instructor || null,
      description: payload.description || null,
      user_id: payload.userId,
      created_at: now,
      updated_at: now,
      attendanceSessionsCount: 0
    };
    obj.courses.push(course);
    obj.nextId = (obj.nextId || 0) + 1;
    write(obj);
    return course;
  },
  find(id) {
    const obj = read();
    return obj.courses.find(c => c.id === id);
  },
  update(id, payload) {
    const obj = read();
    const idx = obj.courses.findIndex(c => c.id === id);
    if (idx === -1) return null;
    const existing = obj.courses[idx];
    const updated = {
      ...existing,
      name: payload.name ?? existing.name,
      code: payload.code ?? existing.code,
      credits: payload.credits ?? existing.credits,
      color: payload.color ?? existing.color,
      semester: payload.semester ?? existing.semester,
      instructor: payload.instructor ?? existing.instructor,
      description: payload.description ?? existing.description,
      updated_at: new Date().toISOString()
    };
    obj.courses[idx] = updated;
    write(obj);
    return updated;
  },
  delete(id) {
    const obj = read();
    const idx = obj.courses.findIndex(c => c.id === id);
    if (idx === -1) return null;
    const [deleted] = obj.courses.splice(idx, 1);
    write(obj);
    return deleted;
  }
};
