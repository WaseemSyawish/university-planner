import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { Calendar, BookOpen, TrendingUp, Clock, CheckCircle, AlertCircle, GraduationCap, Users } from 'lucide-react';
import CalendarHeader from '../src/components/CalendarHeader.jsx';

// Small presentational StatCard with light/dark mode support
function StatCard({ icon, label, value, loading, accent = 'purple', smallIconClass = '' }) {
  // include dark variants for the small icon container so icons remain visible
  const bg = smallIconClass || {
    purple: 'bg-purple-50 dark:bg-purple-800',
    blue: 'bg-blue-50 dark:bg-blue-700',
    orange: 'bg-orange-50 dark:bg-orange-700',
    green: 'bg-green-50 dark:bg-green-700'
  }[accent] || 'bg-gray-50 dark:bg-gray-700';
  return (
    <div className="rounded-xl p-5 shadow-sm border border-gray-100 bg-white dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-12 h-12 ${bg} rounded-lg flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="text-gray-500 dark:text-gray-300 text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{loading ? '—' : value}</p>
    </div>
  );
}

function Skeleton({ width = 'w-24', height = 'h-6' }) {
  return <div className={`rounded bg-gray-200 dark:bg-gray-700 ${width} ${height} animate-pulse`} />;
}

export default function UniversityOverview() {
  const [currentDate, setCurrentDate] = useState(new Date());
  // start empty so we don't display a hard-coded name; we'll fetch the real name
  const [userName, setUserName] = useState('');
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // State-backed data (initially empty; will be populated from backend)
  const [todayClasses, setTodayClasses] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [isLoadingDeadlines, setIsLoadingDeadlines] = useState(true);

  // Auxiliary data caches
  const [courses, setCourses] = useState([]);
  // Quick stat derived values
  const [quickStats, setQuickStats] = useState({ gpa: null, credits: null, dueThisWeek: null, attendanceRate: null });
  const [isLoadingQuickStats, setIsLoadingQuickStats] = useState(true);

  // This-week metrics
  const [weekClassesCount, setWeekClassesCount] = useState(0);
  const [assignmentsDueCount, setAssignmentsDueCount] = useState(0);
  const [studyHoursLogged, setStudyHoursLogged] = useState(0);
  // No debug payloads in production; keep code paths minimal
  const [nextClasses, setNextClasses] = useState([]);

  // Trigger to allow manual refresh of data (declared before effect)
  const [refreshCounter, setRefreshCounter] = useState(0);

  function refreshData() {
    setRefreshCounter((c) => c + 1);
  }

  // Helper: attempt to fetch a JSON endpoint and return parsed payload or null on failure
  async function safeFetchJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Basic data: user and courses
        try {
          setIsLoadingUser(true);
          // Prefer the authenticated endpoint; fall back to dev smoke_user when running locally
          async function fetchMe() {
            let res = await safeFetchJson('/api/auth/me');
            if (!res && typeof window !== 'undefined') {
              const host = window.location.hostname;
              if (host === 'localhost' || host === '127.0.0.1' || host === '') {
                res = await safeFetchJson('/api/auth/me?userId=smoke_user');
              }
            }
            return res;
          }

          const me = await fetchMe();
          if (mounted && me) {
            // Support two shapes: { user: { name, firstName, username } } and { name, id, email }
            const payloadUser = (me.user && typeof me.user === 'object') ? me.user : me;
            const resolvedName = payloadUser?.name || payloadUser?.firstName || payloadUser?.username || '';
            if (resolvedName) setUserName(resolvedName);
          }
        } finally { setIsLoadingUser(false); }

        const coursesBody = await safeFetchJson('/api/courses');
        if (mounted && coursesBody && Array.isArray(coursesBody.courses)) setCourses(coursesBody.courses);

        // TIMETABLE + FALLBACK: try timetable first, otherwise map events to today's lectures
        setIsLoadingClasses(true);
        try {
          // Try normally, then retry with a development userId fallback when not authenticated
          async function tryFetchTimetable(path) {
            let res = await safeFetchJson(path);
            if (!res && typeof window !== 'undefined') {
              const host = window.location.hostname;
              if (host === 'localhost' || host === '127.0.0.1' || host === '') {
                // development fallback: pass userId query param so API returns dev-owned resources
                res = await safeFetchJson(path + (path.includes('?') ? '&' : '?') + 'userId=smoke_user');
              }
            }
            return res;
          }

          const raw = await tryFetchTimetable('/api/timetable');
          let classesSrc = [];
          const todayStr = currentDate.toISOString().slice(0,10);

          // Normalize response shapes
          if (!raw) classesSrc = [];
          else if (Array.isArray(raw)) {
            if (raw.length && raw[0] && Array.isArray(raw[0].payload)) {
              classesSrc = raw.flatMap(tpl => (Array.isArray(tpl.payload) ? tpl.payload.map(p => ({ ...p, _templateId: tpl.id })) : []));
            } else classesSrc = raw;
          } else if (raw.templates && Array.isArray(raw.templates)) {
            classesSrc = raw.templates.flatMap(tpl => (Array.isArray(tpl.payload) ? tpl.payload.map(p => ({ ...p, _templateId: tpl.id })) : []));
          } else classesSrc = [];

          // If no module payloads found, try the timetables endpoint which includes materialized events
          if ((!Array.isArray(classesSrc) || classesSrc.length === 0)) {
              try {
              const tpls = await tryFetchTimetable('/api/timetables');
              if (tpls && Array.isArray(tpls.templates)) {
                // flatten any included events on templates
                const evSrc = tpls.templates.flatMap(t => Array.isArray(t.events) ? t.events : []);
                if (evSrc && evSrc.length) classesSrc = evSrc;
              }
            } catch (e) { /* ignore */ }
          }

          // Build today's list and week count from classesSrc when available
          let todayList = [];
          let weekCount = 0;
          // Helper to determine if an item represents a lecture
          const isLectureItem = (it) => {
            try {
              const t = (it && (it.type || (it.raw && it.raw.type) || it.eventType || '')).toString().toLowerCase();
              return t === 'lecture';
            } catch (e) { return false; }
          };
          // Convert a date-like value into a local YYYY-MM-DD string (safe against
          // date-only strings being parsed as UTC). Returns null on invalid input.
          const toLocalYmd = (v) => {
            try {
              const dt = new Date(String(v));
              if (isNaN(dt.getTime())) return null;
              const y = dt.getFullYear();
              const m = String(dt.getMonth() + 1).padStart(2, '0');
              const d = String(dt.getDate()).padStart(2, '0');
              return `${y}-${m}-${d}`;
            } catch (e) { return null; }
          };
          const todayYmd = toLocalYmd(currentDate);
          if (Array.isArray(classesSrc) && classesSrc.length) {
            try {
              const startWeek = new Date(currentDate);
              startWeek.setDate(currentDate.getDate() - currentDate.getDay());
              startWeek.setHours(0,0,0,0);
              const endWeek = new Date(startWeek);
              endWeek.setDate(startWeek.getDate() + 6);

              for (const c of classesSrc) {
                const start = c.time || '';
                const duration = c.duration || c.durationMinutes || 1;
                const end = start ? (() => {
                  try {
                    const [hh, mm] = String(start).split(':').map(Number);
                    const total = (hh||0) * 60 + (mm||0) + Math.round(Number(duration) * 60);
                    const endH = Math.floor((total % (24*60)) / 60);
                    const endM = total % 60;
                    return `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;
                  } catch (e) { return '' }
                })() : '';

                if (c.date && !c.repeat && c.repeatOption !== 'weekly' && c.dayOfWeek == null) {
                  const d = (typeof c.date === 'string' && c.date.length >= 10) ? c.date.slice(0,10) : (new Date(c.date)).toISOString().slice(0,10);
                    try {
                      const dd = new Date(d);
                      const ddY = toLocalYmd(dd);
                      if (ddY && todayYmd && ddY === todayYmd && isLectureItem(c)) todayList.push({ id: c.id || `tt-${d}`, code: c.code || c.module || (c.subject||'').split(' ')[0] || 'TBA', name: c.title || c.subject || c.module || 'Lecture', time: start ? `${start} - ${end}` : '', instructor: c.instructor || c.lecturer || '', location: c.location || '' });
                      if (!isNaN(dd.getTime())) {
                        const ddMid = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate());
                        if (ddMid >= startWeek && ddMid <= endWeek && isLectureItem(c)) weekCount++;
                      }
                    } catch (e) {}
                  continue;
                }

                const dow = (typeof c.dayOfWeek === 'number') ? c.dayOfWeek : (c.repeatOption === 'weekly' && typeof c.dayOfWeek === 'number' ? c.dayOfWeek : null);
                if (dow != null) {
                  if (dow === currentDate.getDay() && isLectureItem(c)) todayList.push({ id: c.id || `tt-${dow}-${start}`, code: c.code || c.module || (c.subject||'').split(' ')[0] || 'TBA', name: c.title || c.subject || c.module || 'Lecture', time: start ? `${start} - ${end}` : '', instructor: c.instructor || c.lecturer || '', location: c.location || '' });
                  if (isLectureItem(c)) weekCount++;
                  continue;
                }

                if (c.date) {
                  const d = (typeof c.date === 'string' && c.date.length >= 10) ? c.date.slice(0,10) : (new Date(c.date)).toISOString().slice(0,10);
                  try {
                    const dd = new Date(d);
                    const ddY = toLocalYmd(dd);
                    if (ddY && todayYmd && ddY === todayYmd && isLectureItem(c)) todayList.push({ id: c.id || `tt-${d}`, code: c.code || c.module || (c.subject||'').split(' ')[0] || 'TBA', name: c.title || c.subject || c.module || 'Lecture', time: start ? `${start} - ${end}` : '', instructor: c.instructor || c.lecturer || '', location: c.location || '' });
                    if (!isNaN(dd.getTime())) {
                      const ddMid = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate());
                      if (ddMid >= startWeek && ddMid <= endWeek && isLectureItem(c)) weekCount++;
                    }
                  } catch (e) {}
                }
              }
            } catch (e) {
              // ignore per-item errors
            }
          } else {
            // fallback to events
              try {
              const evs = await safeFetchJson('/api/events');
              setDebugEventsRaw(evs);
                if (evs && Array.isArray(evs.events)) {
                todayList = evs.events.filter(e => {
                  const t = (e && (e.type || (e.raw && e.raw.type) || '')).toString().toLowerCase();
                  if (t !== 'lecture') return false;
                  if (!e.date) return false;
                  try {
                    const ed = new Date(e.date);
                    const edY = toLocalYmd(ed);
                    return edY && todayYmd && edY === todayYmd;
                  } catch (er) { return false; }
                }).map((e,i) => ({
                  id: e.id || `ev-${i}`,
                  code: e.course || e.module || (e.title||e.name||'').split(' ')[0] || 'TBA',
                  name: e.title || e.name || e.subject || 'Lecture',
                  time: e.time || `${e.startTime || ''} - ${e.endTime || ''}`,
                  instructor: e.instructor || '',
                  location: e.location || ''
                }));

                try {
                  const startWeek = new Date(currentDate);
                  startWeek.setDate(currentDate.getDate() - currentDate.getDay());
                  startWeek.setHours(0,0,0,0);
                  const endWeek = new Date(startWeek);
                  endWeek.setDate(startWeek.getDate() + 6);
                  weekCount = evs.events.reduce((cnt, ev) => {
                    if (!ev.date) return cnt;
                    const d = new Date(ev.date);
                    if (isNaN(d.getTime())) return cnt;
                    const dMid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                    const t = (ev && (ev.type || (ev.raw && ev.raw.type) || '')).toString().toLowerCase();
                    return (dMid >= startWeek && dMid <= endWeek && t === 'lecture') ? cnt + 1 : cnt;
                  }, 0);
                } catch (e) { weekCount = 0; }
              }
            } catch (e) { /* ignore */ }
          }

          if (mounted) {
            const finalToday = (todayList || []).slice(0,6);
            setTodayClasses(finalToday);
            setWeekClassesCount(weekCount || 0);

            // If nothing today, compute a short list of next upcoming classes from events
            if (!finalToday.length) {
        try {
          const evs = await safeFetchJson('/api/events');
                if (evs && Array.isArray(evs.events)) {
                  // helper: convert to local date-only (midnight) for fair comparisons
                  const toLocalMidnight = (d) => {
                    try {
                      const dt = new Date(d);
                      if (isNaN(dt.getTime())) return null;
                      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
                    } catch (e) { return null; }
                  };

                  const todayMid = toLocalMidnight(new Date());

                  // Build upcoming list but prefer to promote any lectures happening today
                  const allUpcoming = evs.events
                    .filter(e => e && (e.type === 'lecture' || e.type === 'class') && e.date)
                    .map(e => ({
                      id: e.id,
                      date: e.date,
                      time: e.time,
                      name: e.title || e.name || e.subject || 'Class',
                      code: e.course || (e.title||'').split(' ')[0] || 'TBA',
                      location: e.location || '',
                      instructor: e.instructor || ''
                    }))
                    .map(e => ({ ...e, _dateObj: toLocalMidnight(e.date) }))
                    .filter(e => e._dateObj && e._dateObj >= todayMid) // only today or future
                    .sort((a,b) => a._dateObj - b._dateObj)
                    .slice(0,12) // fetch more so we can split into todays + rest
                    .map(({_dateObj, ...rest}) => ({ ...rest, _dateObj }));

                  // Split out items that are for today
                  const todaysFromUpcoming = allUpcoming.filter(i => {
                    try {
                      if (!i._dateObj) return false;
                      const y = i._dateObj.getFullYear();
                      const m = i._dateObj.getMonth();
                      const d = i._dateObj.getDate();
                      const mid = new Date(y, m, d);
                      return mid.getTime() === todayMid.getTime();
                    } catch (e) { return false; }
                  }).map(({_dateObj, ...rest}) => rest).slice(0,6);

                  const upcomingRest = allUpcoming.filter(i => {
                    try {
                      if (!i._dateObj) return true;
                      const y = i._dateObj.getFullYear();
                      const m = i._dateObj.getMonth();
                      const d = i._dateObj.getDate();
                      const mid = new Date(y, m, d);
                      return mid.getTime() !== todayMid.getTime();
                    } catch (e) { return true; }
                  }).map(({_dateObj, ...rest}) => rest).slice(0,6);

                  // If we found any lectures for today in upcoming, promote them to Today's Classes
                  if (todaysFromUpcoming.length) {
                    // set todayList and nextClasses accordingly
                    setTodayClasses(todaysFromUpcoming);
                    setNextClasses(upcomingRest);
                  } else {
                    setNextClasses(upcomingRest);
                  }
                }
              } catch (e) { setNextClasses([]); }
            } else {
              setNextClasses([]);
            }
          }
        } finally { setIsLoadingClasses(false); }

        // DEADLINES
        setIsLoadingDeadlines(true);
        try {
          const eventsPayload = await safeFetchJson('/api/events');
          if (mounted && eventsPayload && Array.isArray(eventsPayload.events)) {
            const deadlines = eventsPayload.events.filter(e => e.type === 'deadline' || e.type === 'assignment').slice(0,8).map((e, i) => ({
              id: e.id || `ev-${i}`,
              title: `${e.course ? e.course + ' - ' : ''}${e.title || e.name}`,
              dueDate: e.date ? (new Date(e.date)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
              type: e.type || 'assignment',
              course: e.course || '',
              daysLeft: e.date ? Math.max(0, Math.ceil((new Date(e.date) - new Date()) / (1000*60*60*24))) : 0
            }));
            if (mounted) {
              setUpcomingDeadlines(deadlines);
              setAssignmentsDueCount(deadlines.length);
            }
          }
        } finally { setIsLoadingDeadlines(false); }

        // GRADES: intentionally removed from overview to reduce clutter

        // QUICK STATS
        setIsLoadingQuickStats(true);
        try {
          // Use courses state (which may have been populated) for credits
          const courseList = Array.isArray(coursesBody?.courses) ? coursesBody.courses : (Array.isArray(courses) ? courses : []);
          const creditsSum = courseList.reduce((s, c) => s + (Number(c.credits || c.credit || 0)), 0);

          const eventsForStats = await safeFetchJson('/api/events') || { events: [] };
          let dueCount = 0;
          if (eventsForStats && Array.isArray(eventsForStats.events)) {
            const now = new Date();
            const weekAhead = new Date();
            weekAhead.setDate(now.getDate() + 7);
            dueCount = eventsForStats.events.reduce((cnt, e) => {
              if (!e.date) return cnt;
              const d = new Date(e.date);
              if (isNaN(d.getTime())) return cnt;
              return (d >= now && d <= weekAhead) ? cnt + 1 : cnt;
            }, 0);
          }

          // Compute GPA from gradesPayload if available
          const gradesForStats = await safeFetchJson('/api/grades') || { data: [] };
          let avgPercentage = null;
          if (gradesForStats && Array.isArray(gradesForStats.data) && gradesForStats.data.length) {
            const percents = gradesForStats.data.map((c) => {
              const cats = c.categories || c.assessments || [];
              if (!cats || !cats.length) return null;
              let totalWeight = 0;
              let weighted = 0;
              for (const cat of cats) {
                const weight = Number(cat.weight || 0);
                totalWeight += weight;
                const items = cat.items || cat.items || [];
                if (!items.length) continue;
                const avg = items.reduce((ss, it) => ss + ((it.score || it.grade || 0) / (it.maxScore || it.maxGrade || 100) * 100), 0) / items.length;
                weighted += (avg * weight) / 100;
              }
              if (totalWeight === 0) return null;
              return (weighted / totalWeight) * 100;
            }).filter(p => p !== null && !isNaN(p));
            if (percents.length) avgPercentage = percents.reduce((s, v) => s + v, 0) / percents.length;
          }

          const gpa = avgPercentage !== null ? Math.round(((avgPercentage / 100) * 4) * 100) / 100 : null;

          // Attendance & study hours (aggregate across all courses)
          let attendanceRate = null;
          try {
            if (courseList && courseList.length) {
              // fetch attendance for each course in parallel (best-effort), but ignore courses without id
              const courseIds = courseList.map(c => c && c.id).filter(Boolean);
              if (courseIds.length) {
                const promises = courseIds.map(id => safeFetchJson(`/api/attendance?courseId=${id}`));
                const results = await Promise.all(promises);
                let totalSessions = 0;
                let totalPresent = 0;
                for (const att of results) {
                  if (att && Array.isArray(att.sessions) && att.sessions.length) {
                    totalSessions += att.sessions.length;
                    totalPresent += att.sessions.filter(s => String(s.status).toUpperCase() === 'PRESENT').length;
                  }
                }
                if (totalSessions > 0) {
                  attendanceRate = Math.round((totalPresent / totalSessions) * 100);
                  try { setStudyHoursLogged(totalSessions); } catch (e) { setStudyHoursLogged(0); }
                }
              }
            }
          } catch (e) {
            // ignore attendance errors
          }

          if (mounted) setQuickStats({ gpa, credits: creditsSum, dueThisWeek: dueCount, attendanceRate });
        } finally { setIsLoadingQuickStats(false); }

      } catch (e) {
        // ignore top-level errors for now
      }
    })();

    return () => { mounted = false; };
  }, [currentDate, refreshCounter]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 dark:from-transparent dark:bg-gray-900">
      <Head>
        <title>Overview — University Planner</title>
      </Head>
      {/* Top Navigation (reusable) */}
      <CalendarHeader userName={userName} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-2">Good morning, {userName || 'Student'}</h2>
          <p className="text-gray-600">Here's what's happening with your studies today</p>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Overview</h3>
          <div className="flex items-center gap-3">
            <button onClick={refreshData} className="text-sm px-3 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">Refresh</button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />}
            label="Current GPA"
            value={quickStats.gpa !== null ? quickStats.gpa.toFixed(2) : '—'}
            loading={isLoadingQuickStats}
            accent="purple"
            smallIconClass="bg-purple-50 dark:bg-purple-900/30"
          />
          <StatCard
            icon={<BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
            label="Total Credits"
            value={quickStats.credits !== null ? quickStats.credits : '—'}
            loading={isLoadingQuickStats}
            accent="blue"
            smallIconClass="bg-blue-50 dark:bg-blue-900/30"
          />
          <StatCard
            icon={<AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />}
            label="Due This Week"
            value={quickStats.dueThisWeek !== null ? quickStats.dueThisWeek : '0'}
            loading={isLoadingQuickStats}
            accent="orange"
            smallIconClass="bg-orange-50 dark:bg-orange-900/30"
          />
          <StatCard
            icon={<Users className="w-6 h-6 text-green-600 dark:text-green-400" />}
            label="Attendance Rate"
            value={quickStats.attendanceRate !== null ? `${quickStats.attendanceRate}%` : '—'}
            loading={isLoadingQuickStats}
            accent="green"
            smallIconClass="bg-green-50 dark:bg-green-900/30"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Today's Schedule & Deadlines */}
          <div className="lg:col-span-2 space-y-6">
            {/* Today's Classes */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Today's Classes</h3>
                  <span className="text-sm text-purple-100">{currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
              
              <div className="p-6">
                {todayClasses.length > 0 ? (
                  <div className="space-y-3">
                    {todayClasses.map((cls) => {
                        const ymd = cls.date || cls.dateStr || currentDate.toISOString().slice(0,10);
                        const goto = () => { window.location.href = `/calendar?date=${encodeURIComponent(String(ymd).slice(0,10))}`; };
                        return (
                          <div key={cls.id} tabIndex={0} role="button" onClick={goto} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goto(); }} className="group bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-200 border border-transparent hover:border-purple-200 dark:hover:border-purple-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-start gap-4 flex-1">
                                <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-200 dark:border-gray-600 group-hover:border-purple-300 dark:group-hover:border-purple-700 transition-colors">
                                  <GraduationCap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">{cls.code}</span>
                                    <span className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{cls.name}</span>
                                  </div>
                                  <div className="flex flex-col gap-1.5 text-sm">
                                    {cls.instructor && (
                                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                        <Users className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span className="truncate">{cls.instructor}</span>
                                      </div>
                                    )}
                                    {cls.location && (
                                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span className="truncate">{cls.location}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm border border-gray-200 dark:border-gray-600 whitespace-nowrap ml-4">
                                <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                {cls.time}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                      <Calendar className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">No classes scheduled for today</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">Enjoy your free time!</p>
                    <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors" onClick={() => window.location.href = '/timetable'}>
                      <Calendar className="w-4 h-4" />
                      View Full Timetable
                    </button>
                    {nextClasses && nextClasses.length > 0 && (
                      <div className="mt-8 text-left">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Upcoming Classes</div>
                        <div className="space-y-2">
                          {nextClasses.map(nc => (
                            <div key={nc.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">{nc.code}</span>
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{nc.name}</span>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(nc.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {nc.time}</div>
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 ml-3 truncate">{nc.location}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Upcoming Deadlines</h3>
                <button className="text-purple-600 font-medium text-sm hover:text-purple-700">View All</button>
              </div>
              
                <div className="space-y-3">
                {upcomingDeadlines.map((deadline) => (
                  <div key={deadline.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        deadline.type === 'exam' ? 'bg-red-200 dark:bg-red-800' : 'bg-blue-200 dark:bg-blue-800'
                      }`}>
                        {deadline.type === 'exam' ? (
                          <AlertCircle className={`w-5 h-5 ${deadline.type === 'exam' ? 'text-red-600 dark:text-red-200' : 'text-blue-600 dark:text-blue-200'}`} />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-200" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 mb-1">{deadline.title}</p>
                        <p className="text-sm text-gray-600">{deadline.dueDate}</p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      deadline.daysLeft <= 2 ? 'bg-red-100 text-red-700' : 
                      deadline.daysLeft <= 5 ? 'bg-orange-100 text-orange-700' : 
                      'bg-green-100 text-green-700'
                    }`}>
                      {deadline.daysLeft} days
                    </div>
                  </div>
                ))}
              </div>
              {upcomingDeadlines.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-gray-500">No upcoming deadlines found</p>
                  <button className="mt-3 text-sm text-purple-600 hover:text-purple-700" onClick={() => window.location.href = '/events'}>Create an event</button>
                </div>
              )}
            </div>

            {/* Recent Grades removed per request */}
          </div>

          {/* Right Column - Quick Actions & This Week */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2" onClick={() => window.location.href = '/calendar'}>
                  <Calendar className="w-5 h-5" />
                  Open Calendar
                </button>
                <button className="w-full bg-white border-2 border-purple-600 text-purple-600 py-3 rounded-lg font-medium hover:bg-purple-50 transition-colors" onClick={() => window.location.href = '/calendar'}>
                  Create Event
                </button>
                <button className="w-full bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors" onClick={() => window.location.href = '/modules'}>
                  View Modules
                </button>
              </div>
            </div>

            {/* This Week Overview */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-4">This Week</h3>
              <div className="grid grid-cols-7 gap-2 mb-4">
                {weekDays.map((day, idx) => {
                  const date = new Date(startOfWeek);
                  date.setDate(startOfWeek.getDate() + idx);
                  const isToday = date.toDateString() === currentDate.toDateString();
                  
                  return (
                    <div key={day} className="text-center">
                      <div className="text-xs text-gray-600 mb-2">{day}</div>
                      <div className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center text-sm font-medium ${
                        isToday ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {date.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <span className="text-gray-600">Classes this week</span>
                  <span className="font-semibold text-gray-900">{weekClassesCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <span className="text-gray-600">Assignments due</span>
                  <span className="font-semibold text-gray-900">{assignmentsDueCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <span className="text-gray-600">Study hours logged</span>
                  <span className="font-semibold text-gray-900">{studyHoursLogged ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Active Modules */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Active Modules</h3>
              <div className="space-y-3">
                {courses && courses.length ? (
                  courses.slice(0,6).map((c, idx) => (
                    <div key={c.id || idx} className={`flex items-center gap-3 p-3 rounded-lg ${idx % 3 === 0 ? 'bg-blue-200 dark:bg-blue-900' : idx % 3 === 1 ? 'bg-green-200 dark:bg-green-900' : 'bg-purple-300 dark:bg-purple-900'}`}>
                      <div className={`w-3 h-3 ${idx % 3 === 0 ? 'bg-blue-800 dark:bg-blue-300' : idx % 3 === 1 ? 'bg-green-800 dark:bg-green-300' : 'bg-purple-800 dark:bg-purple-300'} rounded-full`}></div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{c.code || c.courseCode || c.code}</p>
                        <p className="text-xs text-gray-600">{c.name || c.title || c.module || c.courseName}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-center gap-3 p-3 bg-blue-200 dark:bg-blue-900 rounded-lg">
                      <div className="w-3 h-3 bg-blue-800 dark:bg-blue-300 rounded-full"></div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">CE304</p>
                        <p className="text-xs text-gray-600">Embedded Systems</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-green-200 dark:bg-green-900 rounded-lg">
                      <div className="w-3 h-3 bg-green-800 dark:bg-green-300 rounded-full"></div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">CSE304</p>
                        <p className="text-xs text-gray-600">Human Computer Interface</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-purple-300 dark:bg-purple-900 rounded-lg">
                      <div className="w-3 h-3 bg-purple-800 dark:bg-purple-300 rounded-full"></div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">SE403</p>
                        <p className="text-xs text-gray-600">Secure Software Development</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}