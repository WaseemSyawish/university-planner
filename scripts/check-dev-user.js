const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'data', 'dev-user.json');
if (!fs.existsSync(p)) {
  console.error('MISSING', p);
  process.exit(2);
}
try {
  const raw = fs.readFileSync(p, 'utf8');
  const parsed = JSON.parse(raw);
  console.log('FOUND', p);
  console.log(parsed);
} catch (e) {
  console.error('INVALID JSON', e && e.message);
  process.exit(3);
}
