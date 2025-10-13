const prisma = require('../../../lib/prisma');

// Helper: treat date-only strings (YYYY-MM-DD) as a date without local-midnight
// to avoid timezone shifts when parsed by `new Date(string)`.
function isDateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function localDateOnlyString(d) {
  if (!d) return null;
  const dt = (Object.prototype.toString.call(d) === '[object Date]') ? d : new Date(String(d));
  if (isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateForStorage(value) {
  if (!value) return new Date();
  if (Object.prototype.toString.call(value) === '[object Date]') return value;
  const s = String(value);
  // If it's a pure date like 2025-09-21, anchor it to local midnight to avoid
  // timezone offsets that could move it to the previous/next day.
  if (isDateOnly(s)) return new Date(s + 'T00:00:00');
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function isBeforeTodayLocal(date) {
  if (!date) return false;
  const d = (Object.prototype.toString.call(date) === '[object Date]') ? date : new Date(String(date));
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // If the provided date's y/m/d is strictly less than today's y/m/d, it's before today
  const providedStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return providedStart < todayStart;
}

// Detect common Prisma/DB error messages that indicate the `meta` field
// is not present/understood by the current schema. Messages vary by
// driver/version, so be permissive: missing-column messages and the
// Prisma "Unknown argument `meta`" style errors are both handled.
function isPrismaMetaError(msg) {
  const m = String(msg || '').toLowerCase();
  if (!m) return false;
  if (m.includes('does not exist') || m.includes('no such column')) return true;
  if (m.includes('unknown argument') || m.includes('unknown arg')) return true;
  // additional safeguard for messages that mention `meta` specifically
  if (/unknown.*meta/.test(m)) return true;
  return false;
}

// Helper: attempt to create an event, and if Prisma errors with unknown/unsupported
// argument/column messages, remove the offending fields and retry a few times.
async function createEventWithFallback(client, data) {
  let attempts = 0;
  let current = { ...data };
  while (attempts < 4) {
    try {
      // Log the final payload we're about to send to Prisma (hide large `meta` if present)
      try {
        const preview = { ...current };
        if (preview && preview.meta) preview.meta = undefined;
        const s = JSON.stringify(preview).slice(0, 2000);
        console.info('[api/events] createEventWithFallback - create payload (meta hidden):', s);
      } catch (le) {
        try { console.info('[api/events] createEventWithFallback - create payload keys:', Object.keys(current)); } catch (ke) { /* ignore */ }
      }
      return await client.event.create({ data: current });
    } catch (e) {
      attempts += 1;
      const msg = e && e.message ? String(e.message) : '';
      // try to extract argument/column name from common Prisma error messages
      const fields = [];
      let m;
      // Unknown argument `field`
      m = msg.match(/unknown (?:argument|arg).*`?([a-zA-Z0-9_]+)`?/i);
      if (m && m[1]) fields.push(m[1]);
      // Unknown argument: Available options are marked with ?.
      m = msg.match(/Unknown argument `?([a-zA-Z0-9_]+)`?/i);
      if (m && m[1]) fields.push(m[1]);
      // SQL: column "field" of relation "events" does not exist
      m = msg.match(/column \"?([a-zA-Z0-9_]+)\"? of relation/i);
      if (m && m[1]) fields.push(m[1]);
      // SQLite: no such column: field
      m = msg.match(/no such column[: ]+([a-zA-Z0-9_]+)/i);
      if (m && m[1]) fields.push(m[1]);

      // If we found fields to remove, strip them and retry.
      if (fields.length > 0) {
        let removedAny = false;
        for (const f of fields) {
          if (Object.prototype.hasOwnProperty.call(current, f)) {
            removedAny = true;
            try { delete current[f]; } catch (er) { current[f] = undefined; }
            console.warn('[api/events] removed unsupported field for retry:', f);
          }
        }
        if (removedAny) {
          // loop to retry
          continue;
        }
      }
      // Nothing we can do to recover - rethrow the original error
      throw e;
    }
  }
  // If we exhausted attempts, throw final error
  throw new Error('Failed to create event after retries due to unsupported DB fields');
}

export default async function handler(req, res) {
  // Support OPTIONS for simple CORS checks or preflight from tools
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET,POST,OPTIONS');
    return res.status(204).end();
  }

  // Allow GET to fetch events for a user (used by the client)
  if (req.method === 'GET') {
    try {
      // Prefer server-side auth token user id when available to ensure isolation.
      // In development, allow a query param for testing. In production, require a valid token.
      const { getToken } = await import('next-auth/jwt');
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
      const tokenUserId = token && token.userId ? token.userId : null;
      let userId = null;
      if (tokenUserId) {
        userId = tokenUserId;
      } else if (process.env.NODE_ENV === 'development' && req.query && req.query.userId) {
        userId = String(req.query.userId);
      } else {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Some local databases may not have the `meta` column (older schema).
      // Attempt the normal query, but if Prisma complains about a missing column,
      // retry by explicitly selecting all fields except `meta` so the query succeeds.
      let events;
      try {
        events = await prisma.event.findMany({ where: { user_id: userId }, orderBy: { date: 'desc' } });
      } catch (e) {
        // Detect a missing `meta` field or unknown-argument error and retry
        // with an explicit select that does not reference meta.
        const msg = e && e.message ? String(e.message) : '';
        if (isPrismaMetaError(msg)) {
          console.warn('[api/events] retrying findMany without `meta` due to DB schema mismatch');
          // Explicitly select fields we know exist (mirror Event model without meta)
          events = await prisma.event.findMany({
            where: { user_id: userId },
            orderBy: { date: 'desc' },
            select: {
              id: true,
              title: true,
              type: true,
              location: true,
              archived: true,
                course_id: true,
                color: true,
              template_id: true,
              date: true,
              time: true,
              end_date: true,
              description: true,
              completed: true,
              user_id: true,
              created_at: true,
              updated_at: true
            }
          });
        } else {
          throw e;
        }
      }
      // If the DB/schema doesn't support `meta` we may have embedded a JSON
      // blob into the description as a fallback (prefix `__META__:`). Detect
      // and extract that here so API consumers receive the original metadata
      // (color, variant, etc.). Normalize date fields to local YYYY-MM-DD strings
      // to avoid client-side timezone shifts.
      const normalized = events.map(ev => {
        const out = { ...ev };
        // Extract fallback meta if present in description and meta not already present
        try {
          if (!out.meta && out.description && typeof out.description === 'string') {
            const mIndex = out.description.indexOf('\n\n__META__:');
            const mIndexAlt = out.description.indexOf('__META__:');
            const foundIndex = mIndex !== -1 ? mIndex : (mIndexAlt !== -1 ? mIndexAlt : -1);
            if (foundIndex !== -1) {
              const metaStr = out.description.slice(foundIndex + (foundIndex === mIndex ? 10 : 9));
              try {
                const parsed = JSON.parse(metaStr);
                out.meta = parsed;
                // Optionally strip the meta marker from the description so UI doesn't show it
                out.description = out.description.slice(0, foundIndex).trim();
              } catch (pe) {
                // ignore parse errors and leave description intact
              }
            }
          }
        } catch (e) {
          // swallow extraction errors
        }
        if (out && out.date) out.date = localDateOnlyString(out.date);
        return out;
      });
      return res.status(200).json({ events: normalized });
    } catch (err) {
      console.error('GET /api/events error', err);
      return res.status(500).json({ error: 'Failed to fetch events' });
    }
  }
  if (req.method === 'POST') {
    try {
  const { title, type, courseId, date, time, description, notes, subtasks, attachments, durationMinutes, repeatOption } = req.body;
  // Debug: log truncated incoming body to help diagnose missing materialize/template flags
  try {
    const safeBody = JSON.stringify(req.body, Object.keys(req.body).slice(0, 30)).slice(0, 2000);
    console.info('[api/events] incoming POST body (truncated):', safeBody);
  } catch (e) {
    // ignore stringify errors
  }
      // Prefer token-derived user id; otherwise accept provided userId only in development for testing
      const { getToken } = await import('next-auth/jwt');
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
      const tokenUserId = token && token.userId ? token.userId : null;
      const suppliedUserId = req.body && req.body.userId ? String(req.body.userId) : null;
  const incomingLocation = req.body && (req.body.location || req.body.room) ? (req.body.location || req.body.room) : null;
  console.info('[api/events] POST payload:', JSON.stringify({ title, type, courseId, date, time, description, durationMinutes, location: incomingLocation }));
  const dt = parseDateForStorage(date);
  // Additional debug: log the parsed start and any provided end/duration so we can
  // determine whether the server is computing a 1-hour end or receiving one.
  try {
    console.info('[api/events] parsed times -> start:', dt && dt.toISOString ? dt.toISOString() : String(dt), 'provided endDate:', req.body && req.body.endDate ? String(req.body.endDate) : null, 'durationMinutes:', typeof durationMinutes !== 'undefined' ? String(durationMinutes) : null);
  } catch (e) {}
  // normalize room -> location
  const location = req.body && (req.body.location || req.body.room) ? (req.body.location || req.body.room) : null;
      if (date && isBeforeTodayLocal(dt)) {
        return res.status(400).json({ code: 'PAST_DATE', message: 'Cannot create events before today' });
      }
  // Resolve user id strictly from token; in development allow supplied userId for testing
      let resolvedUserId = null;
      if (tokenUserId) {
        resolvedUserId = tokenUserId;
      } else if (process.env.NODE_ENV === 'development' && suppliedUserId) {
        const u = await prisma.user.findUnique({ where: { id: suppliedUserId } });
        if (u) resolvedUserId = u.id;
        else console.warn('[api/events] POST supplied userId not found in development');
      }
      if (!resolvedUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.info('[api/events] resolvedUserId:', resolvedUserId);

      // Persist notes/subtasks/attachments by serializing into description when provided
      let finalDescription = description || null;
      if (!finalDescription && notes) finalDescription = String(notes);
      // If there are structured extras (subtasks/attachments) append them as JSON under a marker
      const extras = {};
      if (subtasks) extras.subtasks = subtasks;
      if (attachments) extras.attachments = attachments;
      if (Object.keys(extras).length > 0) {
        try {
          const jsonExtras = JSON.stringify(extras);
          finalDescription = finalDescription ? finalDescription + '\n\n' + jsonExtras : jsonExtras;
        } catch (e) { /* ignore serialization errors */ }
      }

      // Persist meta object if provided (meta is sent separately by clients)
      const metaToStore = req.body && req.body.meta ? req.body.meta : null;

      // If the client intended to create a timetable template (a collection of modules)
      // they can send `isTemplate: true` or `templateModules` in the body. In that case
      // we should store the template payload and NOT materialize individual Event rows.
      // Existing behavior when `repeatOption` is provided without `isTemplate` is preserved
      // (create a template + materialize occurrences as before).
      let created = null;
      const isTemplate = !!(req.body && (req.body.isTemplate || Array.isArray(req.body.templateModules)));
      const hasEventTemplateModel = typeof prisma.eventTemplate !== 'undefined' && prisma.eventTemplate !== null;
      // If client asked to create a template but the DB/schema doesn't include the
      // EventTemplate model, return a clear error so the client can handle it.
      if (isTemplate && !hasEventTemplateModel) {
        return res.status(501).json({ error: 'TEMPLATES_NOT_SUPPORTED', message: 'Event templates are not supported by this deployment (missing EventTemplate model in database).' });
      }
      if (isTemplate) {
        // Persist the provided modules/config as a JSON payload on EventTemplate
        const payload = req.body.templateModules || req.body.templatePayload || null;
        const tplData = {
          title: title || null,
          course_id: courseId || null,
          repeat_option: repeatOption || null,
          start_date: dt || null,
          payload: payload,
          user_id: resolvedUserId
        };
        const tpl = await prisma.eventTemplate.create({ data: tplData });
        created = { template_id: tpl.id, template: tpl };
      } else if (repeatOption) {
        // New behavior: materialize occurrences only when explicitly requested.
        const materialize = !!req.body.materialize;
        const materializeCount = Number.isFinite(Number(req.body.materializeCount)) ? Number(req.body.materializeCount) : null;
        const materializeUntil = req.body.materializeUntil ? String(req.body.materializeUntil) : null;
        // If no explicit materialization or template flag provided, refuse to implicitly create a template.
        // Templates must be created explicitly by the client (isTemplate: true) so templates remain
        // authoritative and empty by default unless the user chooses to populate them.
        if (!materialize && !materializeCount && !materializeUntil && !isTemplate) {
          return res.status(400).json({ code: 'MUST_SPECIFY_TEMPLATE_OR_MATERIALIZE', message: 'When creating repeating schedules you must either set isTemplate=true to save a timetable template, or set materialize/materializeCount/materializeUntil to materialize occurrences.' });
        }

        // If we reach here and materialization flags are present, proceed to materialize occurrences.
  if (materialize || materializeCount || materializeUntil) {
          // Helper to compute occurrences (same logic as client-side generateOccurrences)
          // Enhanced computeOccurrences: supports optional `byDays` (array of weekday numbers 0-6)
          // and `interval` (number of weeks between repeats) supplied by the client in req.body.
          // This lets callers request e.g. two instances per week (Mon+Wed) by sending
          // { repeatOption: 'weekly', byDays: [1,3], interval: 1, materializeUntil: '2026-01-15' }
          const computeOccurrences = (startDate, opt, maxCount = 40) => {
            const out = [];
            const start = new Date(startDate);
            const year = start.getFullYear();
            let end = new Date(year, 0, 15);
            if (end <= start) end = new Date(year + 1, 0, 15);

            // Allow client to supply an explicit 'until' bound via materializeUntil; caller filters later.
            // Interval in weeks (default 1)
            const intervalWeeks = Number.isFinite(Number(req.body && req.body.interval)) && Number(req.body.interval) > 0 ? Number(req.body.interval) : 1;
            // byDays: optional array of numbers 0 (Sun) .. 6 (Sat)
            const byDays = Array.isArray(req.body && req.body.byDays) && req.body.byDays.length > 0 ? (req.body.byDays.map(d => Number(d)).filter(d => Number.isFinite(d) && d >= 0 && d <= 6)) : null;

            let cursor = new Date(start);
            let count = 0;

            const pushIf = (d) => { if (d <= end && count < maxCount) { out.push(new Date(d)); count += 1; } };

            if (opt === 'every-2-3-4') {
              while (cursor <= end && count < maxCount) { pushIf(new Date(cursor)); cursor.setDate(cursor.getDate() + 14); }
              return out;
            }

            // If byDays is provided, iterate day-by-day and select matching weekdays.
            if (byDays && byDays.length > 0) {
              // We use a week-index to support multi-week intervals: include a day only when
              // Math.floor(daysSinceStart/7) % intervalWeeks === 0
              const startTime = start.getTime();
              let safeGuard = 0;
              while (cursor <= end && count < maxCount && safeGuard < 10000) {
                const daysSinceStart = Math.floor((cursor.getTime() - startTime) / (1000 * 60 * 60 * 24));
                const weekIndex = Math.floor(daysSinceStart / 7);
                const weekday = cursor.getDay();
                if (byDays.includes(weekday) && (weekIndex % intervalWeeks) === 0) {
                  pushIf(new Date(cursor));
                }
                cursor.setDate(cursor.getDate() + 1);
                safeGuard += 1;
              }
              return out;
            }

            // Default: weekly stepping by intervalWeeks
            let safeGuard = 0;
            while (cursor <= end && count < maxCount && safeGuard < 10000) {
              pushIf(new Date(cursor));
              cursor.setDate(cursor.getDate() + 7 * intervalWeeks);
              safeGuard += 1;
            }
            return out;
          };

          // compute occurrences: respect materializeCount or materializeUntil when provided
          const occDates = (() => {
            if (materializeCount && materializeCount > 0) return computeOccurrences(dt, repeatOption, materializeCount);
            if (materializeUntil) {
              const until = parseDateForStorage(materializeUntil);
              const all = computeOccurrences(dt, repeatOption, 365);
              return all.filter(d => new Date(d).getTime() <= new Date(until).getTime());
            }
            return computeOccurrences(dt, repeatOption, 40);
          })();

          // Create template record first and materialize events in a transaction
          const templateData = {
            title: title || null,
            course_id: courseId || null,
            repeat_option: repeatOption || null,
            start_date: dt,
            user_id: resolvedUserId
          };

          let result;
          if (!hasEventTemplateModel) {
            // Materialize events without creating a template (older DBs)
            result = await prisma.$transaction(async (tx) => {
              const createdEvents = [];
              for (const d of occDates) {
                  try {
                  // Compute occurrence start datetime (date `d` may be a Date)
                  // Build occurrence start as a deterministic UTC instant from date (d) and time
                  // Avoid calling setHours on a Date parsed from a string (can be timezone-dependent).
                  let occStart;
                  try {
                    const dateObj = (d instanceof Date) ? d : new Date(String(d));
                    // Extract year/month/day from the date-only value in local terms
                    const y = dateObj.getFullYear();
                    const m = dateObj.getMonth();
                    const day = dateObj.getDate();
                    let hh = 0, mm = 0;
                    if (time && typeof time === 'string') {
                      const parts = String(time).split(':');
                      hh = Number(parts[0] || 0);
                      mm = Number(parts[1] || 0);
                    }
                    // Use Date.UTC to create a UTC instant for the specified local Y/M/D and HH:MM
                    occStart = new Date(Date.UTC(y, m, day, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0));
                  } catch (e) {
                    occStart = (d instanceof Date) ? new Date(d) : new Date(String(d));
                  }

                  // Determine durationMinutes for this occurrence. Prefer explicit durationMinutes
                  // from the request; otherwise, if an endDate was provided for the original event,
                  // compute duration from the original date -> endDate.
                  let occDurationMinutes = null;
                  if (typeof durationMinutes !== 'undefined' && durationMinutes !== null) {
                    occDurationMinutes = Number(durationMinutes);
                  } else if (req.body && req.body.endDate) {
                    try {
                      const origStart = parseDateForStorage(date);
                      const origEnd = parseDateForStorage(req.body.endDate);
                      if (!isNaN(origStart.getTime()) && !isNaN(origEnd.getTime())) {
                        occDurationMinutes = Math.max(1, Math.round((origEnd.getTime() - origStart.getTime()) / 60000));
                      }
                    } catch (e) { /* ignore */ }
                  }

                  const createData = {
                    title: title || '',
                    type: type || 'assignment',
                    course_id: courseId || null,
                    date: d,
                    time: time || null,
                    description: finalDescription,
                    location: location,
                    color: req.body && req.body.color ? String(req.body.color) : (c && c.color ? c.color : null),
                    user_id: resolvedUserId ? String(resolvedUserId) : null
                  };

                  // Attach end_date for this occurrence when we can compute it
                  if (occDurationMinutes !== null) {
                    try {
                      createData.end_date = new Date(occStart.getTime() + Number(occDurationMinutes) * 60000);
                    } catch (e) { /* ignore */ }
                  } else if (req.body && req.body.endDate) {
                    // Fallback: if original endDate exists but we couldn't compute duration, attempt to shift it
                    try {
                      const origStart = parseDateForStorage(date);
                      const origEnd = parseDateForStorage(req.body.endDate);
                      if (!isNaN(origStart.getTime()) && !isNaN(origEnd.getTime())) {
                        const diff = origEnd.getTime() - origStart.getTime();
                        createData.end_date = new Date(occStart.getTime() + diff);
                      }
                    } catch (e) { /* ignore */ }
                  }

                  // Debug: log server-side computed occStart and end_date for each materialized occurrence
                  try {
                    console.info('[api/events] materialize (no-template) occStart:', occStart && occStart.toISOString ? occStart.toISOString() : String(occStart), 'computed end_date:', createData.end_date && createData.end_date.toISOString ? createData.end_date.toISOString() : String(createData.end_date));
                  } catch (e) {}

                  // Attach meta when available; otherwise include durationMinutes so client can reconstruct
                  if (metaToStore !== null) {
                    try {
                      // clone to avoid mutating caller-provided object
                      const m = { ...metaToStore };
                      if ((typeof durationMinutes !== 'undefined' && durationMinutes !== null) && !m.durationMinutes) m.durationMinutes = Number(durationMinutes);
                      // ensure meta.endDate reflects the computed end_date (if present)
                      if (createData.end_date && !(m.endDate)) m.endDate = createData.end_date instanceof Date ? createData.end_date.toISOString() : String(createData.end_date);
                      createData.meta = m;
                    } catch (e) { createData.meta = metaToStore; }
                  } else if (occDurationMinutes !== null) {
                    createData.meta = { durationMinutes: Number(occDurationMinutes), endDate: createData.end_date instanceof Date ? createData.end_date.toISOString() : createData.end_date };
                  }
                  try { console.info('[api/events] creating materialized event (no template) with data:', JSON.stringify({ ...createData, meta: undefined }).slice(0,2000)); } catch(e) {}
                  const ev = await createEventWithFallback(tx, createData);
                  createdEvents.push(ev);
                } catch (ee) {
                  const mmsg = ee && ee.message ? String(ee.message) : '';
                  if (isPrismaMetaError(mmsg)) {
                    const ev2 = await createEventWithFallback(tx, {
                      title: title || '',
                      type: type || 'assignment',
                      course_id: courseId || null,
                      date: d,
                      time: time || null,
                      description: finalDescription,
                      location: location,
                      color: req.body && req.body.color ? String(req.body.color) : (c && c.color ? c.color : null),
                      user_id: resolvedUserId ? String(resolvedUserId) : null
                    });
                    createdEvents.push(ev2);
                  } else {
                    throw ee;
                  }
                }
              }
              return { template: null, events: createdEvents };
            });
          } else {
            result = await prisma.$transaction(async (tx) => {
              const tpl = await tx.eventTemplate.create({ data: templateData });
              const createdEvents = [];
              for (const d of occDates) {
                  try {
                  // Compute occurrence start datetime and end_date similar to non-template path
                  // Build occurrence start as a deterministic UTC instant from date (d) and time
                  let occStart;
                  try {
                    const dateObj = (d instanceof Date) ? d : new Date(String(d));
                    const y = dateObj.getFullYear();
                    const m = dateObj.getMonth();
                    const day = dateObj.getDate();
                    let hh = 0, mm = 0;
                    if (time && typeof time === 'string') {
                      const parts = String(time).split(':');
                      hh = Number(parts[0] || 0);
                      mm = Number(parts[1] || 0);
                    }
                    occStart = new Date(Date.UTC(y, m, day, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0));
                  } catch (e) {
                    occStart = (d instanceof Date) ? new Date(d) : new Date(String(d));
                  }
                  let occDurationMinutes = null;
                  if (typeof durationMinutes !== 'undefined' && durationMinutes !== null) {
                    occDurationMinutes = Number(durationMinutes);
                  } else if (req.body && req.body.endDate) {
                    try {
                      const origStart = parseDateForStorage(date);
                      const origEnd = parseDateForStorage(req.body.endDate);
                      if (!isNaN(origStart.getTime()) && !isNaN(origEnd.getTime())) {
                        occDurationMinutes = Math.max(1, Math.round((origEnd.getTime() - origStart.getTime()) / 60000));
                      }
                    } catch (e) { /* ignore */ }
                  }

                  const createData = {
                    title: title || '',
                    type: type || 'assignment',
                    course_id: courseId || null,
                    date: d,
                    time: time || null,
                    description: finalDescription,
                    location: location,
                    color: req.body && req.body.color ? String(req.body.color) : (c && c.color ? c.color : null),
                    user_id: resolvedUserId ? String(resolvedUserId) : null,
                    template_id: tpl.id
                  };
                  if (occDurationMinutes !== null) {
                    try { createData.end_date = new Date(occStart.getTime() + Number(occDurationMinutes) * 60000); } catch (e) {}
                  } else if (req.body && req.body.endDate) {
                    try {
                      const origStart = parseDateForStorage(date);
                      const origEnd = parseDateForStorage(req.body.endDate);
                      if (!isNaN(origStart.getTime()) && !isNaN(origEnd.getTime())) {
                        const diff = origEnd.getTime() - origStart.getTime();
                        createData.end_date = new Date(occStart.getTime() + diff);
                      }
                    } catch (e) { /* ignore */ }
                  }
                  // Debug: log server-side computed occStart and end_date for each materialized occurrence (template path)
                  try {
                    console.info('[api/events] materialize (template) occStart:', occStart && occStart.toISOString ? occStart.toISOString() : String(occStart), 'computed end_date:', createData.end_date && createData.end_date.toISOString ? createData.end_date.toISOString() : String(createData.end_date));
                  } catch (e) {}
                  if (metaToStore !== null) {
                    try {
                      const m = { ...metaToStore };
                      if ((typeof durationMinutes !== 'undefined' && durationMinutes !== null) && !m.durationMinutes) m.durationMinutes = Number(durationMinutes);
                      if (createData.end_date && !m.endDate) m.endDate = createData.end_date instanceof Date ? createData.end_date.toISOString() : String(createData.end_date);
                      createData.meta = m;
                    } catch (e) { createData.meta = metaToStore; }
                  } else if (occDurationMinutes !== null) {
                    createData.meta = { durationMinutes: Number(occDurationMinutes), endDate: createData.end_date instanceof Date ? createData.end_date.toISOString() : createData.end_date };
                  }
                  try { console.info('[api/events] creating materialized event for template with data:', JSON.stringify({ ...createData, meta: undefined }).slice(0,2000)); } catch(e) {}
                  const ev = await createEventWithFallback(tx, createData);
                  createdEvents.push(ev);
                } catch (ee) {
                  const mmsg = ee && ee.message ? String(ee.message) : '';
                  if (isPrismaMetaError(mmsg)) {
                    const ev2 = await createEventWithFallback(tx, {
                      title: title || '',
                      type: type || 'assignment',
                      course_id: courseId || null,
                      date: d,
                      time: time || null,
                      description: finalDescription,
                      location: location,
                      color: req.body && req.body.color ? String(req.body.color) : (c && c.color ? c.color : null),
                      user_id: resolvedUserId ? String(resolvedUserId) : null,
                      template_id: tpl.id
                    });
                    createdEvents.push(ev2);
                  } else {
                    throw ee;
                  }
                }
              }
              return { template: tpl, events: createdEvents };
            });
          }
          const materialized = (result && result.events) ? result.events : [];
          created = materialized.length ? materialized[0] : null;
          if (created) {
            try { created.template_id = result && result.template ? result.template.id : null; } catch (e) { created.template_id = null; }
            // Do not attach the full materialized array directly to the returned object
            // as it will include the `created` item itself and produce circular JSON.
            // Instead expose a safe summary: count and a small preview of ids/dates.
            try {
              created._materialized_count = materialized.length;
              created._materialized_preview = materialized.slice(0, 5).map(ev => ({ id: ev.id, date: localDateOnlyString(ev.date) }));
            } catch (e) {
              // ignore preview failures
            }
          }
        }
  } else {
        // compute end_date from provided endDate or durationMinutes
        let endDateToStore = null;
        if (req.body && req.body.endDate) {
          endDateToStore = parseDateForStorage(req.body.endDate);
        } else if (typeof durationMinutes !== 'undefined' && durationMinutes !== null) {
          endDateToStore = new Date((parseDateForStorage(date)).getTime() + Number(durationMinutes) * 60000);
        }
        try { console.info('[api/events] computed endDateToStore:', endDateToStore && endDateToStore.toISOString ? endDateToStore.toISOString() : String(endDateToStore)); } catch (e) {}

        // Try to include end_date when possible. If Prisma complains about unknown
        // argument end_date, fall back to storing durationMinutes in meta as before.
        try {
          const createData = {
            title,
            type: type || 'assignment',
            date: dt,
            time: time || null,
            description: finalDescription,
            color: req.body && req.body.color ? String(req.body.color) : null,
            user_id: resolvedUserId ? String(resolvedUserId) : null
          };
          if (endDateToStore) createData.end_date = endDateToStore;
          // If the caller provided meta (color/duration) prefer that; otherwise
          // ensure durationMinutes is included so UI can compute endDate locally.
          if (metaToStore !== null) {
            const _meta = { ...metaToStore };
            if ((typeof durationMinutes !== 'undefined' && durationMinutes !== null) && !_meta.durationMinutes) _meta.durationMinutes = Number(durationMinutes);
            createData.meta = _meta;
          } else if (typeof durationMinutes !== 'undefined' && durationMinutes !== null) {
            createData.meta = { durationMinutes: Number(durationMinutes) };
          }
          try { console.info('[api/events] creating single event with data:', JSON.stringify({ ...createData, meta: undefined }).slice(0,2000)); } catch(e) {}
          created = await createEventWithFallback(prisma, createData);
        } catch (ee) {
          const mmsg = ee && ee.message ? String(ee.message) : '';
          const isEndDateErr = /unknown (argument|arg).*end_date/i.test(mmsg) || /Unknown argument `end_date`/.test(mmsg) || /end_date/.test(mmsg);
          const isMetaErr = isPrismaMetaError(mmsg);
          if (isMetaErr || isEndDateErr) {
            console.warn('[api/events] retrying create without unsupported fields due to DB schema mismatch', mmsg);
            // First try: create without the unsupported fields (meta and/or end_date)
            try {
              const fallbackData = {
                title,
                type: type || 'assignment',
                date: dt,
                time: time || null,
                description: finalDescription,
                color: req.body && req.body.color ? String(req.body.color) : null,
                user_id: resolvedUserId ? String(resolvedUserId) : null
              };
              // Only include meta if meta column is supported; otherwise embed later
              if (!isMetaErr && metaToStore !== null) {
                const _meta = { ...metaToStore };
                if ((typeof durationMinutes !== 'undefined' && durationMinutes !== null) && !_meta.durationMinutes) _meta.durationMinutes = Number(durationMinutes);
                fallbackData.meta = _meta;
              } else if (typeof durationMinutes !== 'undefined' && durationMinutes !== null) {
                fallbackData.meta = { durationMinutes: Number(durationMinutes) };
              }
              created = await prisma.event.create({ data: fallbackData });
                  try { console.info('[api/events] fallback create (no meta/end_date) payload keys:', Object.keys(fallbackData)); } catch (le) {}
              // If we removed meta but we have it in request, attach it to response object
              if (!created.meta && metaToStore) {
                try { created.meta = metaToStore; } catch (a) {}
              }
            } catch (ee2) {
              // Second fallback: embed meta into description (if present) and create without meta/end_date
              try {
                let descriptionWithMeta = finalDescription;
                try {
                  if (metaToStore) {
                    const safeMeta = JSON.stringify(metaToStore);
                    descriptionWithMeta = descriptionWithMeta ? (descriptionWithMeta + '\n\n__META__:' + safeMeta) : ('__META__:' + safeMeta);
                  }
                } catch (se) { /* ignore */ }
                created = await prisma.event.create({ data: {
                  title,
                  type: type || 'assignment',
                  date: dt,
                  time: time || null,
                  description: descriptionWithMeta,
                  color: req.body && req.body.color ? String(req.body.color) : null,
                  user_id: resolvedUserId ? String(resolvedUserId) : null
                }});
                  try { console.info('[api/events] fallback embed-meta create payload keys:', Object.keys({ title, type, date: dt, time: time || null, description: descriptionWithMeta, color: req.body && req.body.color ? String(req.body.color) : null, user_id: resolvedUserId ? String(resolvedUserId) : null })); } catch (le) {}
                try { created.meta = metaToStore; } catch (a) {}
              } catch (ee3) {
                // If everything failed, rethrow the original error for visibility
                throw ee;
              }
            }
          } else {
            throw ee;
          }
        }
      }

      // Only persist attachment metadata when we've created an Event (not when creating a template)
      if (!isTemplate && attachments && Array.isArray(attachments) && attachments.length > 0) {
        try {
          for (const a of attachments) {
            try {
              const safeName = a.name ? String(a.name).replace(/[^\w.\-]/g, '_') : ('file-' + Date.now());
              await prisma.attachment.create({ data: {
                filename: safeName,
                path: null,
                mime: a.type || null,
                size: a.size || null,
                event_id: created.id
              }});
            } catch (e) { console.warn('attachment meta create failed', e); }
          }
        } catch (e) { console.warn('attachments handling failed', e); }
      }
  // If DB/schema removed end_date or meta, embed the relevant info into description
  // so the client can recover it later. This is a safe, non-destructive fallback.
  try {
    if (created && (!created.end_date && !created.endDate)) {
      const salvageMeta = {};
      if (typeof durationMinutes !== 'undefined' && durationMinutes !== null) salvageMeta.durationMinutes = Number(durationMinutes);
      if (req.body && req.body.endDate) {
        try { salvageMeta.endDate = (new Date(String(req.body.endDate))).toISOString(); } catch (e) { salvageMeta.endDate = req.body.endDate; }
      }
      // Only append if there's something to salvage and description doesn't already contain our marker
      if (Object.keys(salvageMeta).length > 0) {
        try {
          const marker = '\n\n__META__:' + JSON.stringify(salvageMeta);
          if (!created.description || (typeof created.description === 'string' && created.description.indexOf('__META__:') === -1)) {
            // Note: we do NOT alter the DB row here (to avoid requiring UPDATE privileges).
            // Instead, attach the synthetic description on the returned object so API consumers see it.
            created.description = (created.description ? String(created.description) : '') + marker;
          }
        } catch (e) { /* ignore */ }
      }
    }
  } catch (e) { /* ignore salvage failures */ }

  // Return created entity. If we created a template, return it under `template`.
    try {
    if (isTemplate && created && created.template) {
      return res.status(201).json({ template: created.template });
    }
    // Build response and ensure we preserve client-provided endDate when DB didn't store end_date
    const ret = { ...created, durationMinutes: typeof durationMinutes !== 'undefined' ? durationMinutes : null };
    // If DB didn't persist an end_date but the client sent one, attach it to the response
    try {
      if ((!ret.end_date && !ret.endDate) && req.body && req.body.endDate) {
        // normalize to ISO string if possible
        try { ret.endDate = (new Date(String(req.body.endDate))).toISOString(); } catch (ie) { ret.endDate = req.body.endDate; }
      }
      // If DB didn't provide duration info but client sent durationMinutes, ensure it's reflected
      if ((typeof ret.durationMinutes === 'undefined' || ret.durationMinutes === null) && typeof durationMinutes !== 'undefined' && durationMinutes !== null) {
        ret.durationMinutes = Number(durationMinutes);
      }
    } catch (e) { /* swallow */ }
    // normalize date to local date-only string
    if (ret && ret.date) ret.date = localDateOnlyString(ret.date);
    // If we had meta in the incoming body but the DB did not support meta,
    // we may have attached it as a fallback; ensure the API response includes it
    if (!ret.meta && metaToStore) {
      try { ret.meta = metaToStore; } catch (e) {}
    }
    return res.status(201).json({ event: ret });
  } catch (e) {
    if (isTemplate && created && created.template) return res.status(201).json({ template: created.template });
    const fallback = { ...created, durationMinutes: typeof durationMinutes !== 'undefined' ? durationMinutes : null };
    try {
      if ((!fallback.end_date && !fallback.endDate) && req.body && req.body.endDate) {
        try { fallback.endDate = (new Date(String(req.body.endDate))).toISOString(); } catch (ie) { fallback.endDate = req.body.endDate; }
      }
      if ((typeof fallback.durationMinutes === 'undefined' || fallback.durationMinutes === null) && typeof durationMinutes !== 'undefined' && durationMinutes !== null) {
        fallback.durationMinutes = Number(durationMinutes);
      }
    } catch (ee) { /* swallow */ }
    if (!fallback.meta && metaToStore) {
      try { fallback.meta = metaToStore; } catch (e) {}
    }
    return res.status(201).json({ event: fallback });
  }
    } catch (err) {
      // Log full error with stack and payload for debugging
      try {
        console.error('[api/events] POST error:', err && err.stack ? err.stack : err);
        console.error('[api/events] POST body:', JSON.stringify(req.body, null, 2));
      } catch (e) { console.error('[api/events] POST error (failed to stringify):', err); }
      // In development, return error details to help debug client-side
      if (process.env.NODE_ENV === 'development') {
        const details = err && (err.message || err.toString()) ? (err.message || String(err)) : 'unknown error';
        return res.status(500).json({ error: 'Failed to create event', details, body: req.body });
      }
      return res.status(500).json({ error: 'Failed to create event' });
    }
  }
  res.setHeader('Allow', 'GET,POST,OPTIONS');
  res.status(405).end();
}
