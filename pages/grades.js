import React, { useState, useEffect } from 'react';
import { GraduationCap, TrendingUp, Award, BookOpen, Plus, Trash2, Edit2, X, ChevronDown, ChevronUp } from 'lucide-react';

const GradesPage = () => {
  const [selectedSemester, setSelectedSemester] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState(null);
  // filter by course id in the UI (stringified id or 'all')
  const [filterCourseId, setFilterCourseId] = useState('all');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});

  const [courses, setCourses] = useState([]);

  const [newCategory, setNewCategory] = useState({
    name: '',
    weight: '',
    type: 'assignment'
  });

  const [newItem, setNewItem] = useState({
    name: '',
    score: '',
    maxScore: 100
  });

  const calculateCategoryAverage = (items) => {
    if (items.length === 0) return 0;
    const totalScore = items.reduce((sum, item) => sum + (item.score / item.maxScore * 100), 0);
    return totalScore / items.length;
  };

  const calculateCourseGrade = (categories) => {
    if (!categories || categories.length === 0) return { grade: 'N/A', percentage: 0 };
    
    const totalWeight = categories.reduce((sum, cat) => sum + cat.weight, 0);
    let weightedScore = 0;

    categories.forEach(cat => {
      const categoryAvg = calculateCategoryAverage(cat.items);
      weightedScore += (categoryAvg * cat.weight) / 100;
    });

    const percentage = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;
    
    let grade = 'F';
    if (percentage >= 93) grade = 'A';
    else if (percentage >= 90) grade = 'A-';
    else if (percentage >= 87) grade = 'B+';
    else if (percentage >= 83) grade = 'B';
    else if (percentage >= 80) grade = 'B-';
    else if (percentage >= 77) grade = 'C+';
    else if (percentage >= 73) grade = 'C';
    else if (percentage >= 70) grade = 'C-';
    else if (percentage >= 67) grade = 'D+';
    else if (percentage >= 60) grade = 'D';
    
    return { grade, percentage: percentage.toFixed(1) };
  };

  // semesters will be populated from the server-side course records
  const [semesters, setSemesters] = useState([{ value: 'all', label: 'All Semesters' }]);
  const [showDebug] = useState(typeof window !== 'undefined' ? new URL(window.location.href).searchParams.has('debug') : false);

  const filteredCourses = courses.filter(c => {
    // semester filter
    if (selectedSemester !== 'all' && c.semester !== selectedSemester) return false;
    // course filter
    if (filterCourseId !== 'all' && String(c.id) !== String(filterCourseId)) return false;
    return true;
  });

  const getGradeBgColor = (grade) => {
    if (grade.startsWith('A')) return 'bg-green-100 text-green-800';
    if (grade.startsWith('B')) return 'bg-blue-100 text-blue-800';
    if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-800';
    if (grade.startsWith('D')) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getCategoryIcon = (type) => {
    switch(type) {
      case 'exam': return '📝';
      case 'quiz': return '❓';
      case 'assignment': return '📄';
      case 'project': return '🎯';
      case 'lab': return '🔬';
      case 'participation': return '💬';
      default: return '📌';
    }
  };

  const handleAddCategory = () => {
    if (!newCategory.name || !newCategory.weight) return;
    
    const category = {
      id: Date.now(),
      name: newCategory.name,
      weight: parseFloat(newCategory.weight),
      type: newCategory.type,
      items: []
    };

    setCourses(courses.map(course => 
      course.id === selectedCourse.id 
        ? { ...course, categories: [...course.categories, category] }
        : course
    ));

    setNewCategory({ name: '', weight: '', type: 'assignment' });
    setShowCategoryModal(false);
  };

  const handleAddItem = () => {
    if (!newItem.name || !newItem.score || !newItem.maxScore) return;
    
    const item = {
      id: Date.now(),
      name: newItem.name,
      score: parseFloat(newItem.score),
      maxScore: parseFloat(newItem.maxScore)
    };

    setCourses(courses.map(course => 
      course.id === selectedCourse.id 
        ? {
            ...course,
            categories: course.categories.map(cat =>
              cat.id === selectedCategory.id
                ? { ...cat, items: [...cat.items, item] }
                : cat
            )
          }
        : course
    ));

    setNewItem({ name: '', score: '', maxScore: 100 });
    setShowItemModal(false);
  };

  const handleDeleteCategory = (courseId, categoryId) => {
    setCourses(courses.map(course => 
      course.id === courseId 
        ? { ...course, categories: course.categories.filter(c => c.id !== categoryId) }
        : course
    ));
  };

  const handleDeleteItem = (courseId, categoryId, itemId) => {
    setCourses(courses.map(course => 
      course.id === courseId 
        ? {
            ...course,
            categories: course.categories.map(cat =>
              cat.id === categoryId
                ? { ...cat, items: cat.items.filter(i => i.id !== itemId) }
                : cat
            )
          }
        : course
    ));
  };

  const toggleCategory = (courseId, categoryId) => {
    const key = `${courseId}-${categoryId}`;
    setExpandedCategories(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const openCategoryModal = (course) => {
    setSelectedCourse(course);
    setShowCategoryModal(true);
  };

  const openItemModal = (course, category) => {
    setSelectedCourse(course);
    setSelectedCategory(category);
    setShowItemModal(true);
  };

  // dynamic stats (will be populated from /api/grades)
  const [stats, setStats] = useState({
    gpa: 0,
    credits: 0,
    courses: 0,
    avgGrade: 'N/A'
  });

  // Fetch courses (modules) and grades (assessments) from server, merge them where possible
  // Updated to mirror `pages/modules.js` auth check and to be resilient when grades data is absent
  useEffect(() => {
    let mounted = true;
    async function loadAll() {
      try {
        // Ensure user is resolved. Treat explicit 401/403 as unauthenticated and redirect.
        // Do not redirect on 304 (Not Modified) since that is a cache-valid response without a body
        const me = await fetch('/api/auth/me');
        if (me.status === 401 || me.status === 403) {
          if (typeof window !== 'undefined') window.location.href = '/signin';
          return;
        }

        // Fetch courses and grades; tolerate missing grades endpoint
        const [coursesResP, gradesResP] = await Promise.allSettled([
          fetch('/api/courses'),
          fetch('/api/grades')
        ]);

        let coursesBody = { success: false, courses: [] };
        let gradesBody = { success: false, data: [] };

        if (coursesResP.status === 'fulfilled' && coursesResP.value.ok) {
          try { coursesBody = await coursesResP.value.json(); } catch(e) { coursesBody = { success: false, courses: [] }; }
        }

        if (gradesResP.status === 'fulfilled' && gradesResP.value.ok) {
          try { gradesBody = await gradesResP.value.json(); } catch(e) { gradesBody = { success: false, data: [] }; }
        }

        const serverCourses = Array.isArray(coursesBody.courses) ? coursesBody.courses : [];
        const serverGrades = Array.isArray(gradesBody.data) ? gradesBody.data : [];

        // Merge by id when possible; fallback to matching by code or name
        const merged = serverCourses.map(sc => {
          const match = serverGrades.find(gc => (gc.id && sc.id && gc.id === sc.id) || (gc.code && sc.code && gc.code === sc.code) || (gc.name && sc.name && gc.name === sc.name));
          return {
            // prefer canonical module fields from /api/courses
            ...sc,
            // ensure categories shape exists (some APIs call them assessments)
            categories: Array.isArray(sc.categories) ? sc.categories : (Array.isArray(sc.assessments) ? sc.assessments : (match && (match.assessments || match.categories) ? (match.assessments || match.categories) : [])),
            // keep credits/semester from module record if present
            credits: sc.credits ?? (match && match.credits) ?? 0,
            semester: sc.semester ?? (match && match.semester) ?? null
          };
        });

        // also include any grade-only entries that don't have a module record yet
        const gradeOnly = serverGrades.filter(gc => !merged.some(m => (m.id && gc.id && m.id === gc.id) || (m.code && gc.code && m.code === gc.code)) ).map(gc => ({
          ...gc,
          categories: Array.isArray(gc.assessments) ? gc.assessments : (Array.isArray(gc.categories) ? gc.categories : [])
        }));

        const allCourses = [...merged, ...gradeOnly];

        if (!mounted) return;
        setCourses(allCourses);

        // Derive semesters list dynamically from server records, but ensure 2025-1 and 2025-2 are present
        const semesterTokens = Array.from(new Set(allCourses.map(c => c.semester).filter(Boolean)));

        // Ensure these two common tokens exist so the dropdown always contains them
        const required = ['2025-1', '2025-2'];
        for (const r of required) if (!semesterTokens.includes(r)) semesterTokens.push(r);

        const humanize = (s) => {
          const m = String(s).match(/^(\d{4})-(\d)$/);
          if (m) return `${m[1]}/${Number(m[1]) + 1} - Semester ${m[2]}`;
          return String(s).replace(/[-_]/g, ' ');
        };

        const built = [{ value: 'all', label: 'All Semesters' }, ...semesterTokens.map(s => ({ value: s, label: humanize(s) }))];
        setSemesters(built);

        // compute credits and courses count
        const creditsSum = allCourses.reduce((s, c) => s + (c.credits ? Number(c.credits) : 0), 0);
        const coursesCount = allCourses.length;

        // compute average grade percentage if possible (reuse existing logic)
        const percentages = allCourses.map(c => {
          const cats = c.categories || [];
          if (!cats || cats.length === 0) return null;
          let totalWeight = 0;
          let weighted = 0;
          for (const cat of cats) {
            const weight = Number(cat.weight || 0);
            totalWeight += weight;
            const items = cat.items || [];
            if (!items.length) continue;
            const avg = items.reduce((ss, it) => ss + ((it.score || it.grade || 0) / (it.maxScore || it.maxGrade || 100) * 100), 0) / items.length;
            weighted += (avg * weight) / 100;
          }
          if (totalWeight === 0) return null;
          return (weighted / totalWeight) * 100;
        }).filter(p => p !== null && !isNaN(p));

        const avgPercentage = percentages.length ? (percentages.reduce((s, v) => s + v, 0) / percentages.length) : null;
        const avgGrade = avgPercentage !== null ? (function(p) {
          if (p >= 93) return 'A';
          if (p >= 90) return 'A-';
          if (p >= 87) return 'B+';
          if (p >= 83) return 'B';
          if (p >= 80) return 'B-';
          if (p >= 77) return 'C+';
          if (p >= 73) return 'C';
          if (p >= 70) return 'C-';
          if (p >= 67) return 'D+';
          if (p >= 60) return 'D';
          return 'F';
        })(avgPercentage) : 'N/A';

        setStats(prev => ({ ...prev, credits: creditsSum, courses: coursesCount, avgGrade }));
      } catch (err) {
        console.warn('Failed to load modules/grades from API:', err);
      }
    }
    loadAll();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <GraduationCap className="w-12 h-12" />
            <div>
              <h1 className="text-4xl font-bold">Academic Grades</h1>
              <p className="text-purple-100 mt-2">Track assessments with custom grading categories</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Stats Cards */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Current GPA</p>
                <h3 className="text-4xl font-bold text-purple-600 mt-2">{stats.gpa}</h3>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Credits</p>
                <h3 className="text-4xl font-bold text-gray-900 mt-2">{stats.credits}</h3>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Courses Completed card removed - space redistributed among remaining cards */}

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Average Grade</p>
                <h3 className="text-4xl font-bold text-gray-900 mt-2">{stats.avgGrade}</h3>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <GraduationCap className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="flex items-center gap-4 mb-6">
          <select 
            className="px-4 py-2 border-2 border-purple-600 rounded-lg text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-600"
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
          >
            {semesters.map(sem => (
              <option key={sem.value} value={sem.value}>{sem.label}</option>
            ))}
          </select>

          {/* Course filter - lets user restrict view to a single module */}
          <select
            className="px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-gray-300"
            value={filterCourseId}
            onChange={(e) => setFilterCourseId(e.target.value)}
          >
            <option value="all">All courses</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
            ))}
          </select>
          <div className="text-sm text-gray-600">
            Showing {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Debug panel (visible when ?debug=1 in URL) */}
        {showDebug && (
          <div className="mt-6 p-4 bg-white border rounded-lg text-xs">
            <h4 className="font-semibold mb-2">Debug: courses / semesters / stats</h4>
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              <pre className="whitespace-pre-wrap">{JSON.stringify({ courses, semesters, stats, filteredCoursesLength: filteredCourses.length }, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Courses Grid */}
        <div className="grid grid-cols-1 gap-6">
          {filteredCourses.map(course => {
            const { grade, percentage } = calculateCourseGrade(course.categories);
            const totalWeight = course.categories.reduce((sum, cat) => sum + cat.weight, 0);

            return (
              <div key={course.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm font-semibold text-purple-600">{course.code}</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{course.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{course.credits} Credits • {course.categories.length} Categories</p>
                  </div>
                  <div className={`px-6 py-3 rounded-lg text-xl font-bold ${getGradeBgColor(grade)}`}>
                    {grade} ({percentage}%)
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Total Weight Allocated</span>
                    <span className={`font-medium ${totalWeight === 100 ? 'text-green-600' : 'text-orange-600'}`}>
                      {totalWeight}% / 100%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${totalWeight === 100 ? 'bg-green-600' : 'bg-orange-500'}`}
                      style={{ width: `${Math.min(totalWeight, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="border-t border-gray-200 my-4"></div>

                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-gray-900">Grading Categories</h4>
                  <button 
                    onClick={() => openCategoryModal(course)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Category
                  </button>
                </div>

                <div className="space-y-3">
                  {course.categories.map(category => {
                    const categoryAvg = calculateCategoryAverage(category.items);
                    const isExpanded = expandedCategories[`${course.id}-${category.id}`];

                    return (
                      <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <span className="text-2xl">{getCategoryIcon(category.type)}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-semibold text-gray-900">{category.name}</h5>
                                  <span className="text-sm text-gray-600">({category.weight}%)</span>
                                </div>
                                <p className="text-sm text-gray-600">
                                  {category.items.length} item{category.items.length !== 1 ? 's' : ''} • Average: {categoryAvg.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openItemModal(course, category)}
                                className="px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors text-sm font-medium"
                              >
                                + Add Item
                              </button>
                              <button
                                onClick={() => toggleCategory(course.id, category.id)}
                                className="p-2 hover:bg-gray-200 rounded transition-colors"
                              >
                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(course.id, category.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-4 space-y-2">
                            {category.items.map(item => {
                              const itemPercentage = (item.score / item.maxScore * 100).toFixed(1);
                              return (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{item.name}</p>
                                    <p className="text-sm text-gray-600">{item.score} / {item.maxScore} points</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <p className="font-bold text-lg text-gray-900">{itemPercentage}%</p>
                                    </div>
                                    <button
                                      onClick={() => handleDeleteItem(course.id, category.id, item.id)}
                                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            {category.items.length === 0 && (
                              <div className="text-center py-6 text-gray-500">
                                <p className="text-sm">No items yet. Click "Add Item" to get started!</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {course.categories.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p>No categories yet. Add a grading category to get started!</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Add Grading Category</h3>
              <button 
                onClick={() => setShowCategoryModal(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g., Quizzes, Assignments, Midterm"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  value={newCategory.type}
                  onChange={(e) => setNewCategory({...newCategory, type: e.target.value})}
                >
                  <option value="assignment">📄 Assignment</option>
                  <option value="quiz">❓ Quiz</option>
                  <option value="exam">📝 Exam</option>
                  <option value="project">🎯 Project</option>
                  <option value="lab">🔬 Lab</option>
                  <option value="participation">💬 Participation</option>
                  <option value="other">📌 Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Weight (%)</label>
                <input
                  type="number"
                  placeholder="20"
                  min="0"
                  max="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  value={newCategory.weight}
                  onChange={(e) => setNewCategory({...newCategory, weight: e.target.value})}
                />
                <p className="text-xs text-gray-500 mt-1">How much this category counts toward the final grade</p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Course:</span> {selectedCourse.code} - {selectedCourse.name}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Add Item</h3>
              <button 
                onClick={() => setShowItemModal(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Item Name</label>
                <input
                  type="text"
                  placeholder="e.g., Quiz 1, Assignment 3, Midterm"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                  value={newItem.name}
                  onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Score Earned</label>
                  <input
                    type="number"
                    placeholder="85"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                    value={newItem.score}
                    onChange={(e) => setNewItem({...newItem, score: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Score</label>
                  <input
                    type="number"
                    placeholder="100"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                    value={newItem.maxScore}
                    onChange={(e) => setNewItem({...newItem, maxScore: e.target.value})}
                  />
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Adding to:</span> {selectedCategory.name} ({selectedCategory.weight}%)
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <span className="font-medium">Course:</span> {selectedCourse.code}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowItemModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradesPage;