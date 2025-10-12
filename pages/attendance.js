import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Download, Loader2, AlertCircle, Settings, BookOpen, ArrowRight } from 'lucide-react';
import CustomSelect from '../src/components/CustomSelect';
// WeekView (timetable grid) removed from Attendance page per UI request
import Notification from '../src/components/Notification';
import Head from 'next/head';

const AttendanceTracker = () => {
  const [sessions, setSessions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  
  const [currentUser, setCurrentUser] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  // Timetable grid removed from this page — attendance shows sessions only

  // merged classes will include sessions as items for WeekView
  const classesForWeek = React.useMemo(() => (sessions || []).map(s => ({ id: `att-${s.id}`, title: s.status === 'PRESENT' ? (s.course && s.course.code ? `${s.course.code}` : 'Present') : `${s.status}`, date: s.date, time: s.time || null, raw: { attendance: s } })), [sessions]);

  // Timetable helper functions removed

  // Fetch courses on component mount
  const fetchCourses = useCallback(async () => {
    try {
      setCoursesLoading(true);
      setError(null);
      
  // Courses endpoint reads authenticated user from next-auth token
  const response = await fetch(`/api/courses`);
      
      console.log('Courses response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const msg = body?.message || body?.error || `HTTP ${response.status}: Failed to fetch courses`;
        console.error('Courses API Error Details:', msg);
        setNotification({ type: 'error', message: msg });
        throw new Error(msg);
      }
      
      const data = await response.json();
      console.log('Courses API Response:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch courses');
      }
      
      const fetchedCourses = data.courses || [];
      setCourses(fetchedCourses);
      
      // Auto-select first course if available (only if nothing selected yet)
      if (fetchedCourses.length > 0) {
        const firstCourse = fetchedCourses[0];
        setSelectedCourse(prev => prev || firstCourse.name);
        setSelectedCourseId(prev => prev || firstCourse.id);
      }
      
      console.log('Courses loaded:', fetchedCourses.length);
    } catch (err) {
      const errorMessage = err.message || 'Unknown error occurred while fetching courses';
      setError(errorMessage);
      console.error('Error fetching courses:', err);
      setCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  // Helper to parse error responses robustly (try JSON, then text)
  const parseErrorResponse = async (response) => {
    let defaultMsg = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return json.error || JSON.stringify(json) || defaultMsg;
      } catch (e) {
        // Not JSON — return trimmed text body (first 1000 chars)
        const trimmed = text.trim();
        return trimmed ? `${defaultMsg} - ${trimmed.substring(0, 1000)}` : defaultMsg;
      }
    } catch (e) {
      return defaultMsg;
    }
  };

  // Fetch attendance data when course changes
  const fetchAttendanceData = useCallback(async () => {
    if (!selectedCourseId) return;
    
    try {
      setLoading(true);
      setError(null);
      
  console.log('Fetching attendance data for course ID:', selectedCourseId);
      
  const response = await fetch(`/api/attendance?courseId=${selectedCourseId}`);
      
      console.log('Attendance response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const msg = body?.message || body?.error || `HTTP ${response.status}: Failed to fetch attendance`;
        console.error('Attendance API Error Details:', msg);
        setNotification({ type: 'error', message: msg });
        throw new Error(msg);
      }
      
      const data = await response.json();
      console.log('Attendance API Response:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch attendance data');
      }
      
      setSessions(sortSessionsByDate(data.sessions || []));
      console.log('Sessions loaded:', data.sessions?.length || 0);
    } catch (err) {
      const errorMessage = err.message || 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching attendance:', err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId]);

  useEffect(() => { if (selectedCourseId) fetchAttendanceData(); }, [selectedCourseId, fetchAttendanceData]);

  // Auto-dismiss compact toasts
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(t);
  }, [notification]);

  // Helper to sort sessions by date (oldest first)
  const sortSessionsByDate = (sessionsArray) => {
    return (sessionsArray || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  };
 

  // Calculate statistics - FIXED LOGIC WITH CAPPING SYSTEM
  const calculateStats = () => {
    const totalSessions = sessions.length;
    const holidays = sessions.filter(s => s.status === 'HOLIDAY').length;
    const present = sessions.filter(s => s.status === 'PRESENT').length;
    const absent = sessions.filter(s => s.status === 'ABSENT').length;
    const excused = sessions.filter(s => s.status === 'EXCUSED').length;
    const late = sessions.filter(s => s.status === 'LATE').length;
    
    // FIXED: Calculate attendance EXCLUDING holidays entirely
    // Only count sessions that actually required attendance (not holidays)
    const attendableSessions = sessions.filter(s => s.status !== 'HOLIDAY');
    const eligibleSessions = attendableSessions.length;
    
    // Count only sessions where student was actually present
    const actuallyPresent = sessions.filter(s => s.status === 'PRESENT').length;
    
    // Attendance percentage based only on non-holiday sessions
    const attendancePercentage = eligibleSessions > 0 ? (actuallyPresent / eligibleSessions) * 100 : 0;
    
    const totalPointsEarned = sessions.reduce((sum, session) => sum + (session.points || 0), 0);
    // Maximum possible points only for attendable sessions (excluding holidays)
    const totalPointsPossible = eligibleSessions * 2;
    
    // Capping system calculations
    const requiredAttendancePercentage = 80; // 80% minimum required
  const maxSkippablePercentage = 20; // Can skip up to 20%
  const maxSkippableSessions = Math.max(0, Math.floor(eligibleSessions * (maxSkippablePercentage / 100)));
  const skippedSessions = absent; // Only count actual absences (not late/excused)
  const remainingSkippable = Math.max(0, maxSkippableSessions - skippedSessions);
  const isCapped = attendancePercentage < requiredAttendancePercentage;
  // Determine 'at risk' by proximity to the required attendance percentage.
  // This avoids negative-threshold issues when maxSkippableSessions is small.
  const riskMarginPoints = 5; // percentage points above the threshold considered 'at risk'
  const isAtRisk = !isCapped && attendancePercentage < (requiredAttendancePercentage + riskMarginPoints);
    
    return {
      totalSessions,
      holidays,
      present,
      absent,
      excused,
      late,
      attendancePercentage,
      totalPointsEarned,
      totalPointsPossible,
      eligibleSessions, // This is now sessions excluding holidays
      // Capping system data
      requiredAttendancePercentage,
      maxSkippableSessions,
      skippedSessions,
      remainingSkippable,
      isCapped,
      isAtRisk
    };
  };

  const stats = calculateStats();

  // Small inline dark-mode overrides specific to Attendance page
  // Keep minimal and rely on global src/index.css for broader coverage
  const attendanceDarkStyles = `
    html.dark .attendance-root { background: #071023; color: rgba(255,255,255,0.92); }
    html.dark .attendance-card { background: #071423; border-color: rgba(255,255,255,0.04); box-shadow: none; }
    html.dark .attendance-card .card-header, html.dark .attendance-card .card-body { color: rgba(255,255,255,0.92); }
  /* Table header surface and cells */
  html.dark .attendance-table thead { background: rgba(255,255,255,0.02) !important; }
  html.dark .attendance-table thead th { background: rgba(255,255,255,0.02) !important; color: rgba(255,255,255,0.92) !important; border-bottom-color: rgba(255,255,255,0.04) !important; }
  html.dark .attendance-table td { color: rgba(255,255,255,0.9) !important; }
  /* Table row hover in dark mode */
  html.dark .attendance-root table tbody tr:hover { background: rgba(255,255,255,0.02) !important; }
  /* Ensure cozy tbody background is dark */
  html.dark .attendance-root .cozy tbody { background: transparent !important; }
    /* Utility fix for hover:bg-gray-50 used on rows */
    html.dark .attendance-root .hover\:bg-gray-50:hover { background: rgba(255,255,255,0.02) !important; }

    /* Inputs, selects and small controls */
    html.dark .attendance-root input[type="date"],
    html.dark .attendance-root input[type="time"],
    html.dark .attendance-root input[type="number"],
    html.dark .attendance-root select,
    html.dark .attendance-root textarea {
      background: #0b1220; color: rgba(255,255,255,0.92); border-color: rgba(255,255,255,0.06);
    }
    /* Force native select dropdowns to use dark backgrounds and readable option text */
    html.dark .attendance-root select { background: #0b1220 !important; color: rgba(255,255,255,0.92) !important; }
    /* Some browsers render options in a native popup - style fallback for options */
    html.dark .attendance-root select option { background: #0b1220; color: rgba(255,255,255,0.92); }
    /* Focus/hover states for options (where supported) */
    html.dark .attendance-root select option:hover, html.dark .attendance-root select option:focus { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.98); }
    /* Ensure selected option text is visible without focusing the select */
    html.dark .attendance-root select, html.dark .attendance-root select option {
      color: rgba(255,255,255,0.92) !important; background: transparent !important;
    }
    /* Some browsers render the selected value in a pseudo-element; target common ones */
    html.dark .attendance-root select::-ms-value { color: rgba(255,255,255,0.92); }
    html.dark .attendance-root select::-webkit-textfield-decoration { color: rgba(255,255,255,0.92); }
    /* Force number inputs to show their value in dark mode */
    html.dark .attendance-root input[type="number"] { color: rgba(255,255,255,0.92) !important; }
    html.dark .attendance-root input:focus,
    html.dark .attendance-root select:focus,
    html.dark .attendance-root input:focus-visible {
      box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
    }

    /* Buttons and small controls */
    html.dark .attendance-root button,
    html.dark .attendance-root .btn-light {
      background: transparent; color: rgba(255,255,255,0.92); border-color: rgba(255,255,255,0.06);
    }

    /* Status badge color adjustments for dark mode */
    html.dark .bg-green-50 { background: rgba(16,185,129,0.06) !important; color: rgba(16,185,129,0.95) !important; }
    html.dark .bg-red-50 { background: rgba(239,68,68,0.06) !important; color: rgba(239,68,68,0.95) !important; }
    html.dark .bg-blue-50 { background: rgba(59,130,246,0.06) !important; color: rgba(59,130,246,0.95) !important; }
    html.dark .bg-yellow-50 { background: rgba(234,179,8,0.06) !important; color: rgba(234,179,8,0.95) !important; }
    html.dark .bg-orange-50 { background: rgba(249,115,22,0.06) !important; color: rgba(249,115,22,0.95) !important; }

    /* Stronger text mappings */
    html.dark .text-gray-900, html.dark .text-gray-800 { color: rgba(255,255,255,0.92) !important; }
    html.dark .text-gray-600 { color: rgba(255,255,255,0.72) !important; }

    /* Summary panels and cards */
    html.dark .cozy, html.dark .card { background: #071423; border-color: rgba(255,255,255,0.04); }

    html.dark .modal-backdrop { background: rgba(0,0,0,0.6); }
    html.dark .text-gray-600 { color: rgba(255,255,255,0.72) !important; }
  `;

  const addSession = async () => {
    if (!selectedCourseId) {
      setError('Please select a course first');
      return;
    }

    // Deprecated: use addSessionWithPayload(payload) instead.
    console.warn('addSession() called without payload — use modal-driven flow instead');
  };

  // New helper: add session with explicit payload (date in YYYY-MM-DD)
  const addSessionWithPayload = async (payload) => {
    if (!selectedCourseId && !payload.courseId) {
      setError('Please select a course first');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const body = {
        date: payload.date,
        status: payload.status || 'PRESENT',
        points: typeof payload.points === 'number' ? payload.points : (payload.status === 'PRESENT' ? 2 : 0),
        courseId: payload.courseId || selectedCourseId
      };

      console.log('Adding session payload:', body);

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errMsg = await parseErrorResponse(response);
        setNotification({ type: 'error', message: errMsg });
        throw new Error(errMsg);
      }

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to add session');

      setSessions(prev => sortSessionsByDate([...(prev || []), data.session]));
      setNotification({ type: 'success', message: 'Session added' });
      // Broadcast a window-level event so other pages (e.g., timetable) can update live
      try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('attendance:created', { detail: data.session }));
        }
      } catch (e) {
        console.warn('Failed to dispatch attendance:created event', e);
      }
    } catch (err) {
      setError(err.message || 'Unknown error adding session');
      console.error('Error adding session with payload:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateSession = async (id, field, value) => {
    try {
      setError(null);
      
      // Optimistic update
      const updatedSessions = sessions.map(session => {
        if (session.id === id) {
          const updated = { ...session, [field]: value };
          // Auto-calculate points based on status - UPDATED LOGIC
          if (field === 'status') {
            switch (value) {
              case 'PRESENT':
                updated.points = 2;
                break;
              case 'EXCUSED':
                updated.points = 1;
                break;
              case 'LATE':
                updated.points = 1; // Changed from 0 to 1
                break;
              case 'ABSENT':
                updated.points = 0;
                break;
              case 'HOLIDAY':
                updated.points = 0; // Holidays don't affect attendance
                break;
              default:
                updated.points = 0;
            }
          }
          return updated;
        }
        return session;
      });
      setSessions(updatedSessions);

      // API call
      const response = await fetch(`/api/attendance`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            id,
            [field]: value
          }),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        setNotification({ type: 'error', message: errorMessage || `HTTP ${response.status}: Failed to update session` });
        throw new Error(errorMessage || `HTTP ${response.status}: Failed to update session`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update session');
      }

      // Update with server response and sort to maintain order
      setSessions(prevSessions => {
        const replaced = prevSessions.map(s => s.id === id ? data.session : s);
        return sortSessionsByDate(replaced);
      });
    } catch (err) {
      setError(err.message);
      console.error('Error updating session:', err);
      // Revert optimistic update
      fetchAttendanceData();
    }
  };

  const deleteSession = async (id) => {
    try {
      setError(null);
      
      const response = await fetch(`/api/attendance`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        setNotification({ type: 'error', message: errorMessage || `HTTP ${response.status}: Failed to delete session` });
        throw new Error(errorMessage || `HTTP ${response.status}: Failed to delete session`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete session');
      }

      setSessions(prevSessions => prevSessions.filter(session => session.id !== id));
    } catch (err) {
      setError(err.message);
      console.error('Error deleting session:', err);
    }
  };

  // Full update helper for modal (edit mode)
  const updateSessionFull = async (payload) => {
    // payload expected to contain id and fields to update: date, time, status, points
    try {
      setSaving(true);
      setError(null);
      const response = await fetch(`/api/attendance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errMsg = await parseErrorResponse(response);
        setNotification({ type: 'error', message: errMsg });
        throw new Error(errMsg);
      }
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to update session');
      setSessions(prev => sortSessionsByDate(prev.map(s => s.id === data.session.id ? data.session : s)));
      setNotification({ type: 'success', message: 'Session updated' });
      setEditingSession(null);
      setShowAddSessionModal(false);
    } catch (err) {
      setError(err.message || 'Unknown error updating session');
      console.error('Error updating session (full):', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteSessionFull = async (id) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/attendance`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const errMsg = await parseErrorResponse(response);
        setNotification({ type: 'error', message: errMsg });
        throw new Error(errMsg);
      }
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to delete session');
      setSessions(prev => prev.filter(s => s.id !== id));
      setNotification({ type: 'success', message: 'Session deleted' });
      setEditingSession(null);
      setShowAddSessionModal(false);
    } catch (err) {
      setError(err.message || 'Unknown error deleting session');
      console.error('Error deleting session (full):', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCourseChange = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      setSelectedCourse(course.name);
      setSelectedCourseId(courseId);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PRESENT': return 'bg-green-50 text-green-800';
      case 'ABSENT': return 'bg-red-50 text-red-800';
      case 'HOLIDAY': return 'bg-blue-50 text-blue-800';
      case 'EXCUSED': return 'bg-yellow-50 text-yellow-800';
      case 'LATE': return 'bg-orange-50 text-orange-800';
      default: return 'bg-gray-50 text-gray-800';
    }
  };

  const exportData = () => {
    const selectedCourseData = courses.find(c => c.id === selectedCourseId);
    const exportData = {
      course: selectedCourseData,
      sessions: sessions,
      stats: stats,
      exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedCourse || 'attendance'}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Show loading state while courses are loading
  if (coursesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <Head>
          <title>Attendance — University Planner</title>
        </Head>
        <div className="max-w-7xl mx-auto">
          <div className="cozy rounded-xl shadow-lg p-12">
            <div className="flex items-center justify-center">
              <Loader2 className="animate-spin mr-3" size={24} />
              <span className="text-gray-600">Loading your courses...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show message if no courses exist
  if (!courses.length) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 flex items-center justify-center">
      <Head>
        <title>Attendance — University Planner</title>
      </Head>
      <div className="max-w-2xl w-full mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-white" strokeWidth={2} />
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="px-8 py-10 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              No Courses Found
            </h2>
            <p className="text-lg text-gray-600 mb-2 max-w-lg mx-auto leading-relaxed">
              You haven't added any courses yet. Get started by creating your first course in the Modules Manager.
            </p>
            <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
              Once you add courses, you'll be able to track attendance, manage assignments, and monitor your academic progress.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => window.location.href = '/modules'}
                className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-300 hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                <span>Add Your First Course</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </button>
            </div>

            {/* Feature Highlights */}
            <div className="mt-12 pt-8 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-6">
                What you can do with courses
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                    <div className="w-6 h-6 bg-blue-500 rounded-full"></div>
                  </div>
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">Track Attendance</h4>
                  <p className="text-xs text-gray-600">Monitor your class participation and stay on top of requirements</p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-3">
                    <div className="w-6 h-6 bg-purple-500 rounded-full"></div>
                  </div>
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">Manage Tasks</h4>
                  <p className="text-xs text-gray-600">Keep track of assignments and deadlines for each course</p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-3">
                    <div className="w-6 h-6 bg-indigo-500 rounded-full"></div>
                  </div>
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">View Analytics</h4>
                  <p className="text-xs text-gray-600">Get insights into your academic performance and progress</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Helper */}
          <div className="bg-gray-50 px-8 py-5 border-t border-gray-100">
            <p className="text-sm text-gray-600 text-center">
              Need help getting started?{' '}
              <a href="/help" className="text-indigo-600 hover:text-indigo-700 font-medium underline">
                View our guide
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

  return (
    <div className="attendance-root calendar-root min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <Head>
        <title>Attendance — University Planner</title>
      </Head>
      <style>{`html.dark .attendance-root { background: linear-gradient(180deg,#071023,#071423); }
        html.dark .cozy, html.dark .card { background: #071423; color: rgba(255,255,255,0.92); border-color: rgba(255,255,255,0.04); }
        html.dark .text-gray-800 { color: rgba(255,255,255,0.92) !important; }
        html.dark .text-gray-600 { color: rgba(255,255,255,0.72) !important; }
        html.dark .bg-red-50 { background: rgba(255,0,0,0.04) !important; }
        ${attendanceDarkStyles}
        `}</style>
      {/* Top-right compact toasts */}
      <div className="fixed top-6 right-6 z-50">
        <Notification type={notification?.type} message={notification?.message} onClose={() => setNotification(null)} />
      </div>
  <div className="max-w-7xl mx-auto">
  <div className={`attendance-content ${showAddSessionModal ? 'blur-md pointer-events-none' : ''}`}>
    {/* Header */}
  <div className="cozy rounded-xl shadow-lg p-10 mt-6 mb-8" style={{ padding: '2.5rem' }}>
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
              <span className="text-red-700 flex-1">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-700 text-lg font-bold"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}
          
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-slate-100">Attendance Tracker</h1>
              <p className="text-gray-600 dark:text-slate-100">University Planner - Track your class attendance</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.href = '/modules'} // Adjust path as needed
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                title="Manage your courses"
              >
                <Settings size={20} />
                Manage Courses
              </button>
              <button
                onClick={exportData}
                disabled={loading || sessions.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={20} />
                Export
              </button>
              <button
                onClick={() => setShowAddSessionModal(true)}
                disabled={saving || loading || !selectedCourseId}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                Add Session
              </button>
            </div>
          </div>
          
          {/* Course Selector */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Course:</label>
            <CustomSelect
              value={selectedCourseId}
              onChange={(val) => handleCourseChange(val)}
              options={courses.map(course => ({ value: course.id, label: `${course.name} ${course.code ? `(${course.code})` : ''} - ${course.semester}` }))}
              placeholder="Select a course..."
              className="attendance-course-select w-full sm:w-[28rem] max-w-full"
            />
            {courses.length > 0 && (
              <span className="text-sm text-gray-500">
                {courses.length} course{courses.length !== 1 ? 's' : ''} available
              </span>
            )}
      
            {/* AddSessionModal intentionally rendered outside the blurred content so it stays crisp and interactive */}
          </div>
        </div>

        {selectedCourseId && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sessions Table */}
            <div className="lg:col-span-2">
              {/* Upcoming Sessions removed per user request */}
              <div className="cozy rounded-xl shadow-lg overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Sessions for {selectedCourse}
                  </h2>
                </div>
                
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="animate-spin mr-2" size={24} />
                      <span>Loading attendance data...</span>
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p>No attendance sessions found for {selectedCourse}</p>
                      <button
                        onClick={() => setShowAddSessionModal(true)}
                        disabled={saving}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="animate-spin" size={16} />
                            Adding...
                          </span>
                        ) : (
                          'Add First Session'
                        )}
                      </button>
                    </div>
                  ) : (
                    <table className="w-full attendance-table">
                    <thead className="bg-gray-50 dark:bg-transparent">
                      <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-black dark:text-slate-100 uppercase tracking-wider">Session</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black dark:text-slate-100 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black dark:text-slate-100 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black dark:text-slate-100 uppercase tracking-wider">Points</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black dark:text-slate-100 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="cozy divide-y divide-gray-200">
                      {sessions.map((session, index) => (
                        <tr key={session.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4 text-sm text-black dark:text-slate-100">
                            <input
                              type="date"
                              value={session.date}
                              onChange={(e) => updateSession(session.id, 'date', e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                            />
                            <div className="text-xs text-gray-500 mt-1">
                              {formatDate(session.date)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={session.status}
                              onChange={(e) => updateSession(session.id, 'status', e.target.value)}
                              className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(session.status)} border-0 focus:ring-2 focus:ring-blue-500 text-black dark:text-white`}
                            >
                              <option value="PRESENT">Present</option>
                              <option value="ABSENT">Absent</option>
                              <option value="LATE">Late</option>
                              <option value="HOLIDAY">Holiday</option>
                              <option value="EXCUSED">Excused</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-black dark:text-slate-100">
                            <input
                              type="number"
                              value={session.points || 0}
                              onChange={(e) => updateSession(session.id, 'points', parseInt(e.target.value) || 0)}
                              className="w-16 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white attendance-points-input"
                              min="0"
                              max="2"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <button
                              onClick={() => deleteSession(session.id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              aria-label="Delete session"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  )}
                </div>
              </div>
            </div>

            {/* Summary Panel */}
            <div className="lg:col-span-1">
              <div className="cozy rounded-xl shadow-lg p-6 lg:p-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Summary</h2>
                
                <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="font-medium text-gray-700 dark:text-slate-100">Attendance %</span>
                    <span className="text-2xl font-bold text-green-600">
                      {stats.attendancePercentage.toFixed(1)}%
                    </span>
                  </div>
                  
                    <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-slate-100">Holidays:</span>
                      <span className="font-medium text-blue-600">{stats.holidays}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-slate-100">Present:</span>
                      <span className="font-medium text-green-600">{stats.present}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-slate-100">Absent:</span>
                      <span className="font-medium text-red-600">{stats.absent}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-slate-100">Excused:</span>
                      <span className="font-medium text-yellow-600">{stats.excused}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-slate-100">Late:</span>
                      <span className="font-medium text-orange-600">{stats.late}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Points Earned:</span>
                      <span className="font-medium">{stats.totalPointsEarned}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Max Possible:</span>
                      <span className="font-medium">{stats.totalPointsPossible}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-800">
                        {stats.present}/{stats.eligibleSessions}
                      </div>
                      <div className="text-sm text-gray-500">
                        Present/Attendable Sessions
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        (Holidays excluded)
                      </div>
                    </div>
                  </div>

                  {/* Capping system */}
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Capping system</h3>
                    
                    {/* Main Status */}
                    <div className={`p-3 rounded-lg text-center mb-3 ${
                      stats.isCapped 
                        ? 'bg-red-50 text-red-800 border border-red-200' 
                        : stats.isAtRisk
                        ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                        : 'bg-green-50 text-green-800 border border-green-200'
                    }`}>
                      <div className="font-semibold text-lg">
                        {stats.isCapped ? 'CAPPED — action required' :
                         stats.isAtRisk ? 'At risk — pay attention' : 'Good — you meet the requirement'}
                      </div>
                      <div className="text-sm mt-1 text-gray-600">
                        {stats.isCapped ? 'Attendance below 80%. Contact your instructor.' :
                         stats.isAtRisk ? 'Approaching the maximum allowed absences. Aim to attend upcoming classes.' : 'Above 80% — keep it up.'}
                      </div>
                    </div>

                    {/* Detailed Numbers */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Required Attendance:</span>
                        <span className="font-medium">≥80%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Current Attendance:</span>
                        <span className={`font-medium ${stats.attendancePercentage >= 80 ? 'text-green-600' : 'text-red-600'}`}>
                          {stats.attendancePercentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Max Skippable:</span>
                        <span className="font-medium">{stats.maxSkippableSessions} lectures</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Skipped:</span>
                        <span className={`font-medium ${stats.skippedSessions >= stats.maxSkippableSessions ? 'text-red-600' : 'text-gray-800'}`}>
                          {stats.skippedSessions} lectures
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Remaining Skippable:</span>
                        <span className={`font-medium ${
                          stats.remainingSkippable === 0 ? 'text-red-600' : 
                          stats.remainingSkippable <= 1 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {stats.remainingSkippable} lectures
                        </span>
                      </div>
                    </div>

                    {/* Warning/Info Messages */}
                    {stats.eligibleSessions > 0 && (
                      <div className="mt-3 p-2 bg-blue-50 rounded-lg text-xs text-blue-800">
                        <div className="font-medium mb-1">Guidance</div>
                        <div>
                          {stats.isCapped ? (
                            "You've exceeded the allowed absences. Contact your instructor or admin immediately."
                          ) : stats.isAtRisk ? (
                            `You may miss ${stats.remainingSkippable} more session${stats.remainingSkippable !== 1 ? 's' : ''} before being capped. Prioritize attendance.`
                          ) : (
                            `You can miss up to ${stats.remainingSkippable} more session${stats.remainingSkippable !== 1 ? 's' : ''} and still meet the 80% requirement.`
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Non-blocking tint overlay (visual only) - does not intercept pointer events */}
    {showAddSessionModal && (
      <div className="fixed inset-0 z-40 pointer-events-none bg-black/20" aria-hidden="true" />
    )}

    {/* Render modal outside the blurred content so it doesn't get blurred and remains interactive */}
    <AddSessionModal
      open={showAddSessionModal}
      onClose={() => { setShowAddSessionModal(false); setEditingSession(null); }}
      onSave={(payload) => addSessionWithPayload(payload)}
      defaultCourseId={selectedCourseId}
      editingSession={editingSession}
      onUpdate={(payload) => updateSessionFull(payload)}
      onDelete={(id) => deleteSessionFull(id)}
    />

  </div>
  );
};

// Local Add Session Modal
function AddSessionModal({ open, onClose, onSave, defaultCourseId, initialDate, initialTime, editingSession, onUpdate, onDelete }) {
  const [visible, setVisible] = useState(false);
  const [date, setDate] = useState(() => {
    const t = new Date();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, '0');
    const dd = String(t.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [time, setTime] = useState('09:00');
  const [status, setStatus] = useState('PRESENT');
  const [points, setPoints] = useState(2);
  // removed timetable/template options: AddSessionModal focuses on attendance sessions only
  const modalRef = useRef(null);

  useEffect(() => {
    if (open) {
      // consume any global prefill set by WeekView slot clicks
      try {
        if (typeof window !== 'undefined' && window.__attendance_prefill) {
          const p = window.__attendance_prefill || {};
          if (p.date) setDate(p.date);
          if (p.time) setTime(p.time);
          // clear after consuming
          delete window.__attendance_prefill;
        }
        // If editing an existing session, prefer its values (status/points/date/time)
        if (editingSession && editingSession.id) {
          if (editingSession.date) setDate(editingSession.date);
          if (editingSession.time) setTime(editingSession.time || '09:00');
          if (editingSession.status) setStatus(editingSession.status);
          if (typeof editingSession.points !== 'undefined') setPoints(editingSession.points);
          // ignore timetable/template editing; treat as a normal session edit
        } else {
          if (initialDate) setDate(initialDate);
          if (initialTime) setTime(initialTime);
        }
      } catch (e) { /* ignore */ }
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => modalRef.current?.querySelector('input, select')?.focus?.(), 80);
  }, [open]);

  // Close modal when clicking outside the modal panel (robust fallback)
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e) {
      try {
        if (modalRef && modalRef.current && !modalRef.current.contains(e.target)) {
          onClose();
        }
      } catch (err) {
        // ignore
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open, onClose]);

  const handleSave = () => {
    const payload = { date, time, status, points: Number(points), courseId: defaultCourseId };
    if (editingSession && editingSession.id) {
      payload.id = editingSession.id;
      if (onUpdate) onUpdate(payload);
    } else {
      if (onSave) onSave(payload);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6 ${visible ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!visible}>
      {/* backdrop intentionally removed to avoid blocking interactions; modal remains centered */}

  <div ref={modalRef} className={`relative z-50 w-full max-w-md mx-auto transform transition-all duration-220 ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`} role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
  <div className="cozy rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-800">{editingSession && editingSession.id ? 'Edit Session' : 'Add Session'}</h3>
            <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-700 rounded p-2">×</button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border rounded text-black dark:text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Time</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-3 py-2 border rounded text-black dark:text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border rounded text-black dark:text-white">
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                  <option value="LATE">Late</option>
                  <option value="HOLIDAY">Holiday</option>
                  <option value="EXCUSED">Excused</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Points</label>
              <input type="number" min="0" max="2" value={points} onChange={(e) => setPoints(e.target.value)} className="w-24 px-3 py-2 border rounded" />
            </div>
            <div className="flex justify-between items-center">
              <div>
                {editingSession && editingSession.id ? (
                  <button onClick={() => { if (onDelete) onDelete(editingSession.id); onClose(); }} className="px-4 py-2 rounded bg-red-600 text-white">Delete</button>
                ) : (
                  <button onClick={onClose} className="px-4 py-2 rounded border">Cancel</button>
                )}
              </div>
              <div>
                <button onClick={handleSave} className="px-4 py-2 rounded bg-indigo-600 text-white">{editingSession && editingSession.id ? 'Save Changes' : 'Create Session'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceTracker;

// Note: The modal overlay and modal are rendered from the top-level component return
