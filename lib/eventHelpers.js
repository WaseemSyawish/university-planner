/**
 * Helper utilities for replacing optimistic temporary events (tmp-*) with
 * server-returned events, and for merging materialized occurrences safely.
 */
export function replaceTmpWithServerEvent(stateArray, tempId, serverEvent) {
  if (!Array.isArray(stateArray)) return [serverEvent];
  const mapped = stateArray.map(it => String(it.id) === String(tempId) ? mapServerEvent(it, serverEvent) : it);
  // if tempId wasn't present, append serverEvent if not already there
  if (!mapped.some(it => String(it.id) === String(serverEvent.id))) mapped.push(mapServerEvent(null, serverEvent));
  return mapped;
}

export function mergeMaterialized(stateArray, materialized) {
  const existingIds = new Set((stateArray || []).map(s => String(s.id)));
  const mapped = (stateArray || []).slice();
  (materialized || []).forEach(m => {
    const id = String(m.id);
    if (existingIds.has(id)) return;
    mapped.push(mapServerEvent(null, m));
    existingIds.add(id);
  });
  return mapped;
}

function mapServerEvent(_example, ev) {
  return {
    id: String(ev.id),
    title: ev.title || ev.name || ev.subject || 'Untitled',
    date: (ev.date && typeof ev.date === 'string' && ev.date.length >= 10) ? ev.date.slice(0,10) : (ev.date || ''),
    startTime: ev.time || ev.startTime || '',
    endTime: ev.endTime || ev.end_time || '',
    type: ev.type || 'event',
    location: ev.location || '',
    description: ev.description || ev.details || ''
  };
}

export function dedupeById(arr) {
  const out = [];
  const seen = new Set();
  (arr || []).forEach(a => {
    if (!a || typeof a.id === 'undefined') return;
    const id = String(a.id);
    if (seen.has(id)) return;
    seen.add(id);
    out.push(a);
  });
  return out;
}
