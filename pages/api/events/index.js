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
      // Normalize date fields to local YYYY-MM-DD strings to avoid client-side timezone shifts
      const normalized = events.map(ev => ({ ...ev, date: localDateOnlyString(ev.date) }));
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
          const result = await prisma.$transaction(async (tx) => {
            const tpl = await tx.eventTemplate.create({ data: templateData });
            const createdEvents = [];
            for (const d of occDates) {
              // Attempt to create event including meta; if the DB/schema rejects the column,
              // retry without meta so older databases continue to work.
                try {
                const createData = {
                  title: title || '',
                  type: type || 'assignment',
                  course_id: courseId || null,
                  date: d,
                  time: time || null,
                  description: finalDescription,
                  location: location,
                  user_id: resolvedUserId ? String(resolvedUserId) : null,
                  template_id: tpl.id
                };
                if (metaToStore !== null) createData.meta = metaToStore;
                try { console.info('[api/events] creating materialized event for template with data:', JSON.stringify({ ...createData, meta: undefined }).slice(0,2000)); } catch(e) {}
                const ev = await tx.event.create({ data: createData });
                createdEvents.push(ev);
              } catch (ee) {
                const mmsg = ee && ee.message ? String(ee.message) : '';
                if (isPrismaMetaError(mmsg)) {
                  // retry without meta
                  const ev2 = await tx.event.create({ data: {
                    title: title || '',
                    type: type || 'assignment',
                    course_id: courseId || null,
                    date: d,
                    time: time || null,
                    description: finalDescription,
                    location: location,
                    user_id: resolvedUserId ? String(resolvedUserId) : null,
                    template_id: tpl.id
                  }});
                  createdEvents.push(ev2);
                } else {
                  throw ee;
                }
              }
            }
            return { template: tpl, events: createdEvents };
          });
          const materialized = result.events || [];
          created = materialized.length ? materialized[0] : null;
          if (created) {
            created.template_id = result.template.id;
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

        try {
          const createData = {
            title,
            type: type || 'assignment',
            course_id: courseId || null,
            date: dt,
            time: time || null,
            end_date: endDateToStore,
            description: finalDescription,
            location: location,
            user_id: resolvedUserId ? String(resolvedUserId) : null
          };
          if (metaToStore !== null) createData.meta = metaToStore;
          try { console.info('[api/events] creating single event with data:', JSON.stringify({ ...createData, meta: undefined }).slice(0,2000)); } catch(e) {}
          created = await prisma.event.create({ data: createData });
        } catch (ee) {
          const mmsg = ee && ee.message ? String(ee.message) : '';
          if (isPrismaMetaError(mmsg)) {
            console.warn('[api/events] retrying create without `meta` due to DB schema mismatch');
            created = await prisma.event.create({ data: {
              title,
              type: type || 'assignment',
              course_id: courseId || null,
              date: dt,
              time: time || null,
              end_date: endDateToStore,
              description: finalDescription,
              location: location,
              user_id: resolvedUserId ? String(resolvedUserId) : null
            }});
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

  // Return created entity. If we created a template, return it under `template`.
  try {
    if (isTemplate && created && created.template) {
      return res.status(201).json({ template: created.template });
    }
    const ret = { ...created, durationMinutes: typeof durationMinutes !== 'undefined' ? durationMinutes : null };
    // normalize date to local date-only string
    if (ret && ret.date) ret.date = localDateOnlyString(ret.date);
    return res.status(201).json({ event: ret });
  } catch (e) {
    if (isTemplate && created && created.template) return res.status(201).json({ template: created.template });
    return res.status(201).json({ event: { ...created, durationMinutes: typeof durationMinutes !== 'undefined' ? durationMinutes : null } });
  }
    } catch (err) {
      // Log full error with stack for debugging
      try { console.error('[api/events] POST error:', err && err.stack ? err.stack : err); } catch (e) { console.error('[api/events] POST error (failed to stringify):', err); }
      // In development, return error details to help debug client-side
      if (process.env.NODE_ENV === 'development') {
        const details = err && (err.message || err.toString()) ? (err.message || String(err)) : 'unknown error';
        return res.status(500).json({ error: 'Failed to create event', details });
      }
      return res.status(500).json({ error: 'Failed to create event' });
    }
  }
  res.setHeader('Allow', 'GET,POST,OPTIONS');
  res.status(405).end();
}
