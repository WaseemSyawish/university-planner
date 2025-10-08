// Preload monitor that wraps JSON.parse to log context when parse fails.
const orig = JSON.parse;
JSON.parse = function (text) {
  try {
    return orig(text);
  } catch (e) {
    try {
      // Print diagnostic: message, stack, and a snippet of the text
      console.error('\n=== MONITOR: JSON.parse FAILURE ===');
      console.error('message:', e.message);
      console.error('snippet (first 600 chars):');
      const s = typeof text === 'string' ? text : String(text);
      console.error(s.length > 600 ? s.slice(0,600) + '...[truncated]' : s);
      console.error('call stack (where JSON.parse was invoked):');
      console.error(new Error().stack);
      console.error('=== END MONITOR ===\n');
    } catch (e2) {
      // swallow
    }
    throw e;
  }
};

// Also monitor uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('\n=== MONITOR: UncaughtException ===');
  console.error(err && err.stack ? err.stack : err);
  console.error('=== END UncaughtException ===\n');
  // rethrow to maintain original behavior
  throw err;
});

// Keep module harmless otherwise
module.exports = {};
