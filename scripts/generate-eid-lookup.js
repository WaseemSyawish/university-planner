const fs = require('fs');
const path = require('path');

function islamicToJD(iy, im, id) {
  const n = id + Math.ceil(29.5 * (im - 1)) + (iy - 1) * 354 + Math.floor((3 + 11 * iy) / 30);
  return n + 1948439;
}
function jdToGregorian(jd) {
  let j = Math.floor(jd) + 0;
  let l = j + 68569;
  let n = Math.floor((4 * l) / 146097);
  l = l - Math.floor((146097 * n + 3) / 4);
  let i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  let j1 = Math.floor((80 * l) / 2447);
  let day = l - Math.floor((2447 * j1) / 80);
  l = Math.floor(j1 / 11);
  let month = j1 + 2 - 12 * l;
  let year = 100 * (n - 49) + i + l;
  return { year, month, day };
}

function computeEidsForYear(Y) {
  const computed = { eidFitr: null, eidAdha: null };
  const approxHijri = Math.floor((Y - 622) * 33 / 32);
  const candidates = [approxHijri - 1, approxHijri, approxHijri + 1, approxHijri + 2];
  for (const hy of candidates) {
    if (hy <= 0) continue;
    const jdFitr = islamicToJD(hy, 10, 1);
    const gFitr = jdToGregorian(jdFitr);
    if (gFitr.year === Y && !computed.eidFitr) {
      computed.eidFitr = `${gFitr.year}-${String(gFitr.month).padStart(2,'0')}-${String(gFitr.day).padStart(2,'0')}`;
    }
    const jdAdha = islamicToJD(hy, 12, 10);
    const gAdha = jdToGregorian(jdAdha);
    if (gAdha.year === Y && !computed.eidAdha) {
      computed.eidAdha = `${gAdha.year}-${String(gAdha.month).padStart(2,'0')}-${String(gAdha.day).padStart(2,'0')}`;
    }
  }
  return computed;
}

const start = 2025;
const end = 2035;
const list = [];
for (let y = start; y <= end; y++) {
  const e = computeEidsForYear(y);
  list.push({ year: y, eidFitr: e.eidFitr, eidAdha: e.eidAdha });
}

const outPath = path.join(process.cwd(),'data','holiday-eid-lookup.json');
fs.writeFileSync(outPath, JSON.stringify(list, null, 2), 'utf8');
console.log('Wrote', outPath);
