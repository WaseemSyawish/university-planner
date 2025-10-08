const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.cwd(), '.next');

try {
  if (fs.existsSync(dir)) {
    console.log('Removing stale .next build directory...');
    // Node 14+ supports rmSync with recursive; fall back to rmdirSync if needed
    if (fs.rmSync) {
      fs.rmSync(dir, { recursive: true, force: true });
    } else {
      fs.rmdirSync(dir, { recursive: true });
    }
    console.log('.next removed.');
  } else {
    // nothing to do
  }
  // Recreate an empty .next directory and a minimal prerender-manifest.json to avoid
  // transient ENOENT errors on some Windows filesystems where next tries to read/write
  // manifest files while the directory is still being created.
  try {
    fs.mkdirSync(dir, { recursive: true });
    const pmPath = path.join(dir, 'prerender-manifest.json');
    if (!fs.existsSync(pmPath)) {
      fs.writeFileSync(pmPath, JSON.stringify({ routes: {}, dynamicRoutes: {}, version: 1 }, null, 2));
      console.log('Wrote placeholder prerender-manifest.json');
    }
  } catch (err) {
    // non-fatal; proceed
    console.warn('Could not create placeholder in .next:', err && err.message ? err.message : err);
  }
} catch (err) {
  console.error('Failed to remove .next directory:', err.message || err);
  // don't exit with error — we want dev to continue so the developer can still start the server
}
