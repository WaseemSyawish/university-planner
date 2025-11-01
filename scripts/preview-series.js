#!/usr/bin/env node
// scripts/preview-series.js
// Usage: node scripts/preview-series.js <eventId> [scope]
// Prints candidate active and archived event ids that would be affected by a scoped update.

const prisma = require('../lib/prisma');

async function safeFindEvent(evtId) {
  try {
    return await prisma.event.findUnique({ where: { id: evtId } });
  } catch (e) {
    // try a minimal select if meta/other fields cause errors
    const baseSelect = { id: true, title: true, type: true, location: true, archived: true, course_id: true, color: true, template_id: true, date: true, time: true, end_date: true, description: true, completed: true, user_id: true, created_at: true, updated_at: true };
    return await prisma.event.findUnique({ where: { id: evtId }, select: baseSelect });
  }
}

function parseMetaFromDescription(desc) {
  try {
    const m = String(desc || '').match(/\[META\]([\s\S]*?)\[META\]/);
    if (!m) return null;
    return JSON.parse(m[1]);
  } catch (e) { return null; }
}

async function runPreview(eventId, scope = 'all') {
  const ev = await safeFindEvent(eventId);
  if (!ev) {
    console.error('Event not found for id', eventId);
    process.exitCode = 2;
    return;
  }

  let tplId = null;
  if (Object.prototype.hasOwnProperty.call(ev, 'template_id')) tplId = ev.template_id || tplId;
  try {
    if (!tplId && ev.meta && typeof ev.meta === 'object') tplId = ev.meta.template_id || ev.meta.templateId || tplId;
  } catch (e) {}
  if (!tplId && ev.description && typeof ev.description === 'string') {
    const parsed = parseMetaFromDescription(ev.description);
    if (parsed) tplId = parsed.template_id || parsed.templateId || tplId;
  }

  let targetDateForFuture = null;
  if (scope === 'future') {
    if (ev.date) targetDateForFuture = new Date(ev.date);
  }

  if (tplId) {
    const whereActive = (scope === 'future' && targetDateForFuture) ? { template_id: String(tplId), date: { gte: targetDateForFuture } } : { template_id: String(tplId) };
    const whereArchived = (scope === 'future' && targetDateForFuture) ? { template_id: String(tplId), date: { gte: targetDateForFuture } } : { template_id: String(tplId) };
    const candidateActive = await prisma.event.findMany({ where: whereActive, select: { id: true } });
    const candidateArchived = await prisma.archivedEvent.findMany({ where: whereArchived, select: { id: true } });
    console.log(JSON.stringify({ preview: true, method: 'template_id', tplId, candidateActiveIds: candidateActive.map(r => r.id), candidateArchivedIds: candidateArchived.map(r => r.id) }, null, 2));
    return;
  }

  // Fallback: scan active events' description/meta and archived
  const allActive = await prisma.event.findMany({ select: { id: true, title: true, date: true, time: true, description: true, meta: true, template_id: true } });
  const idsToUpdate = new Set();
  for (const e of allActive) {
    try {
      if (e.meta && typeof e.meta === 'object') {
        if (e.meta.template_id) { idsToUpdate.add(e.id); continue; }
      }
      if (e.description && typeof e.description === 'string') {
        const m = String(e.description).match(/\[META\]([\s\S]*?)\[META\]/);
        if (m && m[1]) {
          try { const parsed = JSON.parse(m[1]); if (parsed && (parsed.template_id || parsed.templateId)) { idsToUpdate.add(e.id); continue; } } catch (pe) {}
        }
      }
    } catch (inner) {}
  }
  let allArchived;
  try {
    allArchived = await prisma.archivedEvent.findMany({ select: { id: true, description: true, meta: true } });
  } catch (err) {
    // archivedEvent model may not have `meta` in some schemas; fall back
    allArchived = await prisma.archivedEvent.findMany({ select: { id: true, description: true } });
  }
  const archivedIdsToUpdate = new Set();
  for (const e of allArchived) {
    try {
      if (e.meta && typeof e.meta === 'object') {
        if (e.meta.template_id) { archivedIdsToUpdate.add(e.id); continue; }
      }
      if (e.description && typeof e.description === 'string') {
        const m = String(e.description).match(/\[META\]([\s\S]*?)\[META\]/);
        if (m && m[1]) {
          try { const parsed = JSON.parse(m[1]); if (parsed && (parsed.template_id || parsed.templateId)) { archivedIdsToUpdate.add(e.id); continue; } } catch (pe) {}
        }
      }
    } catch (inner) {}
  }

  // If none found by metadata, try title/time exact match
  if (idsToUpdate.size === 0 && archivedIdsToUpdate.size === 0) {
    try {
      const target = await prisma.event.findUnique({ where: { id: eventId }, select: { title: true, time: true, date: true } }) || await prisma.archivedEvent.findFirst({ where: { original_event_id: eventId }, select: { title: true, time: true, date: true } });
      if (target && target.title) {
        const titleMatch = String(target.title).trim();
        const timeMatch = target.time || null;
        let similarActive = [];
        if (scope === 'future' && target.date) {
          similarActive = await prisma.event.findMany({ where: { title: titleMatch, time: timeMatch, date: { gte: target.date } }, select: { id: true } });
        } else {
          similarActive = await prisma.event.findMany({ where: { title: titleMatch, time: timeMatch }, select: { id: true } });
        }
        for (const s of similarActive) idsToUpdate.add(s.id);
        let similarArchived = [];
        if (scope === 'future' && target.date) {
          similarArchived = await prisma.archivedEvent.findMany({ where: { title: titleMatch, time: timeMatch }, select: { id: true } });
        } else {
          similarArchived = await prisma.archivedEvent.findMany({ where: { title: titleMatch, time: timeMatch }, select: { id: true } });
        }
        for (const s of similarArchived) archivedIdsToUpdate.add(s.id);
      }
    } catch (e) {
      console.warn('relaxed matching failed', e && e.message || e);
    }
  }

  console.log(JSON.stringify({ preview: true, method: 'heuristic', candidateActiveIds: Array.from(idsToUpdate), candidateArchivedIds: Array.from(archivedIdsToUpdate) }, null, 2));
}

const args = process.argv.slice(2);
if (!args[0]) {
  console.error('Usage: node scripts/preview-series.js <eventId> [scope]');
  process.exit(1);
}
runPreview(args[0], args[1] || 'all').then(() => prisma.$disconnect()).catch((e) => { console.error('Preview failed', e && e.message || e); prisma.$disconnect().then(() => process.exit(1)); });
