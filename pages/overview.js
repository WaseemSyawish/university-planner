import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { Calendar, BookOpen, TrendingUp, Clock, CheckCircle, AlertCircle, GraduationCap, Users, Plus } from 'lucide-react';
import CalendarHeader from '../src/components/CalendarHeader.jsx';

// Small presentational StatCard with light/dark mode support
function StatCard({ icon, label, value, loading, accent = 'purple', smallIconClass = '' }) {
  const bg = smallIconClass || {
    purple: 'bg-purple-50 dark:bg-purple-900/30',
    blue: 'bg-blue-50 dark:bg-blue-900/30',
    orange: 'bg-orange-50 dark:bg-orange-900/30',
    green: 'bg-green-50 dark:bg-green-900/30'
  }[accent] || 'bg-gray-50 dark:bg-gray-700';
  
  return (
    <div className="rounded-xl p-5 shadow-sm border border-gray-100 bg-white dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-12 h-12 ${bg} rounded-lg flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {loading ? (
          <span className="inline-block w-16 h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></span>
        ) : (
          value
        )}
      </p>
    </div>
  );
}

function Skeleton({ width = 'w-24', height = 'h-6' }) {
  return <div className={`rounded bg-gray-200 dark:bg-gray-700 ${width} ${height} animate-pulse`} />;
}

export default function UniversityOverview() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userName, setUserName] = useState('');
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // State-backed data
  const [todayClasses, setTodayClasses] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [isLoadingDeadlines, setIsLoadingDeadlines] = useState(true);

  // Auxiliary data caches
  const [courses, setCourses] = useState([]);
  const [quickStats, setQuickStats] = useState({ gpa: null, credits: null, dueThisWeek: null, attendanceRate: null });
  const [isLoadingQuickStats, setIsLoadingQuickStats] = useState(true);

  // This-week metrics
  const [weekClassesCount, setWeekClassesCount] = useState(0);
  const [assignmentsDueCount, setAssignmentsDueCount] = useState(0);
  const [studyHoursLogged, setStudyHoursLogged] = useState(0);
  const [nextClasses, setNextClasses] = useState([]);

  const [refreshCounter, setRefreshCounter] = useState(0);

  function refreshData() {
    setRefreshCounter((c) => c + 1);
  }

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
            const payloadUser = (me.user && typeof me.user === 'object') ? me.user : me;
            const resolvedName = payloadUser?.name || payloadUser?.firstName || payloadUser?.username || '';
            if (resolvedName) setUserName(resolvedName);
          }
        } finally { setIsLoadingUser(false); }

        const coursesBody = await safeFetchJson('/api/courses');
        if (mounted && coursesBody && Array.isArray(coursesBody.courses)) setCourses(coursesBody.courses);

        // TIMETABLE + FALLBACK
        setIsLoadingClasses(true);
        try {
          async function tryFetchTimetable(path) {
            let res = await safeFetchJson(path);
            if (!res && typeof window !== 'undefined') {
              const host = window.location.hostname;
              if (host === 'localhost' || host === '127.0.0.1' || host === '') {
                res = await safeFetchJson(path + (path.includes('?') ? '&' : '?') + 'userId=smoke_user');
              }
            }
            return res;
          }

          const raw = await tryFetchTimetable('/api/timetable');
          let classesSrc = [];

          if (!raw) classesSrc = [];
          else if (Array.isArray(raw)) {
            if (raw.length && raw[0] && Array.isArray(raw[0].payload)) {
              classesSrc = raw.flatMap(tpl => (Array.isArray(tpl.payload) ? tpl.payload.map(p => ({ ...p, _templateId: tpl.id })) : []));
            } else classesSrc = raw;
          } else if (raw.templates && Array.isArray(raw.templates)) {
            classesSrc = raw.templates.flatMap(tpl => (Array.isArray(tpl.payload) ? tpl.payload.map(p => ({ ...p, _templateId: tpl.id })) : []));
          } else classesSrc = [];

          if ((!Array.isArray(classesSrc) || classesSrc.length === 0)) {
            try {
              const tpls = await tryFetchTimetable('/api/timetables');
              if (tpls && Array.isArray(tpls.templates)) {
                const evSrc = tpls.templates.flatMap(t => Array.isArray(t.events) ? t.events : []);
                if (evSrc && evSrc.length) classesSrc = evSrc;
              }
            } catch (e) { /* ignore */ }
          }

          let todayList = [];
          let weekCount = 0;
          const isLectureItem = (it) => {
            try {
              const t = (it && (it.type || (it.raw && it.raw.type) || it.eventType || '')).toString().toLowerCase();
              return t === 'lecture';
            } catch (e) { return false; }
          };
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
            } catch (e) {}
          } else {
            try {
              const evs = await safeFetchJson('/api/events');
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
            } catch (e) {}
          }

          if (mounted) {
            const finalToday = (todayList || []).slice(0,6);
            setTodayClasses(finalToday);
            setWeekClassesCount(weekCount || 0);

            try {
              const toLocalMidnight = (d) => {
                try {
                  const dt = new Date(d);
                  if (isNaN(dt.getTime())) return null;
                  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
                } catch (e) { return null; }
              };

              const todayMid = toLocalMidnight(new Date());
              const upcomingLimit = 3;

              const evs = await safeFetchJson('/api/events');
              if (evs && Array.isArray(evs.events)) {
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
                  .filter(e => e._dateObj && e._dateObj.getTime() > todayMid.getTime())
                  .sort((a,b) => a._dateObj - b._dateObj)
                  .slice(0, 12)
                  .map(({_dateObj, ...rest}) => ({ ...rest, _dateObj }));

                const upcomingRest = allUpcoming
                  .map(({_dateObj, ...rest}) => rest)
                  .slice(0, upcomingLimit);

                setNextClasses(upcomingRest);
              } else {
                setNextClasses([]);
              }
            } catch (e) { setNextClasses([]); }
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

        // QUICK STATS
        setIsLoadingQuickStats(true);
        try {
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
                const items = cat.items || [];
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

          let attendanceRate = null;
          try {
            if (courseList && courseList.length) {
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
          } catch (e) {}

          if (mounted) setQuickStats({ gpa, credits: creditsSum, dueThisWeek: dueCount, attendanceRate });
        } finally { setIsLoadingQuickStats(false); }

      } catch (e) {}
    })();

    return () => { mounted = false; };
  }, [currentDate, refreshCounter]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 dark:from-gray-900 dark:to-gray-900">
      <Head>
        <title>Overview — University Planner</title>
      </Head>
      <CalendarHeader userName={userName} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Good morning, {isLoadingUser ? <Skeleton width="w-32" height="h-9" /> : (userName || 'Student')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">Here's what's happening with your studies today</p>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Overview</h3>
          <div className="flex items-center gap-3">
            <button onClick={refreshData} className="text-sm px-3 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Refresh
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />}
            label="Current GPA"
            value={quickStats.gpa !== null ? quickStats.gpa.toFixed(2) : '—'}
            loading={isLoadingQuickStats}
            accent="purple"
          />
          <StatCard
            icon={<BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
            label="Total Credits"
            value={quickStats.credits !== null ? quickStats.credits : '—'}
            loading={isLoadingQuickStats}
            accent="blue"
          />
          <StatCard
            icon={<AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />}
            label="Due This Week"
            value={quickStats.dueThisWeek !== null ? quickStats.dueThisWeek : '0'}
            loading={isLoadingQuickStats}
            accent="orange"
          />
          <StatCard
            icon={<Users className="w-6 h-6 text-green-600 dark:text-green-400" />}
            label="Attendance Rate"
            value={quickStats.attendanceRate !== null ? `${quickStats.attendanceRate}%` : '—'}
            loading={isLoadingQuickStats}
            accent="green"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Today's Classes */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Today's Classes</h3>
                  <span className="text-sm text-purple-100">{currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
              
              <div className="p-6">
                {isLoadingClasses ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => (
                      <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 animate-pulse">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/3"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-2/3"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : todayClasses.length > 0 ? (
                  <div className="space-y-3">
                    {todayClasses.map((cls) => {
                      const ymd = cls.date || cls.dateStr || currentDate.toISOString().slice(0,10);
                      const goto = () => { window.location.href = `/calendar?date=${encodeURIComponent(String(ymd).slice(0,10))}`; };
                      return (
                        <div key={cls.id} tabIndex={0} role="button" onClick={goto} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goto(); }} className="group bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-200 border border-transparent hover:border-purple-200 dark:hover:border-purple-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700">
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
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Upcoming Deadlines</h3>
                <button className="text-purple-600 dark:text-purple-400 font-medium text-sm hover:text-purple-700 dark:hover:text-purple-300 transition-colors" onClick={() => window.location.href = '/calendar'}>
                  View All
                </button>
              </div>
              
              {isLoadingDeadlines ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-lg"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : upcomingDeadlines.length > 0 ? (
                <div className="space-y-3">
                  {upcomingDeadlines.map((deadline) => (
                    <div key={deadline.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          deadline.type === 'exam' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                        }`}>
                          {deadline.type === 'exam' ? (
                            <AlertCircle className={`w-5 h-5 ${deadline.type === 'exam' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`} />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">{deadline.title}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{deadline.dueDate}</p>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        deadline.daysLeft <= 2 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 
                        deadline.daysLeft <= 5 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 
                        'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      }`}>
                        {deadline.daysLeft} days
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                    <CheckCircle className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">No upcoming deadlines</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">You're all caught up!</p>
                  <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors" onClick={() => window.location.href = '/calendar'}>
                    <Plus className="w-4 h-4" />
                    Create Event
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full bg-purple-600 dark:bg-purple-700 text-white py-3 rounded-lg font-medium hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors flex items-center justify-center gap-2" onClick={() => window.location.href = '/calendar'}>
                  <Calendar className="w-5 h-5" />
                  Open Calendar
                </button>
                <button className="w-full bg-white dark:bg-gray-700 border-2 border-purple-600 dark:border-purple-500 text-purple-600 dark:text-purple-400 py-3 rounded-lg font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors" onClick={() => window.location.href = '/calendar'}>
                  Create Event
                </button>
                <button className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors" onClick={() => window.location.href = '/modules'}>
                  View Modules
                </button>
              </div>
            </div>

            {/* This Week Overview */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">This Week</h3>
              <div className="grid grid-cols-7 gap-2 mb-4">
                {weekDays.map((day, idx) => {
                  const date = new Date(startOfWeek);
                  date.setDate(startOfWeek.getDate() + idx);
                  const isToday = date.toDateString() === currentDate.toDateString();
                  
                  return (
                    <div key={day} className="text-center">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">{day}</div>
                      <div className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center text-sm font-medium ${
                        isToday ? 'bg-purple-600 dark:bg-purple-700 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {date.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Classes this week</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{weekClassesCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Assignments due</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{assignmentsDueCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Study hours logged</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{studyHoursLogged ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Active Modules */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Active Modules</h3>
              <div className="space-y-3">
                {courses && courses.length > 0 ? (
                  courses.slice(0,6).map((c, idx) => (
                    <div key={c.id || idx} className={`flex items-center gap-3 p-3 rounded-lg ${
                      idx % 3 === 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 
                      idx % 3 === 1 ? 'bg-green-100 dark:bg-green-900/30' : 
                      'bg-purple-100 dark:bg-purple-900/30'
                    }`}>
                      <div className={`w-3 h-3 ${
                        idx % 3 === 0 ? 'bg-blue-600 dark:bg-blue-400' : 
                        idx % 3 === 1 ? 'bg-green-600 dark:bg-green-400' : 
                        'bg-purple-600 dark:bg-purple-400'
                      } rounded-full`}></div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{c.code || c.courseCode}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{c.name || c.title || c.module || c.courseName}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
                      <BookOpen className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">No modules yet</p>
                    <button className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium" onClick={() => window.location.href = '/modules'}>
                      Add modules
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}