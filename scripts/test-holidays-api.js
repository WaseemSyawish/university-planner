const handler = require('../pages/api/holidays.js').default || require('../pages/api/holidays.js');

function makeReq(year, country){ return { query: { year: String(year), country } }; }
function makeRes(){
  let statusCode = 200;
  return {
    status(code){ statusCode = code; return this; },
    json(obj){ console.log('STATUS', statusCode); console.log(JSON.stringify(obj.holidays ? { count: obj.holidays.length, sample: obj.holidays.slice(0,5) } : obj, null, 2)); }
  };
}

(async()=>{
  await handler(makeReq('2025','IQ'), makeRes());
})();
