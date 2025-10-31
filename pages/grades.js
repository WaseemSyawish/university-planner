import React, { useState, useEffect, useRef } from 'react';
import CustomSelect from '../src/components/CustomSelect';
import { GraduationCap, TrendingUp, Award, BookOpen, Plus, Trash2, Edit2, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileText, Tag, Scale, Check, BarChart3, Target, HelpCircle, MessageCircle, Microscope, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Head from 'next/head';

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
  const [isDark, setIsDark] = useState(false);
  const catNameRef = useRef(null);
  const itemNameRef = useRef(null);
  const typeRef = useRef(null);
  const weightRef = useRef(null);
  const scoreRef = useRef(null);
  const maxScoreRef = useRef(null);

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
    // return Tailwind classes with sensible dark-mode fallbacks
    if (grade.startsWith('A')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (grade.startsWith('B')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    if (grade.startsWith('D')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  };

  const getCategoryIcon = (type) => {
    // Return Lucide icon components with per-type color accents
    const size = 'w-6 h-6';
    const colorMap = {
      exam: 'text-rose-600 dark:text-rose-400',
      quiz: 'text-amber-500 dark:text-amber-300',
      assignment: 'text-sky-600 dark:text-sky-300',
      project: 'text-purple-600 dark:text-purple-300',
      lab: 'text-green-600 dark:text-green-300',
      participation: 'text-indigo-600 dark:text-indigo-300',
      default: 'text-slate-800 dark:text-slate-100'
    };
    const cls = `${size} ${colorMap[type] || colorMap.default}`;
    switch(type) {
      case 'exam': return <FileText className={cls} />;
      case 'quiz': return <HelpCircle className={cls} />;
      case 'assignment': return <FileText className={cls} />;
      case 'project': return <Target className={cls} />;
      case 'lab': return <Microscope className={cls} />;
      case 'participation': return <MessageCircle className={cls} />;
      default: return <MapPin className={cls} />;
    }
  };

  // Options for the category type selector (used in the Add Category modal)
  const categoryTypeOptions = [
    { value: 'assignment', label: (<span className="flex items-center gap-2"><FileText className="w-4 h-4 text-sky-600 dark:text-sky-300" />Assignment</span>) },
    { value: 'quiz', label: (<span className="flex items-center gap-2"><HelpCircle className="w-4 h-4 text-amber-500 dark:text-amber-300" />Quiz</span>) },
    { value: 'exam', label: (<span className="flex items-center gap-2"><FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" />Exam</span>) },
    { value: 'project', label: (<span className="flex items-center gap-2"><Target className="w-4 h-4 text-purple-600 dark:text-purple-300" />Project</span>) },
    { value: 'lab', label: (<span className="flex items-center gap-2"><Microscope className="w-4 h-4 text-green-600 dark:text-green-300" />Lab</span>) },
    { value: 'participation', label: (<span className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />Participation</span>) },
    { value: 'other', label: (<span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-700 dark:text-slate-300" />Other</span>) }
  ];

  const handleAddCategory = () => {
    if (!newCategory.name || !newCategory.weight) return;
    // Prepare local category payload
    const categoryPayload = {
      name: newCategory.name,
      weight: parseFloat(newCategory.weight),
      type: newCategory.type || 'assignment',
      items: []
    };

    // Optimistically update UI with a temporary id
    const tempId = Date.now();
  const optimistic = { ...categoryPayload, id: tempId };
    setCourses(prev => prev.map(course => course.id === selectedCourse.id ? { ...course, categories: [...(course.categories || []), optimistic] } : course));

    setNewCategory({ name: '', weight: '', type: 'assignment' });
    setShowCategoryModal(false);

    // Persist to server: call PUT /api/grades with action add_assessment
    (async () => {
      try {
        const body = { courseId: selectedCourse.id, action: 'add_assessment', assessment: categoryPayload };
        const res = await fetch('/api/grades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error('Failed to persist category');
        const js = await res.json().catch(() => null);
        if (js && js.data) {
          // server returned canonical course object
          setCourses(prev => prev.map(course => course.id === selectedCourse.id ? ({ ...course, categories: Array.isArray(js.data.assessments) ? js.data.assessments : (js.data.categories || []) }) : course));
          return;
        }
        // fallback: refresh full grades list
        const listRes = await fetch('/api/grades');
        if (listRes.ok) {
          const listJs = await listRes.json().catch(() => null);
          const arr = listJs && Array.isArray(listJs.data) ? listJs.data : [];
          const found = arr.find(c => String(c.id) === String(selectedCourse.id));
          if (found) setCourses(prev => prev.map(course => course.id === selectedCourse.id ? ({ ...course, categories: Array.isArray(found.assessments) ? found.assessments : (found.categories || []) }) : course));
        }
      } catch (e) {
        console.warn('persist category failed', e);
      }
    })();
  };

  const handleAddItem = () => {
    if (!newItem.name || !newItem.score || !newItem.maxScore) return;
    const item = {
      id: Date.now(),
      name: newItem.name,
      score: parseFloat(newItem.score),
      maxScore: parseFloat(newItem.maxScore)
    };

    // Optimistic UI update
    setCourses(prev => prev.map(course => course.id === selectedCourse.id ? ({ ...course, categories: course.categories.map(cat => cat.id === selectedCategory.id ? ({ ...cat, items: [...(cat.items || []), item] }) : cat) }) : course));
    setNewItem({ name: '', score: '', maxScore: 100 });
    setShowItemModal(false);

    // Persist updated assessment items to server. If the category has an id (server), update via update_assessment.
    (async () => {
      try {
        const targetCourse = courses.find(c => c.id === selectedCourse.id) || selectedCourse;
        const targetCategory = (targetCourse.categories || []).find(c => c.id === selectedCategory.id) || selectedCategory;
        // If category has an id that looks server-generated (string/uuid), use update_assessment
        if (targetCategory && targetCategory.id && typeof targetCategory.id === 'string') {
          const assessmentPayload = { id: targetCategory.id, items: [...(targetCategory.items || []), item] };
          const body = { courseId: selectedCourse.id, action: 'update_assessment', assessment: assessmentPayload };
          const res = await fetch('/api/grades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (res.ok) {
            const js = await res.json().catch(() => null);
            if (js && js.data) {
              setCourses(prev => prev.map(course => course.id === selectedCourse.id ? ({ ...course, categories: Array.isArray(js.data.assessments) ? js.data.assessments : (js.data.categories || []) }) : course));
            }
          }
        } else {
          // If category is still optimistic (numeric id), we may need to create it first via add_assessment then update items.
          const createBody = { courseId: selectedCourse.id, action: 'add_assessment', assessment: { name: targetCategory.name, weight: targetCategory.weight || 0, items: targetCategory.items || [] } };
          const createRes = await fetch('/api/grades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createBody) });
          if (createRes.ok) {
            const createJs = await createRes.json().catch(() => null);
            if (createJs && createJs.data) {
              setCourses(prev => prev.map(course => course.id === selectedCourse.id ? ({ ...course, categories: Array.isArray(createJs.data.assessments) ? createJs.data.assessments : (createJs.data.categories || []) }) : course));
            }
          }
        }
      } catch (e) {
        console.warn('persist item failed', e);
      }
    })();
  };

  const handleDeleteCategory = (courseId, categoryId) => {
    // Optimistically remove
    setCourses(prev => prev.map(course => course.id === courseId ? ({ ...course, categories: (course.categories || []).filter(c => c.id !== categoryId) }) : course));
    // If categoryId looks like a server id (string), ask server to delete
    (async () => {
      try {
        if (categoryId && typeof categoryId === 'string') {
          const body = { courseId, action: 'delete_assessment', assessment: { id: categoryId } };
          const res = await fetch('/api/grades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (res.ok) {
            const js = await res.json().catch(() => null);
            if (js && js.data) {
              setCourses(prev => prev.map(course => course.id === courseId ? ({ ...course, categories: Array.isArray(js.data.assessments) ? js.data.assessments : (js.data.categories || []) }) : course));
            }
          }
        }
      } catch (e) { console.warn('delete category failed', e); }
    })();
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
    // Ensure certain modal inputs render white text in dark mode even when other CSS overrides exist
    const applyInputColors = () => {
      try {
        const darkNow = typeof document !== 'undefined' && (document.documentElement.classList.contains('dark') || window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        // update state so render can apply inline styles
        setIsDark(!!darkNow);

        // We'll dynamically read the computed styles from the Type CustomSelect's inner button
        // so other inputs copy the exact visual (including focus-specific outlines).
        const csElem = (typeof document !== 'undefined') ? document.getElementById('grades-cat-type') : null;

        const setColor = (el) => {
          if (!el) return;
          if (darkNow) {
            try {
              // Normal inline styles for text color
              el.style.color = '#ffffff';
              el.style.caretColor = '#ffffff';
              el.style.textShadow = '0 0 1px rgba(255,255,255,0.02)';
              el.style.WebkitTextFillColor = '#ffffff';

              // Recompute the Type control's visible outline/box-shadow now (handles focus changes)
              let csBoxShadow = '0 0 0 2px rgba(255,255,255,0.04)';
              let csBorderColor = 'rgba(255,255,255,0.12)';
              let csOutline = '1px solid rgba(255,255,255,0.45)';
              try {
                const csButton = csElem ? (csElem.querySelector('button[aria-haspopup]') || csElem.querySelector('button')) : null;
                const source = csButton || csElem;
                if (source) {
                  const comp = window.getComputedStyle(source);
                  if (comp) {
                    if (comp.boxShadow) csBoxShadow = comp.boxShadow || csBoxShadow;
                    if (comp.borderColor) csBorderColor = comp.borderColor || csBorderColor;
                    if (comp.outline) csOutline = comp.outline || csOutline;
                  }
                }
              } catch (e) {}

              // Apply the computed values to match Type control exactly
              el.style.boxShadow = csBoxShadow;
              el.style.borderColor = csBorderColor;
              el.style.outline = csOutline;

              // Also set with priority to override UA/autofill styles
              el.style.setProperty('color', '#ffffff', 'important');
              el.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
              el.style.setProperty('caret-color', '#ffffff', 'important');
              el.style.setProperty('text-shadow', '0 0 1px rgba(255,255,255,0.02)', 'important');
              el.style.setProperty('box-shadow', csBoxShadow, 'important');
              el.style.setProperty('border-color', csBorderColor, 'important');
              el.style.setProperty('outline', csOutline, 'important');
            } catch (e) {}
          } else {
            try {
              el.style.color = '';
              el.style.caretColor = '';
              el.style.textShadow = '';
              el.style.WebkitTextFillColor = '';
              el.style.boxShadow = '';
              el.style.borderColor = '';
              el.style.outline = '';
              el.style.removeProperty('color');
              el.style.removeProperty('-webkit-text-fill-color');
              el.style.removeProperty('caret-color');
              el.style.removeProperty('text-shadow');
              el.style.removeProperty('box-shadow');
              el.style.removeProperty('border-color');
              el.style.removeProperty('outline');
            } catch (e) {}
          }
        };

  // Apply immediately (including the CustomSelect wrapper by id)
  setColor(catNameRef.current);
  setColor(itemNameRef.current);
  setColor(typeRef.current);
  setColor(weightRef.current);
  setColor(scoreRef.current);
  setColor(maxScoreRef.current);
  // CustomSelect wrapper has id 'grades-cat-type'
  try { setColor(document.getElementById('grades-cat-type')); } catch (e) {}

        // Re-apply shortly after (handles autofill and late UA style application)
        setTimeout(() => {
          setColor(catNameRef.current);
          setColor(itemNameRef.current);
          setColor(typeRef.current);
          setColor(weightRef.current);
          setColor(scoreRef.current);
          setColor(maxScoreRef.current);
          try { setColor(document.getElementById('grades-cat-type')); } catch (e) {}
        }, 120);

        // Ensure color is reapplied on focus (some browsers style focused input differently)
        [catNameRef.current, itemNameRef.current, typeRef.current, weightRef.current, scoreRef.current, maxScoreRef.current].forEach(el => {
          if (!el) return;
          el.addEventListener('focus', () => setColor(el));
          el.addEventListener('input', () => setColor(el));
        });
        // Also attach focus listeners to the CustomSelect wrapper/button
        try {
          const cs = document.getElementById('grades-cat-type');
          if (cs) {
            cs.addEventListener('focusin', () => setColor(cs));
            cs.addEventListener('click', () => setColor(cs));
            try {
              const csBtn = cs.querySelector('button[aria-haspopup]') || cs.querySelector('button');
              if (csBtn) {
                csBtn.addEventListener('focus', () => setColor(csBtn));
                csBtn.addEventListener('click', () => setColor(csBtn));
              }
            } catch (e) {}
          }
        } catch (e) {}
      } catch (e) {}
    };
    // Apply once now
    applyInputColors();
    // Watch for html dark class changes
    let mo;
    try {
      mo = new MutationObserver(applyInputColors);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
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
        } else {
          // In dev environments where auth tokens may not be present, try a smoke-user fallback
          try {
            if (typeof window !== 'undefined') {
              const host = window.location.hostname;
              if (host === 'localhost' || host === '127.0.0.1' || host === '') {
                const fallback = await fetch('/api/grades?userId=smoke_user');
                if (fallback && fallback.ok) {
                  try { gradesBody = await fallback.json(); } catch (e) { /* ignore */ }
                }
              }
            }
          } catch (e) { /* ignore */ }
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
    return () => { mounted = false; if (mo) mo.disconnect(); };
  }, []);

  return (
    <div className="min-h-screen relative z-10 text-slate-900 dark:text-slate-100 dark:bg-[#071023]">
      <Head>
        <title>Grades — University Planner</title>
      </Head>
      <style dangerouslySetInnerHTML={{__html: `
        /* Modal form text coloring: keep white in dark mode, black in light mode */
        .dark #grades-cat-name,
        .dark #grades-cat-type,
        .dark #grades-item-name {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #ffffff !important;
          text-shadow: 0 0 1px rgba(255,255,255,0.03) !important;
        }

        /* Ensure explicit black text in light mode so overlays/components with stronger CSS don't force another color */
        :not(.dark) #grades-cat-name,
        :not(.dark) #grades-cat-type,
        :not(.dark) #grades-item-name {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          caret-color: #000000 !important;
          text-shadow: none !important;
        }

        /* Make placeholder text darker grey for modal forms (all inputs/selects/textareas inside modal overlays) */
        .fixed.inset-0 input::placeholder,
        .fixed.inset-0 textarea::placeholder,
        .fixed.inset-0 select::placeholder {
          color: #4B5563 !important; /* Tailwind gray-600 - darker placeholder */
          opacity: 1 !important;
        }
      `}} />
      {/* Navbar: use the exact Calendar header markup/styles for consistency */}
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-200/60 px-6 py-4 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Academic Grades</h1>
              <p className="text-xs text-slate-700 dark:text-slate-300">Track your course assessments</p>
            </div>
          </div>
          <Button className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-purple-500/35 px-5 h-10 rounded-xl font-medium" onClick={() => { /* visual-only */ }}>
            <Plus className="w-4 h-4 mr-2" />Create Category
          </Button>
        </div>
      </header>

      {/* Hero Section removed to match Calendar header — page now flows directly into the stats/cards */}

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Stats Cards */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 dark:bg-[#071423] dark:border-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium dark:text-slate-300">Current GPA</p>
                <h3 className="text-4xl font-bold text-purple-600 mt-2 dark:text-purple-300">{stats.gpa}</h3>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 dark:bg-[#071423] dark:border-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium dark:text-slate-300">Total Credits</p>
                <h3 className="text-4xl font-bold text-slate-800 dark:text-slate-100 mt-2">{stats.credits}</h3>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Courses Completed card removed - space redistributed among remaining cards */}

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 dark:bg-[#071423] dark:border-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium dark:text-slate-300">Average Grade</p>
                <h3 className="text-4xl font-bold text-slate-800 dark:text-slate-100 mt-2">{stats.avgGrade}</h3>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <GraduationCap className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-64">
            <CustomSelect
              options={semesters}
              value={selectedSemester}
              onChange={(v) => setSelectedSemester(v)}
              placeholder="Select semester"
              className="w-full"
              id="grades-semester-select"
            />
          </div>

          {/* Course filter - lets user restrict view to a single module */}
          <div className="w-96">
            <CustomSelect
              options={[{ value: 'all', label: 'All courses' }, ...courses.map(c => ({ value: String(c.id), label: `${c.name}${c.code ? ` (${c.code})` : ''}` }))]}
              value={String(filterCourseId)}
              onChange={(v) => setFilterCourseId(v)}
              placeholder="All courses"
              className="w-full"
              id="grades-course-select"
            />
          </div>
          <div className="text-sm text-gray-600 dark:text-slate-300">
            Showing {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Debug panel (visible when ?debug=1 in URL) */}
        {showDebug && (
          <div className="mt-6 p-4 bg-white border rounded-lg text-xs dark:bg-[#071423] dark:border-transparent">
            <h4 className="font-semibold mb-2 dark:text-slate-100">Debug: courses / semesters / stats</h4>
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              <pre className="whitespace-pre-wrap dark:text-slate-200">{JSON.stringify({ courses, semesters, stats, filteredCoursesLength: filteredCourses.length }, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Courses Grid */}
        <div className="grid grid-cols-1 gap-6">
          {filteredCourses.map(course => {
            const { grade, percentage } = calculateCourseGrade(course.categories);
            const totalWeight = course.categories.reduce((sum, cat) => sum + cat.weight, 0);

            return (
              <div key={course.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 dark:bg-[#071423] dark:border-transparent">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm font-semibold text-purple-600">{course.code}</p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{course.name}</h3>
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
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">Grading Categories</h4>
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
                      <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden dark:border-transparent">
                        <div className="bg-white p-4 dark:bg-[#071423]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              {getCategoryIcon(category.type || 'assignment')}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-semibold text-slate-900 dark:text-slate-100">{category.name}</h5>
                                  <span className="text-sm text-gray-600 dark:text-slate-300">({category.weight}%)</span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-slate-300">
                                  {category.items.length} item{category.items.length !== 1 ? 's' : ''} • Average: {categoryAvg.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openItemModal(course, category)}
                                className="px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors text-sm font-medium dark:bg-purple-800 dark:text-purple-200 dark:hover:bg-purple-700"
                              >
                                + Add Item
                              </button>
                              <button
                                onClick={() => toggleCategory(course.id, category.id)}
                                className="p-2 hover:bg-gray-200 rounded transition-colors dark:hover:bg-[#061422]"
                              >
                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(course.id, category.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors dark:hover:bg-red-900/20"
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
                                <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg dark:bg-[#061422] dark:border-transparent">
                                  <div className="flex-1">
                                    <p className="font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                                    <p className="text-sm text-gray-600 dark:text-slate-300">{item.score} / {item.maxScore} points</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <p className="font-bold text-lg text-slate-900 dark:text-slate-100">{itemPercentage}%</p>
                                    </div>
                                    <button
                                      onClick={() => handleDeleteItem(course.id, category.id, item.id)}
                                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors dark:hover:bg-red-900/20"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            {category.items.length === 0 && (
                              <div className="text-center py-6 text-gray-500 dark:text-slate-300">
                                <p className="text-sm">No items yet. Click "Add Item" to get started!</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {course.categories.length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-slate-300">
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
          <div className="w-full max-h-[85vh] bg-white dark:bg-gray-950 overflow-y-auto rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Add Grading Category</h3>
              <button 
                onClick={() => setShowCategoryModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-500 dark:text-gray-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Add a new category to track your grades</p>

            <div className="space-y-5">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  Category Name
                </label>
                <input
                  type="text"
                  id="grades-cat-name"
                  placeholder="e.g., Team Meeting, Study Session"
                  ref={catNameRef}
                  style={isDark ? { color: '#ffffff', WebkitTextFillColor: '#ffffff', caretColor: '#ffffff', textShadow: '0 0 1px rgba(255,255,255,0.02)' } : undefined}
                  className="w-full px-4 py-3 bg-white dark:bg-[#0f1419] border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:!text-white font-semibold caret-white placeholder-gray-400 dark:placeholder-gray-400"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Tag className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  Type
                </label>
                <div id="grades-cat-type">
                  <CustomSelect
                    options={categoryTypeOptions}
                    value={newCategory.type}
                    onChange={(v) => setNewCategory({...newCategory, type: v})}
                    placeholder="Select type"
                    className="w-full"
                    id="grades-cat-type"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Scale className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  Weight (%)
                </label>
                <input
                  type="number"
                  placeholder="20"
                  min="0"
                  max="100"
                  ref={weightRef}
                  className="w-full px-4 py-3 bg-white dark:bg-[#0f1419] border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:!text-white font-semibold caret-white placeholder-gray-400 dark:placeholder-gray-400"
                  value={newCategory.weight}
                  onChange={(e) => setNewCategory({...newCategory, weight: e.target.value})}
                />
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">How much this category counts toward the final grade</p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-500 dark:bg-opacity-10 border border-blue-200 dark:border-blue-500 dark:border-opacity-30 rounded-lg p-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium text-gray-900 dark:text-white">Course:</span> {selectedCourse.code} - {selectedCourse.name}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 px-4 py-3 bg-white dark:bg-[#2a2f3e] border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#363b4d] transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-h-[85vh] bg-white dark:bg-gray-950 overflow-y-auto rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Add Item</h3>
              <button 
                onClick={() => setShowItemModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-500 dark:text-gray-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Add a new grade item to this category</p>

            <div className="space-y-5">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  Item Name
                </label>
                <input
                  type="text"
                  id="grades-item-name"
                  placeholder="e.g., Quiz 1, Assignment 3, Midterm"
                  ref={itemNameRef}
                  style={isDark ? { color: '#ffffff', WebkitTextFillColor: '#ffffff', caretColor: '#ffffff', textShadow: '0 0 1px rgba(255,255,255,0.02)' } : undefined}
                  className="w-full px-4 py-3 bg-white dark:bg-[#0f1419] border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:!text-white font-semibold caret-white placeholder-gray-400 dark:placeholder-gray-400"
                  value={newItem.name}
                  onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <BarChart3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    Score Earned
                  </label>
                  <input
                    type="number"
                    placeholder="85"
                    min="0"
                    ref={scoreRef}
                    className="w-full px-4 py-3 bg-white dark:bg-[#0f1419] border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:!text-white font-semibold caret-white placeholder-gray-400 dark:placeholder-gray-400"
                    value={newItem.score}
                    onChange={(e) => setNewItem({...newItem, score: e.target.value})}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Target className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    Max Score
                  </label>
                  <input
                    type="number"
                    placeholder="100"
                    min="0"
                    ref={maxScoreRef}
                    className="w-full px-4 py-3 bg-white dark:bg-[#0f1419] border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:!text-white font-semibold caret-white placeholder-gray-400 dark:placeholder-gray-400"
                    value={newItem.maxScore}
                    onChange={(e) => setNewItem({...newItem, maxScore: e.target.value})}
                  />
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-500 dark:bg-opacity-10 border border-blue-200 dark:border-blue-500 dark:border-opacity-30 rounded-lg p-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium text-gray-900 dark:text-white">Adding to:</span> {selectedCategory.name} ({selectedCategory.weight}%)
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  <span className="font-medium text-gray-900 dark:text-white">Course:</span> {selectedCourse.code}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowItemModal(false)}
                className="flex-1 px-4 py-3 bg-white dark:bg-[#2a2f3e] border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#363b4d] transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
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