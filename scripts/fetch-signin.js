const fetch = require('node-fetch');
(async ()=>{
  try{
    const res = await fetch('http://localhost:3001/signin');
    const txt = await res.text();
    console.log('Status', res.status);
    console.log(txt.slice(0,1000));
  }catch(e){console.error(e)}
})();
