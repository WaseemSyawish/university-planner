require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
(async function(){
  const prisma = new PrismaClient();
  try{
    const email = 'waseemdenha72@gmail.com';
    console.log('Looking up user', email);
    const user = await prisma.user.findUnique({ where: { email }, include: { courses: true, attendance_sessions: true, events: true } });
    if(!user){
      console.log('No user found with that email');
      return;
    }
    console.log('User id:', user.id);
    console.log('Counts: courses=', (user.courses||[]).length, ' attendance_sessions=', (user.attendance_sessions||[]).length, ' events=', (user.events||[]).length);
    console.log('Courses sample (up to 20):', JSON.stringify((user.courses||[]).slice(0,20), null, 2));
    console.log('Attendance sample (up to 50):', JSON.stringify((user.attendance_sessions||[]).slice(0,50), null, 2));
  }catch(e){
    console.error('ERR', e);
  }finally{
    try{ await prisma.$disconnect(); }catch(e){}
  }
})();
