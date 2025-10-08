import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'data');

// Safely fetch remote holidays and return an array or empty array on error.
async function fetchRemoteHolidays(year, country) {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'university-planner' }, timeout: 8000 });
    if (!r.ok) {
      console.warn('Remote holidays fetch returned non-OK status', r.status, url);
      return [];
    }
    const txt = await r.text();
    if (!txt || !txt.trim()) {
      console.info('Remote holidays fetch returned empty body for', `${year}-${country}`, url);
      return [];
    }
    try {
      const remote = JSON.parse(txt);
      if (Array.isArray(remote) && remote.length > 0) return remote;
      return [];
    } catch (parseErr) {
      const snippet = txt.length > 1000 ? txt.slice(0, 1000) + '...[truncated]' : txt;
      console.warn('Failed parsing remote holidays JSON for', `${year}-${country}`, 'from', url, 'parseError:', parseErr.message);
      console.debug('Remote holidays body snippet:', snippet);
      return [];
    }
  } catch (err) {
    console.error('Failed fetching remote holidays for', `${year}-${country}`, err && err.message ? err.message : err);
    return [];
  }
}

export default async function handler(req, res) {
  const { year, country } = req.query;

  // Accept a single year or a range like 2024-2026
  // Accept a single year or a range like 2024-2026
  const requested = String(year || '').trim();
  const cc = String(country || 'IQ').toUpperCase();
  let years = [];
  if (!requested) years = [new Date().getFullYear()];
  else if (/^\d{4}$/.test(requested)) years = [Number(requested)];
  else if (/^\d{4}-\d{4}$/.test(requested)) {
    const [a,b] = requested.split('-').map(Number);
    for (let y = Math.min(a,b); y <= Math.max(a,b); y++) years.push(y);
  } else {
    // fall back to current year
    years = [new Date().getFullYear()];
  }

  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    // For each requested year, try to load or fetch and cache results; combine into one list
    let holidays = [];
    for (const yyyy of years) {
      const cacheFile = path.join(CACHE_DIR, `holidays-${cc}-${yyyy}.json`);
      let cached = null;
      if (fs.existsSync(cacheFile)) {
        try {
          const raw = fs.readFileSync(cacheFile, 'utf8');
          cached = JSON.parse(raw || '[]');
        } catch (e) {
          cached = null;
        }
      }
      if (cached) {
        holidays.push(...cached);
      } else {
        try {
          const remote = await fetchRemoteHolidays(yyyy, cc);
          holidays.push(...remote);
          try { fs.writeFileSync(cacheFile, JSON.stringify(remote, null, 2), 'utf8'); } catch(e){ /* non-fatal */ }
        } catch (e) {
          console.error(`Failed fetching remote holidays for ${yyyy}-${cc}`, e);
        }
      }
    }

    // Merge with local Kurdistan/Iraq overrides if present
    const localOverridesFile = path.join(CACHE_DIR, `holidays-iq-kurdistan.json`);
    let overrides = [];
    try {
      if (fs.existsSync(localOverridesFile)) {
        const raw = fs.readFileSync(localOverridesFile, 'utf8');
        overrides = JSON.parse(raw || '[]');
      }
    } catch (e) {
      console.error('Failed reading local holidays overrides', e);
    }
    // Filter overrides down to only the requested years to avoid unrelated entries
    const overrideFiltered = (overrides || []).filter(o => {
      try {
        const y = Number(String(o.date || '').slice(0,4));
        return years.includes(y);
      } catch (e) { return false; }
    });

    // Also load any normalized academic holiday files (created from local PDFs)
    try {
      const files = fs.readdirSync(CACHE_DIR);
      const acadFiles = files.filter(f => f.startsWith('holidays-academic-') && f.endsWith('-normalized.json'));
      for (const af of acadFiles) {
        try {
          const raw = fs.readFileSync(path.join(CACHE_DIR, af), 'utf8');
          const parsed = JSON.parse(raw || '[]');
          const filtered = parsed.filter(o => {
            const y = Number(String(o.date || '').slice(0,4));
            return years.includes(y);
          });
          overrideFiltered.push(...filtered);
        } catch (e) {
          // non-fatal
        }
      }
    } catch (e) {
      // non-fatal
    }

    // Combine and dedupe by date+name
    const combined = [];
    const seen = new Set();
    (holidays || []).concat(overrideFiltered || []).forEach(h => {
      const key = `${h.date}::${(h.localName || h.name || '').toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(h);
      }
    });

    // Add computed Eid dates (tabular Islamic calendar approximation) for requested years
    const computed = [];
    // Add common recurring holidays (Easter Gregorian, Christmas, Newroz, Iraq Independence Day)
    function computeGregorianEaster(Y) {
      // Meeus/Jones/Butcher Gregorian algorithm
      const a = Y % 19;
      const b = Math.floor(Y / 100);
      const c = Y % 100;
      const d = Math.floor(b / 4);
      const e = b % 4;
      const f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4);
      const k = c % 4;
      const l = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * l) / 451);
      const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March,4=April
      const day = ((h + l - 7 * m + 114) % 31) + 1;
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${Y}-${mm}-${dd}`;
    }

    function addRecurringHolidays(Y) {
      // Easter (Gregorian)
      computed.push({ date: computeGregorianEaster(Y), localName: 'Easter', name: 'Easter', counties: [], countryCode: cc, fixed: false, global: true });
      // Christmas (Dec 25)
      computed.push({ date: `${Y}-12-25`, localName: 'Christmas Day', name: 'Christmas Day', counties: [], countryCode: cc, fixed: true, global: true });
      // Newroz (Mar 21) - Kurdish New Year
      computed.push({ date: `${Y}-03-21`, localName: 'Newroz', name: 'Newroz (Kurdish New Year)', counties: ['Kurdistan Region'], countryCode: cc, fixed: true, global: false });
      // Iraq Independence Day (Oct 3) - national day
      computed.push({ date: `${Y}-10-03`, localName: 'Independence Day', name: 'Iraq Independence Day', counties: [], countryCode: cc, fixed: true, global: true });
    }
  // If a precise Eid lookup file exists, prefer it for exact dates
  const eidLookupFile = path.join(CACHE_DIR, 'holiday-eid-lookup.json');
  let eidLookup = [];
  try { if (fs.existsSync(eidLookupFile)) eidLookup = JSON.parse(fs.readFileSync(eidLookupFile,'utf8')||'[]'); } catch(e) { eidLookup = []; }
    // helper: convert civil/tabular Islamic date to Julian Day Number
    function islamicToJD(iy, im, id) {
      // using arithmetic Islamic calendar
      const n = id + Math.ceil(29.5 * (im - 1)) + (iy - 1) * 354 + Math.floor((3 + 11 * iy) / 30);
      // 1948439 is the Julian day number for 1 Muharram, year 1 AH in some references
      return n + 1948439;
    }

    // Fliegel & Van Flandern algorithm: convert Julian day number to Gregorian date
    function jdToGregorian(jd) {
      let j = Math.floor(jd) + 0; // ensure integer
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

    // For a Gregorian year Y, estimate likely Hijri years and compute Eid dates
    const addEidForYear = (Y) => {
      // Check lookup first
      const found = eidLookup.find(x => Number(x.year) === Number(Y));
      if (found) {
        if (found.eidFitr) computed.push({ date: found.eidFitr, localName: 'Eid al-Fitr', name: 'Eid al-Fitr', counties: [], countryCode: cc, fixed: false, global: true });
        if (found.eidAdha) computed.push({ date: found.eidAdha, localName: 'Eid al-Adha', name: 'Eid al-Adha', counties: [], countryCode: cc, fixed: false, global: true });
        return;
      }
      const approxHijri = Math.floor((Y - 622) * 33 / 32);
      const candidates = [approxHijri - 1, approxHijri, approxHijri + 1, approxHijri + 2];
      for (const hy of candidates) {
        if (hy <= 0) continue;
        // Eid al-Fitr: 1 Shawwal (month 10, day 1)
        try {
          const jdFitr = islamicToJD(hy, 10, 1);
          const gFitr = jdToGregorian(jdFitr);
          if (gFitr.year === Y) {
            const mm = String(gFitr.month).padStart(2, '0');
            const dd = String(gFitr.day).padStart(2, '0');
            computed.push({ date: `${gFitr.year}-${mm}-${dd}`, localName: 'Eid al-Fitr', name: 'Eid al-Fitr', counties: [], countryCode: cc, fixed: false, global: true });
          }
        } catch (e) {}
        // Eid al-Adha: 10 Dhu al-Hijjah (month 12, day 10)
        try {
          const jdAdha = islamicToJD(hy, 12, 10);
          const gAdha = jdToGregorian(jdAdha);
          if (gAdha.year === Y) {
            const mm = String(gAdha.month).padStart(2, '0');
            const dd = String(gAdha.day).padStart(2, '0');
            computed.push({ date: `${gAdha.year}-${mm}-${dd}`, localName: 'Eid al-Adha', name: 'Eid al-Adha', counties: [], countryCode: cc, fixed: false, global: true });
          }
        } catch (e) {}
      }
    };

    for (const y of years) {
      addEidForYear(y);
      addRecurringHolidays(y);
    }

    // Merge computed eid entries, avoiding duplicates
    for (const e of computed) {
      const key = `${e.date}::${(e.localName || e.name || '').toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(e);
      }
    }

    return res.status(200).json({ source: 'combined', holidays: combined });
  } catch (err) {
    console.error('Holidays API error', err);
    // If fetching failed, attempt to return any existing cache
    try {
      const cacheFile = path.join(CACHE_DIR, `holidays-${String(country || 'IQ').toUpperCase()}-${Number(year) || new Date().getFullYear()}.json`);
      if (fs.existsSync(cacheFile)) {
        const raw = fs.readFileSync(cacheFile, 'utf8');
        const parsed = JSON.parse(raw || '[]');
        return res.status(200).json({ source: 'cache-on-error', holidays: parsed });
      }
    } catch (e) {
      console.error('Failed reading cache during error fallback', e);
    }
    return res.status(502).json({ error: 'Unable to fetch holidays' });
  }
}
