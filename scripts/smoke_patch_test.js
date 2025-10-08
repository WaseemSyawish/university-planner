// Simple smoke test: fetch events list and PATCH the first event
const fetch = require('node-fetch');
(async function(){
  try{
    // try localhost first, fallback to the network address Next printed
    let listRes;
    try {
      listRes = await fetch('http://localhost:3001/api/events?userId=smoke_user');
    } catch (e) {
      console.log('localhost failed, trying network IP 172.16.0.2:3001');
      listRes = await fetch('http://172.16.0.2:3001/api/events?userId=smoke_user');
    }
    console.log('list status', listRes.status);
    const payload = await (listRes.ok? listRes.json(): listRes.text());
    if(listRes.ok && Array.isArray(payload.events)){
      console.log('found', payload.events.length, 'events');
      const ev = payload.events[0];
      if(!ev){ console.log('no event to patch'); return; }
      const id = ev.id;
      const start = ev.startDate || ev.date || new Date().toISOString();
      const end = ev.endDate || new Date(new Date(start).getTime()+60*60000).toISOString();
      const body = {
        title: ev.title + ' [patched-smoke]',
        date: (start && start.slice) ? start.slice(0,10) : (new Date(start)).toISOString().slice(0,10),
        time: ev.time || `${String(new Date(start).getHours()).padStart(2,'0')}:${String(new Date(start).getMinutes()).padStart(2,'0')}`,
        durationMinutes: ev.durationMinutes || 60,
        startDate: start,
        endDate: end,
      };
      console.log('patching', id);
      const patchRes = await fetch('http://localhost:3001/api/events/'+encodeURIComponent(id), { method:'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)});
      console.log('patch status', patchRes.status);
      try{ const pb = await patchRes.json(); console.log('patch body', pb); }catch(e){ const t = await patchRes.text(); console.log('patch text', t); }
    } else {
      console.log('list body', payload);
    }
  }catch(e){ console.error('error', e); }
})();
