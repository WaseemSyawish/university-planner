#!/usr/bin/env node
/*
  migrate_events_to_attendance.js

  Usage:
    node scripts/migrate_events_to_attendance.js        # preview candidates
    node scripts/migrate_events_to_attendance.js --apply   # create attendance sessions for candidates
    node scripts/migrate_events_to_attendance.js --apply --delete  # create sessions and delete original events

  Notes:
  - This script is conservative. It detects event rows that *look like* class/session events
    using simple heuristics (type === 'class' OR title contains 'class|lecture|session' OR course_id is set and type is 'assignment').
  - By default it only previews candidates and prints a summary. Use --apply to actually create AttendanceSession rows.
  - When applying, original Event rows are left intact unless you supply --delete along with --apply.
*/

const { PrismaClient } = require('@prisma/client');

async function main() {
  const args = process.argv.slice(2);
  const doApply = args.includes('--apply');
  const doDelete = args.includes('--delete');

  const prisma = new PrismaClient();

  try {
    console.log('Scanning events for attendance-like candidates...');
    const allEvents = await prisma.event.findMany({ orderBy: { date: 'asc' } });

    const candidates = allEvents.map(ev => {
      const title = String(ev.title || '').toLowerCase();
      let score = 0;
      if (String(ev.type || '').toLowerCase() === 'class') score += 3;
      if (title.match(/\b(class|lecture|session)\b/)) score += 2;
      if (ev.course_id) score += 1;
      // If time exists and a course_id exists, that's likely a class
      if (ev.time && ev.course_id) score += 1;
      return { event: ev, score };
    }).filter(x => x.score > 0).sort((a,b) => b.score - a.score || new Date(a.event.date) - new Date(b.event.date));

    if (candidates.length === 0) {
      console.log('No candidate events found for migration. Exiting.');
      return;
    }

    console.log(`Found ${candidates.length} candidate event(s). Showing top 50:`);
    candidates.slice(0,50).forEach(({ event, score }, i) => {
      console.log(`${i+1}. [score=${score}] id=${event.id} date=${event.date.toISOString().split('T')[0]} course=${event.course_id || '<none>'} type=${event.type} title="${event.title}"`);
    });

    const summaryByCourse = {};
    for (const c of candidates) {
      const cid = c.event.course_id || 'unknown';
      summaryByCourse[cid] = (summaryByCourse[cid] || 0) + 1;
    }

    console.log('\nSummary by course_id (including unknown):');
    Object.keys(summaryByCourse).forEach(k => console.log(`  ${k}: ${summaryByCourse[k]}`));

    if (!doApply) {
      console.log('\nDry-run complete. Re-run with --apply to create AttendanceSession rows.');
      return;
    }

    console.log('\n--apply provided. Creating AttendanceSession rows for candidates...');

    let createdCount = 0;
    for (const { event } of candidates) {
      // Map event -> attendance session
      const sessionPayload = {
        date: event.date, // Date object
        status: 'PRESENT',
        points: 2,
        notes: (event.description || null),
        user_id: event.user_id,
        course_id: event.course_id
      };

      try {
        const created = await prisma.attendanceSession.create({ data: sessionPayload });
        createdCount++;
        console.log(`Created attendanceSession id=${created.id} from event id=${event.id} date=${created.date.toISOString().split('T')[0]}`);
        if (doDelete) {
          await prisma.event.delete({ where: { id: event.id } });
          console.log(`  Deleted original event id=${event.id}`);
        }
      } catch (err) {
        console.error('  Failed to create session for event id=' + event.id, err.message || err);
      }
    }

    console.log(`\nMigration complete. Created ${createdCount} attendanceSession(s).`);
    if (doDelete) console.log('Original events deleted as requested (--delete).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Migration script error:', err);
  process.exit(1);
});
