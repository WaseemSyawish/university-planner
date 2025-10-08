const fs = require('fs');
const path = require('path');

const dataFile = path.join(process.cwd(), 'data', 'events.json');

function ensureFile() {
  const dir = path.dirname(dataFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify({ events: [], nextId: 1 }, null, 2));
}

function read() {
  ensureFile();
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function write(obj) {
  fs.writeFileSync(dataFile, JSON.stringify(obj, null, 2));
}

module.exports = {
  list(showArchived = false) {
    const obj = read();
    if (showArchived) return obj.events;
    return obj.events.filter(e => !e.archived);
  },
  create(payload) {
    const obj = read();
    const id = String(Date.now());
    const ev = { id, ...payload, archived: !!payload.archived, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    obj.events.push(ev);
    obj.nextId = (obj.nextId || 0) + 1;
    write(obj);
    return ev;
  },
  find(id) {
    const obj = read();
    return obj.events.find(e => e.id === id);
  },
  update(id, payload) {
    const obj = read();
    const idx = obj.events.findIndex(e => e.id === id);
    if (idx === -1) return null;
    obj.events[idx] = { ...obj.events[idx], ...payload, archived: payload.archived !== undefined ? !!payload.archived : obj.events[idx].archived, updated_at: new Date().toISOString() };
    write(obj);
    return obj.events[idx];
  },
  delete(id) {
    const obj = read();
    const idx = obj.events.findIndex(e => e.id === id);
    if (idx === -1) return null;
    const [deleted] = obj.events.splice(idx, 1);
    write(obj);
    return deleted;
  }
};
