// Small helpers to consistently build/parse dates stored as either
// - separate date (YYYY-MM-DD) and time (HH:MM) fields, or
// - full ISO strings (with or without timezone). The goal is to
// construct a local Date when the source was entered as a local
// date + time so we don't accidentally shift the hour due to UTC
// parsing in different environments.
export function parseDatePreserveLocal(input) {
  if (!input) return null;
  try {
    if (input instanceof Date) return input;
    const s = String(input);
    // If it looks like YYYY-MM-DDTHH:mm (no timezone), treat as local
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return new Date(s + ':00');
    // If it looks like an ISO instant ending with Z (e.g. 2025-10-04T09:00:00.000Z)
    // and the server intentionally emitted a UTC instant for a local y/m/d hh:mm,
    // treat it as local by extracting the local components instead of letting
    // the Date parser convert from UTC to local (which causes off-by-one-day shifts).
  // Match ISO-like instants that end in Z or a +00:00/-00:00 offset.
  // Some servers serialize dates as e.g. 2025-10-04T00:00:00+00:00 which should
  // be treated as a local date+time when the intent was a local midnight.
  const isoZ = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+\-]00:00)$/);
    if (isoZ) {
      try {
        const datePart = isoZ[1];
        const hh = Number(isoZ[2]);
        const mm = Number(isoZ[3]);
        const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) {
          const y = Number(m[1]);
          const mo = Number(m[2]) - 1;
          const d = Number(m[3]);
          return new Date(y, mo, d, hh, mm, 0);
        }
      } catch (e) {
        // fall through to default parsing below
      }
    }
    const dt = new Date(input);
    if (!isNaN(dt.getTime())) return dt;
    return null;
  } catch (e) {
    return null;
  }
}

export function buildLocalDateFromParts(datePart, timePart) {
  try {
    if (!datePart) return null;
    const s = String(datePart);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return parseDatePreserveLocal(datePart);
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    if (!timePart) return new Date(y, mo, d);
    const [hh, mm] = String(timePart).split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return new Date(y, mo, d);
    return new Date(y, mo, d, hh, mm);
  } catch (e) {
    return null;
  }
}

export function formatDateLong(d) {
  try {
    const dt = parseDatePreserveLocal(d) || (d ? new Date(d) : null);
    if (!dt || isNaN(dt.getTime())) return String(d || '');
    return dt.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return String(d || ''); }
}

export function formatDateShort(d) {
  try {
    const dt = parseDatePreserveLocal(d) || (d ? new Date(d) : null);
    if (!dt || isNaN(dt.getTime())) return String(d || '');
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) { return String(d || ''); }
}

export function formatTimeFromParts(datePart, timePart) {
  const dt = timePart ? buildLocalDateFromParts(datePart, timePart) : parseDatePreserveLocal(datePart);
  if (!dt) return '';
  try { return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { return '';} 
}

// Return YYYY-MM-DD for a Date-like input using local date components.
export function toYMDLocal(input) {
  const dt = parseDatePreserveLocal(input) || (input instanceof Date ? input : (input ? new Date(input) : null));
  if (!dt || isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
