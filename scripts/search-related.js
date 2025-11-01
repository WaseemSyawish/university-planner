#!/usr/bin/env node
const prisma = require('../lib/prisma');
const args = process.argv.slice(2);
if (!args[0]) { console.error('Usage: node scripts/search-related.js <query>'); process.exit(1); }
const q = String(args[0]).toLowerCase();

function norm(s){ return String(s||'').toLowerCase().replace(/\s+/g,' ').trim(); }

(async ()=>{
  try {
    const all = await prisma.event.findMany({ select: { id: true, title: true, date: true, time: true, description: true } });
    const matches = all.filter(e => (norm(e.title).includes(q) || (e.description && norm(e.description).includes(q))));
    console.log('Found', matches.length, 'matches');
    console.log(JSON.stringify(matches.slice(0,200), null, 2));
  } catch (e) {
    console.error('Search failed', e && e.message || e);
  } finally { await prisma.$disconnect(); }
})();
