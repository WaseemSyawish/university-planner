// pages/api/events/[id].js
const prisma = require('../../../lib/prisma');
const fallback = require('../../../lib/eventsFallback');
const { MIN_SCHEDULE_OFFSET_MS, MIN_SCHEDULE_OFFSET_LABEL } = require('../../../lib/config');

function isDateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseDateForStorage(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') return value;
  const s = String(value);
  // Treat date-only strings as local-midnight to avoid timezone shifting the day
  if (isDateOnly(s)) return new Date(s + 'T00:00:00');
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function isBeforeTodayLocal(date) {
  if (!date) return false;
  const d = (Object.prototype.toString.call(date) === '[object Date]') ? date : new Date(String(date));
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const providedStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return providedStart < todayStart;
}

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ code: 'MISSING_ID', message: 'Event ID is required' });
  }
  
  try {
    // Helper: detect missing-column or unknown-argument DB/Prisma errors
    const isMissingColumnError = (err) => {
      if (!err) return false;
      const m = err && err.message ? String(err.message).toLowerCase() : '';
      if (!m) return false;
      if (m.includes('does not exist') || m.includes('no such column')) return true;
      if (m.includes('unknown argument') || m.includes('unknown arg')) return true;
      if (/unknown.*meta/.test(m)) return true;
      return false;
    };

    // Helper: safely find an event by id, retrying without selecting `meta` if needed
    const safeFindEvent = async (evtId, includeCourses = false) => {
      try {
        if (includeCourses) return await prisma.event.findUnique({ where: { id: evtId }, include: { courses: true } });
        return await prisma.event.findUnique({ where: { id: evtId } });
      } catch (e) {
        if (!isMissingColumnError(e)) throw e;
        // Retry by explicitly selecting known fields (exclude meta) and include relations if requested
        const baseSelect = {
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
        };
        if (includeCourses) baseSelect.courses = true;
        return await prisma.event.findUnique({ where: { id: evtId }, select: baseSelect });
      }
    };

    // Helper: safely update event; if missing-column error occurs, retry after removing `meta` from data
    const safeUpdateEvent = async (evtId, data, includeCourses = false) => {
      try {
        return await prisma.event.update({ where: { id: evtId }, data, include: includeCourses ? { courses: true } : undefined });
      } catch (e) {
        if (!isMissingColumnError(e)) throw e;
        // If the DB/schema mismatch mentions unsupported fields (e.g. end_date), strip them and retry.
        console.warn('[events/:id] retrying update without unsupported fields due to DB schema mismatch', e && e.message ? String(e.message) : '');
        const copy = { ...data };
        if (Object.prototype.hasOwnProperty.call(copy, 'meta')) delete copy.meta;
        // Remove end_date if error message references it
        try {
          const mmsg = e && e.message ? String(e.message) : '';
          if (/unknown (argument|arg).*end_date/i.test(mmsg) || /Unknown argument `end_date`/.test(mmsg) || /end_date/.test(mmsg)) {
            if (Object.prototype.hasOwnProperty.call(copy, 'end_date')) delete copy.end_date;
          }
        } catch (ee) {}
        return await prisma.event.update({ where: { id: evtId }, data: copy, include: includeCourses ? { courses: true } : undefined });
      }
    };

    // Helper: safely create event; retry without meta if necessary
    const safeCreateEvent = async (data, includeCourses = false) => {
      try {
        return await prisma.event.create({ data, include: includeCourses ? { courses: true } : undefined });
      } catch (e) {
        if (!isMissingColumnError(e)) throw e;
        console.warn('[events/:id] retrying create without unsupported fields due to DB schema mismatch', e && e.message ? String(e.message) : '');
        const copy = { ...data };
        if (Object.prototype.hasOwnProperty.call(copy, 'meta')) delete copy.meta;
        try {
          const mmsg = e && e.message ? String(e.message) : '';
          if (/unknown (argument|arg).*end_date/i.test(mmsg) || /Unknown argument `end_date`/.test(mmsg) || /end_date/.test(mmsg)) {
            if (Object.prototype.hasOwnProperty.call(copy, 'end_date')) delete copy.end_date;
          }
        } catch (ee) {}
        return await prisma.event.create({ data: copy, include: includeCourses ? { courses: true } : undefined });
      }
    };
    switch (method) {
      case 'GET': {
        try {
          const event = await safeFindEvent(id, true);
          if (!event) {
            return res.status(404).json({ code: 'NOT_FOUND', message: 'Event not found' });
          }
          return res.status(200).json({ success: true, event });
        } catch (err) {
          console.error(`[events/:id] GET prisma error for id=${id}:`, err && err.message ? err.message : err);
          // Prisma unreachable -> fallback to file store
          if (err && (err.code === 'P1001' || String(err.message || '').includes("Can't reach database"))) {
            try {
              const local = fallback.find(id);
              if (!local) return res.status(404).json({ code: 'NOT_FOUND', message: 'Event not found' });
              return res.status(200).json({ success: true, event: local });
            } catch (fe) {
              console.error('[events/:id] fallback.find error:', fe && fe.message ? fe.message : fe);
            }
          }
          throw err;
        }
      }
      
      case 'PATCH': {
  const updateData = { ...req.body } || {};
        console.log(`[events/:id] PATCH payload for id=${id}:`, JSON.stringify(updateData));

        // Normalize common client-side field names to DB column names
        if (Object.prototype.hasOwnProperty.call(updateData, 'courseId')) {
          updateData.course_id = updateData.courseId;
          delete updateData.courseId;
        }
        // normalize room -> location for backwards compatibility
        if (Object.prototype.hasOwnProperty.call(updateData, 'room') && !Object.prototype.hasOwnProperty.call(updateData, 'location')) {
          updateData.location = updateData.room;
          delete updateData.room;
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'userId')) {
          updateData.user_id = updateData.userId;
          delete updateData.userId;
        }

        // Convert date strings to Date objects for Prisma where appropriate
        if (updateData.date) {
          const parsed = parseDateForStorage(updateData.date);
          if (parsed) {
            // Reject updates that set the event date to before today (local)
            if (isBeforeTodayLocal(parsed)) return res.status(400).json({ code: 'PAST_DATE', message: 'Cannot set event date before today' });
            updateData.date = parsed;
          }
        }
        // Convert endDate/end_date to Date object if present
        if (updateData.endDate || updateData.end_date) {
          const endVal = updateData.endDate || updateData.end_date;
          const parsedEnd = parseDateForStorage(endVal);
          if (parsedEnd) updateData.end_date = parsedEnd;
          delete updateData.endDate;
        }

        // Remove fields that shouldn't be updated
        delete updateData.id;
        delete updateData.created_at;
        delete updateData.user_id;

        // Normalize incoming meta field (allow client to send structured JSON meta)
        if (Object.prototype.hasOwnProperty.call(updateData, 'meta')) {
          // leave as-is; persisted below via pickPrismaFields
        }

        const wantsArchived = Object.prototype.hasOwnProperty.call(updateData, 'archived') ? !!updateData.archived : undefined;
        if (Object.prototype.hasOwnProperty.call(updateData, 'completed')) {
          updateData.completed = !!updateData.completed;
        }

        // If archiving/unarchiving requested, move between tables
        if (wantsArchived === true) {
          // Move from Event -> ArchivedEvent
          const existing = await safeFindEvent(id, false);
          if (!existing) return res.status(404).json({ code: 'NOT_FOUND', message: 'Event not found' });

          const created = await prisma.archivedEvent.create({
            data: {
              original_event_id: existing.id,
              title: updateData.title || existing.title,
              type: updateData.type || existing.type,
              course_id: updateData.course_id ?? existing.course_id,
              date: updateData.date ? parseDateForStorage(updateData.date) : existing.date,
              time: updateData.time ?? existing.time,
              description: updateData.description ?? existing.description,
              meta: updateData.meta ?? existing.meta ?? null,
              location: updateData.location ?? existing.location,
              completed: updateData.completed ?? existing.completed,
              user_id: existing.user_id
            },
            include: { courses: true }
          });

          // Delete original
          await prisma.event.delete({ where: { id } });

          return res.status(200).json({ success: true, event: created });
        }

        if (wantsArchived === false) {
          // If an active event already exists with this id, just update it (clear archived flag).
          // Only when no active event is present do we attempt to restore from archived_events.
          const maybeActive = await safeFindEvent(id, false);
          if (maybeActive) {
            const dataToApply = { ...updateData, archived: false };
            // Ensure we don't try to overwrite immutable fields
            delete dataToApply.id; delete dataToApply.created_at; delete dataToApply.user_id;
            const updated = await safeUpdateEvent(id, dataToApply, true);
            return res.status(200).json({ success: true, event: updated });
          }

          // Move from ArchivedEvent -> Event
          // The archived table may be keyed either by original_event_id or its own id depending on how
          // records were created/migrated. Try both lookups so unarchive succeeds regardless.
          let archivedRec = await prisma.archivedEvent.findUnique({ where: { original_event_id: id } });
          let deleteKey = { original_event_id: id };
          if (!archivedRec) {
            // try fallback: the provided id might be the archivedEvent.id
            archivedRec = await prisma.archivedEvent.findUnique({ where: { id } });
            if (archivedRec) deleteKey = { id };
          }

          if (!archivedRec) {
            const attempted = ['original_event_id', 'id'];
            console.warn(`[events/:id] unarchive failed for id=${id}: archived record not found (attempted keys: ${attempted.join(',')})`);
            return res.status(404).json({ code: 'NOT_FOUND', message: 'Archived event not found', attempted });
          }

          const created = await safeCreateEvent({
            title: updateData.title || archivedRec.title,
            type: updateData.type || archivedRec.type,
            course_id: updateData.course_id ?? archivedRec.course_id,
            date: updateData.date ? parseDateForStorage(updateData.date) : archivedRec.date,
            time: updateData.time ?? archivedRec.time,
            description: updateData.description ?? archivedRec.description,
            meta: updateData.meta ?? archivedRec.meta ?? null,
            location: updateData.location ?? archivedRec.location,
            completed: updateData.completed ?? archivedRec.completed,
            archived: false,
            user_id: archivedRec.user_id
          }, true);

          // Delete archived copy using the resolved key
          await prisma.archivedEvent.delete({ where: deleteKey });

          return res.status(200).json({ success: true, event: created });
        }

  // Otherwise, update in whichever table the event currently resides
  // Try Event first
        // Validate: enforce min scheduling offset only when a time is provided (i.e., a timed event)
        if (updateData.time) {
          try {
            const now = new Date();
            const minAllowed = new Date(now.getTime() + MIN_SCHEDULE_OFFSET_MS);
            // combine either provided date or existing event date with new time
            let baseDate = updateData.date ? new Date(updateData.date) : null;
            if (!baseDate) {
              // try to lookup current record date to combine with provided time
              const existing = await safeFindEvent(id, false) || await prisma.archivedEvent.findUnique({ where: { original_event_id: id } });
              baseDate = existing ? new Date(existing.date) : null;
            }
            if (!baseDate || isNaN(baseDate.getTime())) {
              // Instead of failing the entire update when the base date is unknown (which
              // can happen for migrated or partial records), log and skip the min-offset check.
              console.warn(`[events/:id] PATCH skipping time min-offset check: baseDate missing or invalid for id=${id}`);
            } else {
              const [hh, mm] = String(updateData.time).split(':').map(Number);
              const incomingDateTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hh || 0, mm || 0);
              if (isNaN(incomingDateTime.getTime())) {
                console.warn(`[events/:id] PATCH invalid incomingDateTime for id=${id}, skipping min-offset check`);
              } else if (incomingDateTime < minAllowed) {
                // Keep the existing enforcement if the computed datetime is valid
                return res.status(400).json({ code: 'SCHED_MIN_OFFSET', message: `Please schedule events at least ${MIN_SCHEDULE_OFFSET_LABEL} from now.` });
              }
            }
          } catch (err) {
            // If anything goes wrong during this non-critical validation, log and continue
            console.warn(`[events/:id] PATCH time validation failed for id=${id}:`, err && err.message ? err.message : err);
          }
        }

        // Helper: pick only fields that exist on the Prisma Event/ArchivedEvent models
        const pickPrismaFields = (src) => {
          const allowed = ['title', 'type', 'course_id', 'date', 'time', 'end_date', 'description', 'completed', 'archived', 'location', 'meta', 'color'];
          const out = {};
          for (const k of allowed) {
            if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
          }
          return out;
        };

        // Attempt to update in active events; if not found, try archived table explicitly
        // Support scoped updates: ?scope=all or ?scope=future to update a whole series
        const scope = req.query && req.query.scope ? String(req.query.scope) : null;
        if (scope === 'all' || scope === 'future') {
          console.log(`[events/:id] PATCH scope=${scope} requested for id=${id}`);
        
          // Discover template id or repeat metadata similar to DELETE scope=all
          let tplId = req.query.templateId || req.query.template_id || null;
          const repeatOptionQuery = req.query && (req.query.repeatOption || req.query.repeat_option) ? String(req.query.repeatOption || req.query.repeat_option) : null;
          try {
            const ev = await safeFindEvent(id, false);
            if (ev) {
              if (!tplId && Object.prototype.hasOwnProperty.call(ev, 'template_id')) tplId = ev.template_id || tplId;
              try {
                if (!tplId && ev.meta && typeof ev.meta === 'object') {
                  tplId = ev.meta.template_id || ev.meta.templateId || tplId;
                }
              } catch (e) { /* ignore */ }
              if (!tplId && ev.description && typeof ev.description === 'string') {
                try {
                  const m = String(ev.description).match(/\[META\]([\s\S]*?)\[META\]/);
                  if (m && m[1]) {
                    const parsed = JSON.parse(m[1]);
                    tplId = parsed?.template_id || parsed?.templateId || tplId;
                  }
                } catch (e) { /* ignore parse errors */ }
              }
            }
          } catch (e) {
            console.warn('[events/:id] safeFindEvent failed while discovering template/repeat metadata for PATCH scope', e);
          }

          try {
            const result = await prisma.$transaction(async (tx) => {
              // If we discovered a template_id, prefer a fast bulk update path using
              // template_id (indexed). This avoids brittle heuristics and allows
              // reliable updateMany. For 'future' scope we restrict by date >= target.
              if (tplId) {
                // Determine target date for 'future' scope: use provided updateData.date or existing event.date
                let targetDateForFuture = null;
                if (scope === 'future') {
                  if (updateData.date) targetDateForFuture = new Date(updateData.date);
                  else {
                    try {
                      const existing = await tx.event.findUnique({ where: { id } }) || await tx.archivedEvent.findFirst({ where: { original_event_id: id } });
                      if (existing && existing.date) targetDateForFuture = new Date(existing.date);
                    } catch (e) { }
                  }
                }

                const whereActive = (scope === 'future' && targetDateForFuture) ? { template_id: String(tplId), date: { gte: targetDateForFuture } } : { template_id: String(tplId) };
                const whereArchived = (scope === 'future' && targetDateForFuture) ? { template_id: String(tplId), date: { gte: targetDateForFuture } } : { template_id: String(tplId) };

                const candidateActive = await tx.event.findMany({ where: whereActive, select: { id: true } });
                const candidateArchived = await tx.archivedEvent.findMany({ where: whereArchived, select: { id: true } });

                const activeIds = candidateActive.map(r => r.id);
                const archivedIds = candidateArchived.map(r => r.id);

                // If caller requested a preview, return the candidate ids without applying updates.
                if (req.query && String(req.query.preview) === 'true') {
                  return {
                    templateUpdated: false,
                    preview: true,
                    candidateActiveIds: activeIds,
                    candidateArchivedIds: archivedIds
                  };
                }

                let updatedActive = 0;
                let updatedArchived = 0;

                if (activeIds.length > 0) {
                  try {
                    // Use updateMany for performance; we already discovered the ids
                    await tx.event.updateMany({ where: whereActive, data: pickPrismaFields(updateData) });
                    updatedActive = activeIds.length;
                  } catch (e) {
                    // Fall back to per-row updates when updateMany fails
                    for (const uid of activeIds) {
                      try {
                        await tx.event.update({ where: { id: uid }, data: pickPrismaFields(updateData) });
                        updatedActive++;
                      } catch (pe) {
                        try {
                          const reduced = { ...pickPrismaFields(updateData) };
                          if (Object.prototype.hasOwnProperty.call(reduced, 'meta')) delete reduced.meta;
                          if (Object.prototype.hasOwnProperty.call(reduced, 'end_date')) delete reduced.end_date;
                          await tx.event.update({ where: { id: uid }, data: reduced });
                          updatedActive++;
                        } catch (ppe) {
                          console.warn('[events/:id] per-row fallback update failed for active id', uid, ppe && ppe.message ? ppe.message : ppe);
                        }
                      }
                    }
                  }
                }

                if (archivedIds.length > 0) {
                  try {
                    await tx.archivedEvent.updateMany({ where: whereArchived, data: pickPrismaFields(updateData) });
                    updatedArchived = archivedIds.length;
                  } catch (e) {
                    for (const aid of archivedIds) {
                      try {
                        await tx.archivedEvent.update({ where: { id: aid }, data: pickPrismaFields(updateData) });
                        updatedArchived++;
                      } catch (pae) {
                        try {
                          const reduced = { ...pickPrismaFields(updateData) };
                          if (Object.prototype.hasOwnProperty.call(reduced, 'meta')) delete reduced.meta;
                          if (Object.prototype.hasOwnProperty.call(reduced, 'end_date')) delete reduced.end_date;
                          await tx.archivedEvent.update({ where: { id: aid }, data: reduced });
                          updatedArchived++;
                        } catch (ppae) {
                          console.warn('[events/:id] per-row fallback update failed for archived id', aid, ppae && ppae.message ? ppae.message : ppae);
                        }
                      }
                    }
                  }
                }

                return {
                  templateUpdated: false,
                  updatedActive: updatedActive,
                  updatedArchived: updatedArchived,
                  updatedActiveIds: (process.env.NODE_ENV === 'development') ? activeIds : undefined,
                  updatedArchivedIds: (process.env.NODE_ENV === 'development') ? archivedIds : undefined
                };
              }

              // Fetch all active events minimally
              const allActive = await tx.event.findMany({ select: { id: true, title: true, date: true, time: true, description: true, meta: true, template_id: true } });
              const idsToUpdate = new Set();

              for (const e of allActive) {
                try {
                  if (tplId && e.template_id && String(e.template_id) === String(tplId)) { idsToUpdate.add(e.id); continue; }
                  if (tplId && e.meta && typeof e.meta === 'object') {
                    if (String(e.meta.template_id || e.meta.templateId || '') === String(tplId)) { idsToUpdate.add(e.id); continue; }
                  }
                  if (repeatOptionQuery && e.meta && typeof e.meta === 'object') {
                    if (String(e.meta.repeatOption || e.meta.repeat_option || e.meta.repeatoption || '') === String(repeatOptionQuery)) { idsToUpdate.add(e.id); continue; }
                  }

                  if (e.description && typeof e.description === 'string') {
                    const m = String(e.description).match(/\[META\]([\s\S]*?)\[META\]/);
                    if (m && m[1]) {
                      try {
                        const parsed = JSON.parse(m[1]);
                        if (tplId && String(parsed.template_id || parsed.templateId || '') === String(tplId)) { idsToUpdate.add(e.id); continue; }
                        if (repeatOptionQuery && String(parsed.repeatOption || parsed.repeat_option || parsed.repeatoption || '') === String(repeatOptionQuery)) { idsToUpdate.add(e.id); continue; }
                      } catch (pe) { /* ignore parse errors */ }
                    }
                  }
                } catch (inner) { /* ignore per-event errors */ }
              }

              // Also attempt to update archived events by scanning description/meta
              const allArchived = await tx.archivedEvent.findMany({ select: { id: true, original_event_id: true, description: true, meta: true } });
              const archivedIdsToUpdate = new Set();
              for (const e of allArchived) {
                try {
                  if (e.meta && typeof e.meta === 'object') {
                    if (tplId && String(e.meta.template_id || e.meta.templateId || '') === String(tplId)) { archivedIdsToUpdate.add(e.id); continue; }
                    if (repeatOptionQuery && String(e.meta.repeatOption || e.meta.repeat_option || e.meta.repeatoption || '') === String(repeatOptionQuery)) { archivedIdsToUpdate.add(e.id); continue; }
                  }
                  if (e.description && typeof e.description === 'string') {
                    const m = String(e.description).match(/\[META\]([\s\S]*?)\[META\]/);
                    if (m && m[1]) {
                      try {
                        const parsed = JSON.parse(m[1]);
                        if (tplId && String(parsed.template_id || parsed.templateId || '') === String(tplId)) { archivedIdsToUpdate.add(e.id); continue; }
                        if (repeatOptionQuery && String(parsed.repeatOption || parsed.repeat_option || parsed.repeatoption || '') === String(repeatOptionQuery)) { archivedIdsToUpdate.add(e.id); continue; }
                      } catch (pe) { }
                    }
                  }
                } catch (inner) { }
              }

              // If no matches found via metadata, fall back to best-effort title/time matching
              if (idsToUpdate.size === 0 && archivedIdsToUpdate.size === 0) {
                try {
                  const target = await tx.event.findUnique({ where: { id }, select: { title: true, time: true, date: true } }) || await tx.archivedEvent.findFirst({ where: { original_event_id: id }, select: { title: true, time: true, date: true } });
                  if (target && target.title) {
                    const titleMatch = String(target.title).trim();
                    // For future scope, only match events >= target.date
                    const timeMatch = target.time || null;
                    let similarActive = [];
                    if (scope === 'future' && target.date) {
                      similarActive = await tx.event.findMany({ where: { title: titleMatch, time: timeMatch, date: { gte: target.date } }, select: { id: true } });
                    } else {
                      similarActive = await tx.event.findMany({ where: { title: titleMatch, time: timeMatch }, select: { id: true } });
                    }
                    for (const s of similarActive) idsToUpdate.add(s.id);
                    let similarArchived = [];
                    if (scope === 'future' && target.date) {
                      similarArchived = await tx.archivedEvent.findMany({ where: { title: titleMatch, time: timeMatch, /* archivedEvent may not have date field in some schemas */ }, select: { id: true } });
                    } else {
                      similarArchived = await tx.archivedEvent.findMany({ where: { title: titleMatch, time: timeMatch }, select: { id: true } });
                    }
                    for (const s of similarArchived) archivedIdsToUpdate.add(s.id);
                    // If the strict exact-match queries found nothing, attempt a relaxed
                    // case-insensitive substring match on title and hour-only time match.
                    // This helps when materialized occurrences lost explicit template linkage
                    // or have slight title variations. Use Prisma `contains` with
                    // `mode: 'insensitive'` when available.
                    try {
                      if (idsToUpdate.size === 0 && archivedIdsToUpdate.size === 0) {
                        const titleLower = titleMatch;
                        // Relaxed active events search
                        let relaxedActive = [];
                        if (scope === 'future' && target.date) {
                          relaxedActive = await tx.event.findMany({ where: { title: { contains: titleLower, mode: 'insensitive' }, date: { gte: target.date } }, select: { id: true, time: true, date: true } });
                        } else {
                          relaxedActive = await tx.event.findMany({ where: { title: { contains: titleLower, mode: 'insensitive' } }, select: { id: true, time: true, date: true } });
                        }
                        for (const s of relaxedActive) {
                          try {
                            // If we have a time match requirement, compare hour-only
                            if (timeMatch) {
                              const sh = s.time ? String(s.time).slice(0,2) : null;
                              const th = timeMatch ? String(timeMatch).slice(0,2) : null;
                              if (sh && th && String(sh) === String(th)) idsToUpdate.add(s.id);
                            } else {
                              idsToUpdate.add(s.id);
                            }
                          } catch (inner) {}
                        }

                        // Relaxed archived events search
                        let relaxedArchived = await tx.archivedEvent.findMany({ where: { title: { contains: titleLower, mode: 'insensitive' } }, select: { id: true, description: true } });
                        for (const s of relaxedArchived) {
                          try { archivedIdsToUpdate.add(s.id); } catch (inner) {}
                        }
                      }
                    } catch (relaxedErr) {
                      // Non-fatal: log and continue - keep original behavior if Prisma mode not supported
                      console.warn('[events/:id] relaxed title-substring matching failed or not supported:', relaxedErr && relaxedErr.message ? relaxedErr.message : relaxedErr);
                    }
                  }
                } catch (bestErr) {
                  console.warn('[events/:id] Best-effort title/time bulk update failed:', bestErr);
                }
              }

              // If an EventTemplate model exists and tplId was discovered, update the template record
              const hasEventTemplateModel = typeof prisma.eventTemplate !== 'undefined' && prisma.eventTemplate !== null;
              let templateUpdated = null;
              if (hasEventTemplateModel && tplId) {
                try {
                  const tplUpdateData = {};
                  // Map a limited set of updatable fields from updateData to template
                  if (Object.prototype.hasOwnProperty.call(updateData, 'title')) tplUpdateData.title = updateData.title;
                  if (Object.prototype.hasOwnProperty.call(updateData, 'course_id')) tplUpdateData.course_id = updateData.course_id;
                  if (Object.prototype.hasOwnProperty.call(updateData, 'repeat_option')) tplUpdateData.repeat_option = updateData.repeat_option;
                  if (Object.prototype.hasOwnProperty.call(updateData, 'date')) tplUpdateData.start_date = updateData.date;
                  if (Object.keys(tplUpdateData).length > 0) {
                    templateUpdated = await tx.eventTemplate.update({ where: { id: tplId }, data: tplUpdateData });
                  }
                } catch (te) {
                  console.warn('[events/:id] eventTemplate update failed for tplId=', tplId, te && te.message ? te.message : te);
                }
              }

              // Apply updates to matched active events
              // If no ids were discovered by metadata or exact/title+time matching,
              // perform a JS-based relaxed pass over the fetched `allActive` and
              // `allArchived` arrays: case-insensitive substring title match and
              // hour-only time match. This avoids relying on DB-specific
              // `mode: 'insensitive'` support and increases chance of matching
              // materialized occurrences.
              try {
                if (idsToUpdate.size === 0 && archivedIdsToUpdate.size === 0) {
                  try {
                    const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
                    // attempt to load the target title/time from previously fetched `allActive` or via tx lookup
                    let targetTitle = null;
                    let targetTime = null;
                    try {
                      const targetItem = allActive.find(a => String(a.id) === String(id)) || null;
                      if (targetItem && targetItem.title) targetTitle = norm(targetItem.title);
                      if (targetItem && targetItem.time) targetTime = String(targetItem.time).slice(0,2);
                    } catch (e) { /* ignore */ }

                    if (!targetTitle) {
                      try {
                        const maybe = await tx.event.findUnique({ where: { id }, select: { title: true, time: true } }) || await tx.archivedEvent.findFirst({ where: { original_event_id: id }, select: { title: true, time: true } });
                        if (maybe && maybe.title) targetTitle = norm(maybe.title);
                        if (maybe && maybe.time) targetTime = String(maybe.time).slice(0,2);
                      } catch (e) { /* ignore */ }
                    }

                    if (targetTitle) {
                      for (const e of allActive) {
                        try {
                          const cand = norm(e.title || '');
                          if (!cand) continue;
                          if (cand === targetTitle || cand.includes(targetTitle) || targetTitle.includes(cand)) {
                            if (targetTime) {
                              const eh = e.time ? String(e.time).slice(0,2) : null;
                              if (eh && String(eh) === String(targetTime)) idsToUpdate.add(e.id);
                            } else {
                              idsToUpdate.add(e.id);
                            }
                          }
                        } catch (inner) {}
                      }
                      for (const e of allArchived) {
                        try {
                          const cand = norm(e.title || '');
                          if (!cand) continue;
                          if (cand === targetTitle || cand.includes(targetTitle) || targetTitle.includes(cand)) {
                            archivedIdsToUpdate.add(e.id);
                          }
                        } catch (inner) {}
                      }
                    }
                  } catch (relaxedErr) {
                    console.warn('[events/:id] JS relaxed matching failed:', relaxedErr && relaxedErr.message ? relaxedErr.message : relaxedErr);
                  }
                }
              } catch (e) {}
              // Apply updates deterministically per-row for maximum reliability.
              // Bulk updateMany has proven unreliable across varying schemas and
              // Prisma/DB behaviors; perform per-row updates with careful fallbacks
              // (retry without `meta`, try archived table) and collect exact ids
              // that were successfully updated.
              // If caller requested a preview, return the candidate ids without applying updates.
              if (req.query && String(req.query.preview) === 'true') {
                return {
                  templateUpdated: !!templateUpdated,
                  preview: true,
                  candidateActiveIds: Array.from(idsToUpdate),
                  candidateArchivedIds: Array.from(archivedIdsToUpdate)
                };
              }
              let updatedActiveCount = 0;
              const updatedActiveIds = [];
              if (idsToUpdate.size > 0) {
                const ids = Array.from(idsToUpdate);
                for (const uid of ids) {
                  try {
                    // Attempt per-row update; strip unsupported fields on failure
                    try {
                      await tx.event.update({ where: { id: uid }, data: pickPrismaFields(updateData) });
                      updatedActiveCount++;
                      updatedActiveIds.push(uid);
                      continue;
                    } catch (perErr) {
                      // If missing-column/unknown-arg issues occur, try a reduced payload
                      try {
                        const reduced = { ...pickPrismaFields(updateData) };
                        if (Object.prototype.hasOwnProperty.call(reduced, 'meta')) delete reduced.meta;
                        // also remove end_date if DB complains in some environments
                        if (Object.prototype.hasOwnProperty.call(reduced, 'end_date')) delete reduced.end_date;
                        await tx.event.update({ where: { id: uid }, data: reduced });
                        updatedActiveCount++;
                        updatedActiveIds.push(uid);
                        continue;
                      } catch (reducedErr) {
                        // If still failing, we'll attempt archived fallback below
                      }
                    }

                    // If updating active event failed (e.g., not present), try archivedEvent
                    try {
                      // Try updating by original_event_id then by archived id
                      await tx.archivedEvent.update({ where: { original_event_id: uid }, data: pickPrismaFields(updateData) });
                      updatedActiveCount++;
                      updatedActiveIds.push(uid);
                      continue;
                    } catch (archErr) {
                      try {
                        await tx.archivedEvent.update({ where: { id: uid }, data: pickPrismaFields(updateData) });
                        updatedActiveCount++;
                        updatedActiveIds.push(uid);
                        continue;
                      } catch (archErr2) {
                        // Give up on this id but keep processing others
                        console.warn('[events/:id] per-row update failed for id=', uid, archErr2 && archErr2.message ? archErr2.message : archErr2);
                      }
                    }
                  } catch (finalErr) {
                    console.warn('[events/:id] unexpected error updating id=', uid, finalErr && finalErr.message ? finalErr.message : finalErr);
                  }
                }
              }

              // Apply updates to archived events that were discovered separately
              let updatedArchivedCount = 0;
              const updatedArchivedIds = [];
              if (archivedIdsToUpdate.size > 0) {
                const aids = Array.from(archivedIdsToUpdate);
                for (const aid of aids) {
                  try {
                    try {
                      await tx.archivedEvent.update({ where: { id: aid }, data: pickPrismaFields(updateData) });
                      updatedArchivedCount++;
                      updatedArchivedIds.push(aid);
                      continue;
                    } catch (aErr) {
                      // Retry without meta if needed
                      try {
                        const reducedA = { ...pickPrismaFields(updateData) };
                        if (Object.prototype.hasOwnProperty.call(reducedA, 'meta')) delete reducedA.meta;
                        if (Object.prototype.hasOwnProperty.call(reducedA, 'end_date')) delete reducedA.end_date;
                        await tx.archivedEvent.update({ where: { id: aid }, data: reducedA });
                        updatedArchivedCount++;
                        updatedArchivedIds.push(aid);
                        continue;
                      } catch (reAErr) {
                        console.warn('[events/:id] per-row archived update failed for id=', aid, reAErr && reAErr.message ? reAErr.message : reAErr);
                      }
                    }
                  } catch (finalAErr) {
                    console.warn('[events/:id] unexpected error updating archived id=', aid, finalAErr && finalAErr.message ? finalAErr.message : finalAErr);
                  }
                }
              }

              // Return counts and (development-only) id lists so callers can inspect what was matched
              return {
                templateUpdated: !!templateUpdated,
                updatedActive: updatedActiveCount,
                updatedArchived: updatedArchivedCount,
                updatedActiveIds: (process.env.NODE_ENV === 'development') ? updatedActiveIds : undefined,
                updatedArchivedIds: (process.env.NODE_ENV === 'development') ? updatedArchivedIds : undefined,
              };
            });

            console.log(`[events/:id] PATCH scope=${scope} updated series:`, result);
            return res.status(200).json({ success: true, message: 'Series updated', details: result });
          } catch (txErr) {
            console.error('[events/:id] PATCH series transaction error:', txErr);
            // Attempt a safe non-transactional fallback: try per-row updates
            // outside of a transaction so a single problematic row doesn't
            // abort the entire operation. This increases resiliency across
            // different Prisma/DB schemas.
            try {
              const fallbackResult = { updatedActive: 0, updatedArchived: 0, updatedActiveIds: [], updatedArchivedIds: [] };

              // If we discovered a template id do the template-based path first
              if (tplId) {
                const whereActive = (scope === 'future' && targetDateForFuture) ? { template_id: String(tplId), date: { gte: targetDateForFuture } } : { template_id: String(tplId) };
                const whereArchived = (scope === 'future' && targetDateForFuture) ? { template_id: String(tplId), date: { gte: targetDateForFuture } } : { template_id: String(tplId) };

                let candidateActive = [];
                let candidateArchived = [];
                try { candidateActive = await prisma.event.findMany({ where: whereActive, select: { id: true } }); } catch (e) { candidateActive = []; }
                try { candidateArchived = await prisma.archivedEvent.findMany({ where: whereArchived, select: { id: true } }); } catch (e) { candidateArchived = []; }

                const activeIds = candidateActive.map(r => r.id);
                const archivedIds = candidateArchived.map(r => r.id);

                // Try updateMany first, but don't fail hard if it errors.
                try {
                  await prisma.event.updateMany({ where: whereActive, data: pickPrismaFields(updateData) });
                  fallbackResult.updatedActive = activeIds.length;
                  fallbackResult.updatedActiveIds = (process.env.NODE_ENV === 'development') ? activeIds : undefined;
                } catch (e) {
                  // Per-row updates as fallback
                  for (const uid of activeIds) {
                    try {
                      await prisma.event.update({ where: { id: uid }, data: pickPrismaFields(updateData) });
                      fallbackResult.updatedActive++;
                      if (process.env.NODE_ENV === 'development') fallbackResult.updatedActiveIds.push(uid);
                    } catch (pe) {
                      try {
                        const reduced = { ...pickPrismaFields(updateData) };
                        if (Object.prototype.hasOwnProperty.call(reduced, 'meta')) delete reduced.meta;
                        if (Object.prototype.hasOwnProperty.call(reduced, 'end_date')) delete reduced.end_date;
                        await prisma.event.update({ where: { id: uid }, data: reduced });
                        fallbackResult.updatedActive++;
                        if (process.env.NODE_ENV === 'development') fallbackResult.updatedActiveIds.push(uid);
                      } catch (ppe) {
                        console.warn('[events/:id] fallback per-row update failed for active id', uid, ppe && ppe.message ? ppe.message : ppe);
                      }
                    }
                  }
                }

                try {
                  await prisma.archivedEvent.updateMany({ where: whereArchived, data: pickPrismaFields(updateData) });
                  fallbackResult.updatedArchived = archivedIds.length;
                  fallbackResult.updatedArchivedIds = (process.env.NODE_ENV === 'development') ? archivedIds : undefined;
                } catch (e) {
                  for (const aid of archivedIds) {
                    try {
                      await prisma.archivedEvent.update({ where: { id: aid }, data: pickPrismaFields(updateData) });
                      fallbackResult.updatedArchived++;
                      if (process.env.NODE_ENV === 'development') fallbackResult.updatedArchivedIds.push(aid);
                    } catch (pae) {
                      try {
                        const reduced = { ...pickPrismaFields(updateData) };
                        if (Object.prototype.hasOwnProperty.call(reduced, 'meta')) delete reduced.meta;
                        if (Object.prototype.hasOwnProperty.call(reduced, 'end_date')) delete reduced.end_date;
                        await prisma.archivedEvent.update({ where: { id: aid }, data: reduced });
                        fallbackResult.updatedArchived++;
                        if (process.env.NODE_ENV === 'development') fallbackResult.updatedArchivedIds.push(aid);
                      } catch (ppae) {
                        console.warn('[events/:id] fallback per-row update failed for archived id', aid, ppae && ppae.message ? ppae.message : ppae);
                      }
                    }
                  }
                }

                return res.status(200).json({ success: true, message: 'Series updated (fallback)', details: fallbackResult });
              }

              // If tplId not available, attempt heuristic fallback: scan events and update matching ids
              try {
                const allActive = await prisma.event.findMany({ select: { id: true, title: true, date: true, time: true, description: true, meta: true, template_id: true } });
                const idsToUpdate = new Set();
                for (const e of allActive) {
                  try {
                    if (tplId && e.template_id && String(e.template_id) === String(tplId)) { idsToUpdate.add(e.id); continue; }
                    if (tplId && e.meta && typeof e.meta === 'object') {
                      if (String(e.meta.template_id || e.meta.templateId || '') === String(tplId)) { idsToUpdate.add(e.id); continue; }
                    }
                    if (repeatOptionQuery && e.meta && typeof e.meta === 'object') {
                      if (String(e.meta.repeatOption || e.meta.repeat_option || e.meta.repeatoption || '') === String(repeatOptionQuery)) { idsToUpdate.add(e.id); continue; }
                    }
                    if (e.description && typeof e.description === 'string') {
                      const m = String(e.description).match(/\[META\]([\s\S]*?)\[META\]/);
                      if (m && m[1]) {
                        try {
                          const parsed = JSON.parse(m[1]);
                          if (tplId && String(parsed.template_id || parsed.templateId || '') === String(tplId)) { idsToUpdate.add(e.id); continue; }
                          if (repeatOptionQuery && String(parsed.repeatOption || parsed.repeat_option || parsed.repeatoption || '') === String(repeatOptionQuery)) { idsToUpdate.add(e.id); continue; }
                        } catch (pe) { /* ignore parse errors */ }
                      }
                    }
                  } catch (inner) { /* ignore per-event errors */ }
                }

                const updatedActiveIds = [];
                let updatedActive = 0;
                if (idsToUpdate.size > 0) {
                  for (const uid of Array.from(idsToUpdate)) {
                    try {
                      await prisma.event.update({ where: { id: uid }, data: pickPrismaFields(updateData) });
                      updatedActive++;
                      if (process.env.NODE_ENV === 'development') updatedActiveIds.push(uid);
                    } catch (perErr) {
                      try {
                        const reduced = { ...pickPrismaFields(updateData) };
                        if (Object.prototype.hasOwnProperty.call(reduced, 'meta')) delete reduced.meta;
                        if (Object.prototype.hasOwnProperty.call(reduced, 'end_date')) delete reduced.end_date;
                        await prisma.event.update({ where: { id: uid }, data: reduced });
                        updatedActive++;
                        if (process.env.NODE_ENV === 'development') updatedActiveIds.push(uid);
                      } catch (reducedErr) {
                        // try archived fallbacks
                        try {
                          await prisma.archivedEvent.update({ where: { original_event_id: uid }, data: pickPrismaFields(updateData) });
                          updatedActive++;
                          if (process.env.NODE_ENV === 'development') updatedActiveIds.push(uid);
                        } catch (archErr) {
                          try {
                            await prisma.archivedEvent.update({ where: { id: uid }, data: pickPrismaFields(updateData) });
                            updatedActive++;
                            if (process.env.NODE_ENV === 'development') updatedActiveIds.push(uid);
                          } catch (finalErr) {
                            console.warn('[events/:id] per-row fallback update failed for id=', uid, finalErr && finalErr.message ? finalErr.message : finalErr);
                          }
                        }
                      }
                    }
                  }
                }

                return res.status(200).json({ success: true, message: 'Series updated (fallback heuristic)', details: { updatedActive, updatedActiveIds: (process.env.NODE_ENV === 'development') ? updatedActiveIds : undefined } });
              } catch (heuristicErr) {
                console.error('[events/:id] fallback heuristic update failed:', heuristicErr);
              }
            } catch (fallbackErr) {
              console.error('[events/:id] fallback non-transactional update failed:', fallbackErr);
            }

            // If the fallback also failed, return the original transaction error info
            return res.status(500).json({ code: 'UPDATE_SERIES_FAILED', message: 'Failed to update event series', details: txErr?.message || String(txErr) });
          }
        }

        try {
          // diagnostic: check where the record currently exists
          const existingEvent = await safeFindEvent(id, false);
          const existingArchived = await prisma.archivedEvent.findUnique({ where: { original_event_id: id } });
          console.info(`[events/:id] update target lookup for id=${id}: event=${existingEvent ? 'found' : 'missing'}, archived=${existingArchived ? 'found' : 'missing'}`);

          const dataToApply = pickPrismaFields(updateData);
          const updated = await safeUpdateEvent(id, dataToApply, true);
          return res.status(200).json({ success: true, event: updated });
        } catch (err) {
          console.error(`[events/:id] prisma.event.update error for id=${id}:`, err && err.message ? err.message : err);

          // Try the file-backed fallback for any update error so UI doesn't break when Prisma/DB is flaky
          try {
            const local = fallback.update(id, updateData);
            if (local) return res.status(200).json({ success: true, event: local, fallback: true });
          } catch (fe) {
            console.error('[events/:id] fallback.update error:', fe && fe.message ? fe.message : fe);
          }

          // If the error is record not found in the primary table, try archivedEvent (database-side)
          if (err && err.code === 'P2025') {
            // If record wasn't found in active events, try updating archived record.
            // Archived rows may be keyed by original_event_id or by their own id; try both.
            try {
              const archivedUpdate = await prisma.archivedEvent.update({ where: { original_event_id: id }, data: pickPrismaFields(updateData), include: { courses: true } });
              return res.status(200).json({ success: true, event: archivedUpdate });
            } catch (err2) {
              console.info(`[events/:id] archivedEvent.update by original_event_id failed for id=${id}, trying by archived id`);
              try {
                  const archivedUpdate2 = await prisma.archivedEvent.update({ where: { id }, data: pickPrismaFields(updateData), include: { courses: true } });
                return res.status(200).json({ success: true, event: archivedUpdate2 });
              } catch (err3) {
                console.error(`[events/:id] archivedEvent.update error for id=${id}:`, err3 && err3.message ? err3.message : err3);
                // Add attempted keys to error for debugging
                err3.attempted = ['original_event_id', 'id'];
                throw err3;
              }
            }
          }

          // Some Prisma errors include useful metadata - surface it in development
          if (err && err.message) {
            return res.status(500).json({ code: 'PRISMA_ERROR', message: 'Database update failed', details: err.message });
          }

          // Otherwise re-throw to be handled by outer catch
          throw err;
        }
      }
      
      case 'DELETE': {
        try {
          const scope = req.query && req.query.scope ? String(req.query.scope) : null;
          
          if (scope === 'all') {
      console.log(`[events/:id] DELETE scope=all requested for id=${id}`);

      // Allow caller to provide templateId or repeatOption to guide deletion
      let tplId = req.query.templateId || req.query.template_id || null;
      const repeatOptionQuery = req.query && (req.query.repeatOption || req.query.repeat_option) ? String(req.query.repeatOption || req.query.repeat_option) : null;

      // Try to discover identifying metadata from the event record (meta or description)
      try {
        const ev = await safeFindEvent(id, false);
        if (ev) {
          // prefer explicit template_id if present on record
          if (!tplId && Object.prototype.hasOwnProperty.call(ev, 'template_id')) tplId = ev.template_id || tplId;
          // look into meta JSON for a template_id or repeatOption
          try {
            if (!tplId && ev.meta && typeof ev.meta === 'object') {
              tplId = ev.meta.template_id || ev.meta.templateId || tplId;
            }
          } catch (e) { /* ignore */ }
          // also attempt to parse description for embedded [META] JSON used by some clients
          if (!tplId && ev.description && typeof ev.description === 'string') {
            try {
              const m = String(ev.description).match(/\[META\]([\s\S]*?)\[META\]/);
              if (m && m[1]) {
                const parsed = JSON.parse(m[1]);
                tplId = parsed?.template_id || parsed?.templateId || tplId;
              }
            } catch (e) { /* ignore parse errors */ }
          }
        }
      } catch (e) {
        console.warn('[events/:id] safeFindEvent failed while discovering template/repeat metadata', e);
      }

      // Proceed even when template_id / repeatOption are missing — we'll attempt
      // metadata-based and best-effort title/time matching below. This makes the
      // 'Delete All' action more forgiving for materialized series without
      // explicit template linkage.

      // Perform deletion by scanning event meta/description fields (schema may not include template_id/raw columns)
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Fetch all active events with minimal fields we know exist in the schema
          const allActive = await tx.event.findMany({ select: { id: true, title: true, date: true, time: true, description: true, meta: true } });
          const idsToDelete = new Set();

          for (const e of allActive) {
            try {
              // Check meta JSON if available
              if (tplId && e.meta && typeof e.meta === 'object') {
                if (String(e.meta.template_id || e.meta.templateId || '') === String(tplId)) { idsToDelete.add(e.id); continue; }
              }
              if (repeatOptionQuery && e.meta && typeof e.meta === 'object') {
                if (String(e.meta.repeatOption || e.meta.repeat_option || e.meta.repeatoption || '') === String(repeatOptionQuery)) { idsToDelete.add(e.id); continue; }
              }

              // Check description for embedded [META] JSON block
              if (e.description && typeof e.description === 'string') {
                const m = String(e.description).match(/\[META\]([\s\S]*?)\[META\]/);
                if (m && m[1]) {
                  try {
                    const parsed = JSON.parse(m[1]);
                    if (tplId && String(parsed.template_id || parsed.templateId || '') === String(tplId)) { idsToDelete.add(e.id); continue; }
                    if (repeatOptionQuery && String(parsed.repeatOption || parsed.repeat_option || parsed.repeatoption || '') === String(repeatOptionQuery)) { idsToDelete.add(e.id); continue; }
                  } catch (pe) { /* ignore parse errors */ }
                }
              }

            } catch (inner) { /* ignore per-event errors */ }
          }

          // Also attempt to delete archived events by scanning description (archivedEvent doesn't have meta)
          const allArchived = await tx.archivedEvent.findMany({ select: { id: true, original_event_id: true, description: true } });
          const archivedIdsToDelete = new Set();
          for (const e of allArchived) {
            try {
              if (e.description && typeof e.description === 'string') {
                const m = String(e.description).match(/\[META\]([\s\S]*?)\[META\]/);
                if (m && m[1]) {
                  try {
                    const parsed = JSON.parse(m[1]);
                    if (tplId && String(parsed.template_id || parsed.templateId || '') === String(tplId)) { archivedIdsToDelete.add(e.id); continue; }
                    if (repeatOptionQuery && String(parsed.repeatOption || parsed.repeat_option || parsed.repeatoption || '') === String(repeatOptionQuery)) { archivedIdsToDelete.add(e.id); continue; }
                  } catch (pe) {}
                }
              }
            } catch (inner) {}
          }

          // Delete active events
          let deletedActive = { count: 0 };
          if (idsToDelete.size > 0) {
            deletedActive = await tx.event.deleteMany({ where: { id: { in: Array.from(idsToDelete) } } });
          }

          // Delete archived events
          let deletedArchived = { count: 0 };
          if (archivedIdsToDelete.size > 0) {
            deletedArchived = await tx.archivedEvent.deleteMany({ where: { id: { in: Array.from(archivedIdsToDelete) } } });
          }
          // If nothing matched via meta/description, try a best-effort match by title and time
          if ((idsToDelete.size === 0) && (archivedIdsToDelete.size === 0)) {
            try {
              // Attempt to load the target event's title/time to find similar occurrences
              const target = await tx.event.findUnique({ where: { id }, select: { title: true, time: true } }) || await tx.archivedEvent.findFirst({ where: { original_event_id: id }, select: { title: true, time: true } });
              if (target && target.title) {
                const titleMatch = String(target.title).trim();
                const timeMatch = target.time || null;
                const similarActive = await tx.event.findMany({ where: { title: titleMatch, time: timeMatch }, select: { id: true } });
                for (const s of similarActive) idsToDelete.add(s.id);
                const similarArchived = await tx.archivedEvent.findMany({ where: { title: titleMatch, time: timeMatch }, select: { id: true } });
                for (const s of similarArchived) archivedIdsToDelete.add(s.id);

                if (idsToDelete.size > 0) {
                  deletedActive = await tx.event.deleteMany({ where: { id: { in: Array.from(idsToDelete) } } });
                }
                if (archivedIdsToDelete.size > 0) {
                  deletedArchived = await tx.archivedEvent.deleteMany({ where: { id: { in: Array.from(archivedIdsToDelete) } } });
                }
              }
            } catch (bestErr) {
              console.warn('[events/:id] Best-effort title/time bulk delete failed:', bestErr);
            }
          }

          return { deletedActive: deletedActive.count, deletedArchived: deletedArchived.count, total: deletedActive.count + deletedArchived.count };
        });

        console.log(`[events/:id] Deleted series by metadata: ${result.total} events (${result.deletedActive} active, ${result.deletedArchived} archived)`);
        return res.status(200).json({ success: true, message: 'Series deleted', deletedCount: result.total, details: { active: result.deletedActive, archived: result.deletedArchived } });
      } catch (txErr) {
        console.error('[events/:id] DELETE series transaction error:', txErr);
        return res.status(500).json({ code: 'DELETE_SERIES_FAILED', message: 'Failed to delete event series', details: txErr?.message || String(txErr) });
      }
    }
    
    // Single event delete (scope !== 'all')
    try {
      await prisma.event.delete({ where: { id } });
      return res.status(200).json({ success: true, message: 'Event deleted' });
    } catch (err) {
      console.error(`[events/:id] DELETE error for id=${id}:`, err);
      
      // Try fallback
      if (err && (err.code === 'P1001' || String(err.message || '').includes("Can't reach database"))) {
        try {
          const local = fallback.delete(id);
          if (local) return res.status(200).json({ success: true, message: 'Event deleted', event: local });
        } catch (fe) {
          console.error('[events/:id] fallback.delete error:', fe);
        }
      }
      
      // Try archived by original_event_id
      try {
        await prisma.archivedEvent.delete({ where: { original_event_id: id } });
        return res.status(200).json({ success: true, message: 'Archived event deleted' });
      } catch (err2) {
        // Try by id
        try {
          await prisma.archivedEvent.delete({ where: { id } });
          return res.status(200).json({ success: true, message: 'Archived event deleted' });
        } catch (err3) {
          return res.status(404).json({ code: 'NOT_FOUND', message: 'Event not found' });
        }
      }
          }
        } catch (error) {
          console.error('[events/:id] DELETE outer error:', error);
          return res.status(500).json({ 
            code: 'INTERNAL_ERROR', 
            message: 'Delete operation failed', 
            details: error?.message 
          });
        }
      }
      
      default:
        res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
        return res.status(405).json({ 
          success: false, 
          error: `Method ${method} Not Allowed` 
        });
    }
  } catch (error) {
    console.error('Events [id] API error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error', details: error.message });
  }
}