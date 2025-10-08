// Run this as: node test-db.js
// Save as test-db.js in your project root

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('🔄 Testing database connection...');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test user creation/retrieval
  const testUserId = 'aef344d3-e602-402d-85de-055ba3c4629b';
    
    let user = await prisma.user.findUnique({
      where: { id: testUserId }
    });
    
    if (!user) {
      console.log('🔄 Creating test user...');
      user = await prisma.user.create({
        data: {
          id: testUserId,
          email: 'test@example.com',
          name: 'Test User'
        }
      });
      console.log('✅ Test user created:', user.name);
    } else {
      console.log('✅ Test user found:', user.name);
    }
    
    // Test course creation/retrieval
    const testCourseName = 'Web Technologies';
    let course = await prisma.course.findFirst({
      where: {
        name: testCourseName,
        user_id: testUserId
      }
    });
    
    if (!course) {
      console.log('🔄 Creating test course...');
      course = await prisma.course.create({
        data: {
          name: testCourseName,
          code: 'WEB101',
          user_id: testUserId
        }
      });
      console.log('✅ Test course created:', course.name);
    } else {
      console.log('✅ Test course found:', course.name);
    }
    
    // Test attendance session creation
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to midnight for date comparison
    
    let session = await prisma.attendanceSession.findFirst({
      where: {
        date: today,
        course_id: course.id,
        user_id: testUserId
      }
    });
    
    if (!session) {
      console.log('🔄 Creating test attendance session...');
      session = await prisma.attendanceSession.create({
        data: {
          date: today,
          status: 'PRESENT',
          points: 2,
          user_id: testUserId,
          course_id: course.id
        }
      });
      console.log('✅ Test attendance session created for:', today.toDateString());
    } else {
      console.log('✅ Test attendance session found for:', today.toDateString());
    }
    
    // Test fetching with relations
    console.log('🔄 Testing relations...');
    const sessionsWithCourse = await prisma.attendanceSession.findMany({
      where: {
        user_id: testUserId,
        course_id: course.id
      },
      include: {
        courses: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      },
      take: 5
    });
    
    console.log(`✅ Found ${sessionsWithCourse.length} attendance sessions with course relations`);
    
    if (sessionsWithCourse.length > 0) {
      const sample = sessionsWithCourse[0];
      console.log('📝 Sample session:', {
        date: sample.date.toISOString().split('T')[0],
        status: sample.status,
        points: sample.points,
        course: sample.courses.name
      });
    }
    
    console.log('\n🎉 All database tests passed! Your database is ready to use.');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    console.error('\n🔧 Possible fixes:');
    console.error('1. Check your DATABASE_URL in .env.local');
    console.error('2. Run: npx prisma generate');
    console.error('3. Run: npx prisma db push');
    console.error('4. Verify your database is running');
    
    if (error.code) {
      console.error(`\nError code: ${error.code}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();