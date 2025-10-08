const toLocalDateOnly=(dt)=>{const y=dt.getFullYear();const m=String(dt.getMonth()+1).padStart(2,'0');const d=String(dt.getDate()).padStart(2,'0');return `${y}-${m}-${d}`};
const generate=(startDateStr, repeatOption, max=6)=>{const parts=String(startDateStr||'').split('-');const start=(parts.length===3)?new Date(Number(parts[0]),Number(parts[1])-1,Number(parts[2])):new Date(startDateStr+'T00:00:00'); let year=start.getFullYear(); let end=new Date(year,0,15); if (end<=start) end=new Date(year+1,0,15); const out=[]; let cursor=new Date(start); let count=0; const pushIf=(d)=>{ if(d<=end && count<max){ out.push(toLocalDateOnly(d)); count++;}}; if(repeatOption==='every-week' || !repeatOption){ while(cursor<=end && count<max){ pushIf(new Date(cursor)); cursor.setDate(cursor.getDate()+7);} } return out};
console.log(generate('2025-09-28','every-week',6).join('\n'));
console.log('---');
console.log(generate('2025-09-29','every-week',6).join('\n'));
