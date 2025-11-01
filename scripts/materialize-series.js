#!/usr/bin/env node
// scripts/materialize-series.js
// Usage: node scripts/materialize-series.js <eventId> [count] [intervalWeeks]
// Example: node scripts/materialize-series.js 5d6923cc-... 52 1

const prisma = require('../lib/prisma');
const { randomUUID } = require('crypto');

function toDateOnly(d) {
  if (!d) return null;
  const x = new Date(d);
  return new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
}

function addWeeks(d, weeks) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + weeks * 7);
  return out;
}

async function materialize(eventId, count = 52, intervalWeeks = 1) {
  const main = await prisma.event.findUnique({ where: { id: eventId } });
  if (!main) {
    console.error('Main event not found:', eventId);
    process.exitCode = 2;
    return;
  }

  // Determine template id: prefer the main event's own id as the stable series key.
  // This ensures child occurrences link to the main event's id (the requested behavior).
  let tpl = main.template_id || null;
  if (!tpl) {
    tpl = main.id;
    await prisma.event.update({ where: { id: eventId }, data: { template_id: tpl } });
    console.log('Assigned main event id as template_id:', tpl);
  } else {
    // If a template_id exists but is different from the main id, log a warning.
    if (String(tpl) !== String(main.id)) {
      console.log('Main event has existing template_id (not equal to main id):', tpl, '— linking children to main id instead will be applied.');
    } else {
      console.log('Main event already has template_id equal to its id:', tpl);
    }
    // Ensure we use the main.id as canonical tpl for newly-created occurrences
    tpl = main.id;
    // Also ensure the main row persists this value (id -> template_id) in case it wasn't set
    try {
      await prisma.event.update({ where: { id: eventId }, data: { template_id: tpl } });
    } catch (e) {
      // ignore update errors here; we'll still set template_id on created children below
    }
  }

  // pull duration from meta if available
  let durationMinutes = null;
  try { if (main.meta && typeof main.meta === 'object') durationMinutes = main.meta.durationMinutes || main.meta.duration_minutes || null; } catch (e) {}

  // Starting point: use main.date as the first occurrence; we'll create occurrences after it
  const baseDate = new Date(main.date);
  const created = [];
  for (let i = 1; i <= count; i++) {
    const dt = addWeeks(baseDate, i * intervalWeeks);

    // Avoid duplicates: check for existing event with same template_id & date OR same title+date+time
    const existingByTpl = await prisma.event.findFirst({ where: { template_id: tpl, date: dt } });
    if (existingByTpl) {
      console.log('Skipping existing (by template/date):', existingByTpl.id);
      continue;
    }

    const existingByMatch = await prisma.event.findFirst({ where: { title: main.title, date: dt, time: main.time } });
    if (existingByMatch) {
      console.log('Skipping existing (by title/date/time):', existingByMatch.id);
      // Also link it to template_id if missing
      if (!existingByMatch.template_id) {
        await prisma.event.update({ where: { id: existingByMatch.id }, data: { template_id: tpl } });
        console.log('Linked existing event to template_id:', existingByMatch.id);
      }
      continue;
    }

    const payload = {
      title: main.title,
      type: main.type,
      course_id: main.course_id || null,
      date: dt,
      time: main.time || null,
      description: main.description || null,
      meta: main.meta || null,
      color: main.color || null,
      template_id: tpl,
      user_id: main.user_id,
      end_date: null,
    };
    try {
      if (durationMinutes) {
        const end = new Date(dt.getTime() + durationMinutes * 60000);
        payload.end_date = end;
      } else if (main.end_date) {
        // attempt to preserve relative end_date offset
        const diff = new Date(main.end_date).getTime() - new Date(main.date).getTime();
        if (!isNaN(diff)) payload.end_date = new Date(dt.getTime() + diff);
      }
    } catch (e) {}

    const createdRow = await prisma.event.create({ data: payload });
    console.log('Created occurrence', createdRow.id, 'date', createdRow.date);
    created.push(createdRow.id);
  }

  console.log('Materialization complete. Created:', created.length, 'events. Template id:', tpl);
  console.log('Created IDs:', created.slice(0, 200));
}

const args = process.argv.slice(2);
if (!args[0]) { console.error('Usage: node scripts/materialize-series.js <eventId> [count=52] [intervalWeeks=1]'); process.exit(1); }
const eventId = args[0];
const count = args[1] ? parseInt(args[1], 10) : 52;
const intervalWeeks = args[2] ? parseInt(args[2], 10) : 1;

(async () => {
  try {
    await materialize(eventId, count, intervalWeeks);
  } catch (e) {
    console.error('Materialize failed', e && e.message || e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
