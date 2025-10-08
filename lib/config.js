// Shared runtime config for client & server
// Use a single source of truth for the minimum scheduling offset so client and server can't drift.

const MIN_SCHEDULE_OFFSET_MS = 4 * 60 * 1000; // 4 minutes (a bit more lenient than 4.5)
const MIN_SCHEDULE_OFFSET_LABEL = '4 minutes';

module.exports = {
  MIN_SCHEDULE_OFFSET_MS,
  MIN_SCHEDULE_OFFSET_LABEL
};
