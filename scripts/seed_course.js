const prisma = require('../lib/prisma');

async function seed() {
  try {
    // create demo user if none
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({ data: { email: 'demo@example.com', name: 'Demo User' } });
      console.log('Created demo user', user.id);
    } else {
      console.log('Found existing user', user.id);
    }

    // create a sample course
    const course = await prisma.course.create({ data: {
      name: 'Intro to Testing',
      code: 'TEST101',
      credits: 3,
      color: '#3B82F6',
      semester: '2025-1',
      instructor: 'Dr. Example',
      description: 'Seeded test course',
      user_id: user.id
    }});

    console.log('Created course', course.id);
    await prisma.$disconnect();
  } catch (e) {
    console.error('SEED_ERR', e);
    try { await prisma.$disconnect(); } catch (e2) {}
    process.exit(1);
  }
}

seed();
