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