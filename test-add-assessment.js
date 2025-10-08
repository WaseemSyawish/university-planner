(
async () => {
  try {
    // Read current courses
    const gradesRes = await fetch('http://localhost:3000/api/grades');
    const gradesJson = await gradesRes.json().catch(() => ({}));
    const courses = gradesJson.data || [];
    if (courses.length === 0) {
      console.log('No courses found in API. Please add a course first.');
      process.exit(1);
    }

    const course = courses[0];
    console.log('Testing course:', course.name, 'id=', course.id);

    // compute current total
    const currentTotal = (course.assessments || []).reduce((s, a) => s + (a.weight || 0), 0);
    console.log('Current total weight:', currentTotal);

    // attempt to add an assessment that would push total over 100
    const addWeight = Math.max(101 - currentTotal, 20);
    console.log('Attempting to add assessment weight:', addWeight);

    const resp = await fetch('http://localhost:3000/api/grades', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: course.id,
        action: 'add_assessment',
        assessment: { name: 'TEST-OVER', weight: addWeight, items: [] }
      })
    });

    const js = await resp.json().catch(() => ({}));
    console.log('Response status:', resp.status);
    console.log('Response body:', js);
  } catch (e) {
    console.error('Test failed:', e);
  }
})();
