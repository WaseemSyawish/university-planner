// lib/eventUtils.js
// Utilities for parsing and composing event descriptions which may include subtasks.

function parseStoredDescription(desc) {
  if (!desc) return { text: '', subtasks: [] };
  try {
    const parsed = JSON.parse(desc);
    if (parsed && Array.isArray(parsed.subtasks)) {
      return { text: parsed.text || '', subtasks: parsed.subtasks.map((s, i) => ({ id: s.id || `s${i}`, text: s.text || '', done: !!s.done })) };
    }
  } catch (err) {
    // not JSON — treat as plain text
  }
  return { text: desc || '', subtasks: [] };
}

function composeDescriptionFromEventData(descriptionRaw, subtasks) {
  if (Array.isArray(subtasks) && subtasks.length > 0) {
    return JSON.stringify({ subtasks, text: (descriptionRaw || '') });
  }
  if (descriptionRaw && String(descriptionRaw).trim()) return String(descriptionRaw).trim();
  return null;
}

module.exports = { parseStoredDescription, composeDescriptionFromEventData };
