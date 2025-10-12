import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { Plus, Edit, Trash2, Save, X, BookOpen, Users, Calendar, Loader2, AlertCircle, GraduationCap, CheckCircle, Clock } from 'lucide-react';
import Notification from '../src/components/Notification';

const ModulesManager = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [notification, setNotification] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Authenticated user id is resolved server-side via next-auth; fetch current user
  const [currentUser, setCurrentUser] = useState(null);

  // Form state for new/editing course
  const [courseForm, setCourseForm] = useState({
    name: '',
    code: '',
    credits: 3,
    color: '#3B82F6',
    semester: '2025-1',
    instructor: '',
    description: ''
  });

  // Form validation errors
  const [formErrors, setFormErrors] = useState({});

  // Modal accessibility & animation helpers
  const modalRef = useRef(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Predefined color options
  const colorOptions = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
    '#F97316', '#6366F1', '#14B8A6', '#F472B6'
  ];

  // Semester options
  const semesterOptions = [
    { value: '2025-1', label: '2025/2026 - Semester 1' },
    { value: '2025-2', label: '2025/2026 - Semester 2' },
    // Removed older 2024 semester options per UX request
  ];

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch('/api/auth/me');
        if (!me.ok) {
          // not authenticated -> redirect to signin
          window.location.href = '/signin';
          return;
        }
        const meJson = await me.json();
        setCurrentUser(meJson);
        fetchCourses();
      } catch (e) {
        console.error('Error resolving user', e);
        window.location.href = '/signin';
      }
    })();
  }, []);

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Auto-dismiss compact toasts
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(t);
  }, [notification]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/courses');
      
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const msg = body?.message || body?.error || `HTTP ${response.status}: Failed to fetch courses`;
        throw new Error(msg);
      }

      const data = await response.json();

      if (!data.success) {
        const msg = data?.message || data?.error || 'Failed to fetch courses';
        throw new Error(msg);
      }
      
      setCourses(data.courses || []);
    } catch (err) {
      setError(err.message);
      setNotification({ type: 'error', message: err.message });
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!courseForm.name.trim()) {
      errors.name = 'Course name is required';
    }
    
    if (courseForm.code && courseForm.code.length > 20) {
      errors.code = 'Course code must be 20 characters or less';
    }
    
    const credits = parseInt(courseForm.credits);
    if (isNaN(credits) || credits < 1 || credits > 20) {
      errors.credits = 'Credits must be between 1 and 20';
    }
    
    if (courseForm.instructor && courseForm.instructor.length > 100) {
      errors.instructor = 'Instructor name must be 100 characters or less';
    }
    
    if (courseForm.description && courseForm.description.length > 500) {
      errors.description = 'Description must be 500 characters or less';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setCourseForm({
      name: '',
      code: '',
      credits: 3,
      color: '#3B82F6',
      semester: '2025-1',
      instructor: '',
      description: ''
    });
    setFormErrors({});
  };

  const handleAddCourse = () => {
    resetForm();
    setShowAddForm(true);
    setEditingCourse(null);
    setError(null);
    setSuccess(null);
  };

  // When modal opens, run enter animation and focus the first input.
  useEffect(() => {
    let mounted = true;
    const prevActive = typeof document !== 'undefined' ? document.activeElement : null;
    if (showAddForm) {
      // small timeout to allow the element to mount then animate
      setTimeout(() => { if (mounted) setModalVisible(true); }, 10);

      // focus first input inside modal
      setTimeout(() => {
        try {
          const root = modalRef.current;
          if (root) {
            const el = root.querySelector('input, select, textarea, button');
            if (el && el.focus) el.focus();
          }
        } catch (e) { /* ignore */ }
      }, 50);

      const onKey = (ev) => {
        if (ev.key === 'Escape') {
          // animate close
          closeModal();
        }
        if (ev.key === 'Tab') {
          // simple focus trap
          const root = modalRef.current;
          if (!root) return;
          const focusable = root.querySelectorAll('a[href], button:not([disabled]), textarea, input, select');
          if (!focusable || focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (ev.shiftKey && document.activeElement === first) {
            ev.preventDefault(); last.focus();
          } else if (!ev.shiftKey && document.activeElement === last) {
            ev.preventDefault(); first.focus();
          }
        }
      };

      document.addEventListener('keydown', onKey);
      return () => {
        mounted = false;
        document.removeEventListener('keydown', onKey);
        if (prevActive && prevActive.focus) prevActive.focus();
      };
    }
    return () => { mounted = false; };
  }, [showAddForm]);

  // Close modal with exit animation
  const closeModal = () => {
    // start exit animation (matches CSS transition duration)
    setModalVisible(false);
    // after animation completes, call existing cancel handler
    setTimeout(() => {
      handleCancelEdit();
    }, 320);
  };

  const handleEditCourse = (course) => {
    setCourseForm({
      name: course.name || '',
      code: course.code || '',
      credits: course.credits || 3,
      color: course.color || '#3B82F6',
      semester: course.semester || '2025-1',
      instructor: course.instructor || '',
      description: course.description || ''
    });
    setEditingCourse(course.id);
    setShowAddForm(true);
    setFormErrors({});
    setError(null);
    setSuccess(null);
  };

  const handleSaveCourse = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const courseData = {
        ...courseForm,
        credits: parseInt(courseForm.credits) || 3
      };

      const method = editingCourse ? 'PUT' : 'POST';
      
      if (editingCourse) {
        courseData.id = editingCourse;
      }

      const response = await fetch('/api/courses', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(courseData),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || body?.error || `HTTP ${response.status}: Failed to save course`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data?.message || data?.error || 'Failed to save course');
      }

      // Update local state
      if (editingCourse) {
        setCourses(prev => prev.map(c => c.id === editingCourse ? data.course : c));
        setSuccess('Course updated successfully!');
      } else {
        setCourses(prev => [...prev, data.course]);
        setSuccess('Course created successfully!');
      }

      // Reset form and animate modal close so user sees smooth exit
      // closeModal will call handleCancelEdit after the exit animation
      closeModal();
    } catch (err) {
      setError(err.message);
      setNotification({ type: 'error', message: err.message });
      console.error('Error saving course:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCourse = async (courseId, courseName) => {
    const course = courses.find(c => c.id === courseId);
    const hasAttendance = course?.attendanceSessionsCount > 0;
    
    let confirmMessage = `Are you sure you want to delete "${courseName}"?`;
    if (hasAttendance) {
      confirmMessage += ` This will also delete ${course.attendanceSessionsCount} attendance session${course.attendanceSessionsCount === 1 ? '' : 's'}.`;
    }
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setError(null);
      
      const response = await fetch('/api/courses', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: courseId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || body?.error || `HTTP ${response.status}: Failed to delete course`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data?.message || data?.error || 'Failed to delete course');
      }

      setCourses(prev => prev.filter(c => c.id !== courseId));
      setSuccess(data.message || 'Course deleted successfully!');
    } catch (err) {
      setError(err.message);
      setNotification({ type: 'error', message: err.message });
      console.error('Error deleting course:', err);
    }
  };

  const handleCancelEdit = () => {
    setShowAddForm(false);
    setEditingCourse(null);
    resetForm();
    setError(null);
  };

  const getCurrentSemesterCourses = () => {
    return courses.filter(course => course.semester === '2025-1');
  };

  const getUpcomingSemesterCourses = () => {
    return courses.filter(course => course.semester === '2025-2');
  };

  const getPreviousSemesterCourses = () => {
    return courses.filter(course => !['2025-1', '2025-2'].includes(course.semester));
  };

  const getTotalCredits = (coursesList) => {
    return coursesList.reduce((total, course) => total + (course.credits || 0), 0);
  };

  return (
  <div className="modules-root min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-6">
      <Head>
        <title>Modules — University Planner</title>
      </Head>
      <style>{`
        /* Dark mode overrides for Modules Manager */
        html.dark .min-h-screen.bg-gradient-to-br { background-image: none; background-color: #0b1220; }
        html.dark .cozy { background-color: #0f1724; border-color: #1f2937; }
        html.dark .cozy .text-gray-800 { color: #e6eef8; }
        html.dark .text-gray-600 { color: #9aa4b2; }
        html.dark .text-gray-500 { color: #7b8794; }
        html.dark .text-gray-900 { color: #e6eef8; }
        html.dark .bg-indigo-100 { background-color: #0b1220; }
        html.dark .bg-green-100 { background-color: #0b1220; }
        html.dark .bg-blue-100 { background-color: #0b1220; }
        html.dark .bg-gray-100 { background-color: #0b1220; }
        html.dark .border-gray-200 { border-color: #1f2937; }
        html.dark .border-gray-100 { border-color: #111827; }
        html.dark .rounded-xl { box-shadow: none; }
        html.dark .px-3.py-2.border-0.border-b { border-bottom-color: #1f2937; }
        html.dark .bg-indigo-600 { background-color: #2563eb; }
        html.dark .text-gray-700 { color: #cbd5e1; }
        html.dark .bg-gray-50 { background-color: transparent; }
        html.dark .ring-2.ring-white { box-shadow: 0 0 0 3px rgba(30,41,59,0.25); }
        /* Ensure form controls inside cozy/modal are readable in dark mode */
        html.dark .cozy input,
        html.dark .cozy textarea,
        html.dark .cozy select {
          color: #e6eef8 !important; /* light text */
          background: transparent !important;
          caret-color: #e6eef8 !important;
          -webkit-text-fill-color: #e6eef8 !important; /* webkit browsers */
        }
        html.dark .cozy input::placeholder,
        html.dark .cozy textarea::placeholder {
          color: #9aa4b2 !important; /* muted placeholder */
          opacity: 1 !important;
        }
        /* Ensure select options and selected text are visible */
        html.dark .cozy select option { color: #0f1724; background: #fff; }
        /* More specific targets for type=number and focused states */
        html.dark .cozy input[type="number"] { color: #e6eef8 !important; -webkit-text-fill-color:#e6eef8 !important; }
        html.dark .cozy input:focus, html.dark .cozy textarea:focus, html.dark .cozy select:focus {
          color: #e6eef8 !important;
          -webkit-text-fill-color: #e6eef8 !important;
        }
      `}</style>
      <div className="fixed top-6 right-6 z-50">
        <Notification type={notification?.type} message={notification?.message} onClose={() => setNotification(null)} />
      </div>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
  <div className="cozy rounded-xl shadow-lg p-6 mb-6">
          <style>{`
            /* Modules page: increase spacing for the first cozy card for better breathing room */
            .modules-root .cozy:first-of-type { margin-top: 12px; padding: 20px; }
            @media (max-width: 768px) { .modules-root .cozy:first-of-type { padding: 16px; } }
          `}</style>
          {/* Success Message */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle className="text-green-500 flex-shrink-0" size={20} />
              <span className="text-green-700 flex-1">{success}</span>
              <button
                onClick={() => setSuccess(null)}
                className="ml-auto text-green-500 hover:text-green-700 text-lg font-bold"
                aria-label="Dismiss success message"
              >
                ×
              </button>
            </div>
          )}

          {/* Error Message */}
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
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <BookOpen className="text-indigo-600" size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Modules Manager</h1>
                <p className="text-gray-600">Manage your university courses and modules</p>
                {!loading && (
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span>{courses.length} total modules</span>
                    <span>•</span>
                    <span>{getTotalCredits(courses)} total credits</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleAddCourse}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              <Plus size={20} />
              Add Module
            </button>
          </div>
        </div>

        {/* Add/Edit Modal */}
        {showAddForm && (
          <div
            className={`fixed inset-0 z-40 flex items-center justify-center px-4 sm:px-6 ${modalVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
            aria-hidden={!modalVisible}
          >
            <div
              className={`absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${modalVisible ? 'opacity-100' : 'opacity-0'}`}
              onMouseDown={closeModal}
            />

            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              className={`relative w-full max-w-3xl mx-auto transform transition-all duration-300 ${modalVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`}
            >
              <div className="cozy rounded-xl shadow-2xl ring-1 ring-black/5 overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 px-2">
                    {editingCourse ? <Edit size={18} /> : <Plus size={18} />}
                    <span className="ml-1">{editingCourse ? 'Edit Module' : 'Add New Module'}</span>
                  </h2>
                  <button onClick={closeModal} aria-label="Close" className="text-gray-500 hover:text-gray-700 rounded p-2">
                    <X size={18} />
                  </button>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Module Name *</label>
                      <input
                        type="text"
                        value={courseForm.name}
                        onChange={(e) => setCourseForm(prev => ({ ...prev, name: e.target.value }))}
                        className={`w-full px-3 py-2 border-0 border-b ${formErrors.name ? 'border-red-300' : 'border-gray-200'} focus:outline-none focus:border-indigo-400 rounded-sm`}
                        placeholder="e.g., Web Technologies"
                        maxLength={100}
                      />
                      {formErrors.name && (<p className="mt-1 text-sm text-red-600">{formErrors.name}</p>)}
                    </div>

                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Module Code</label>
                      <input
                        type="text"
                        value={courseForm.code}
                        onChange={(e) => setCourseForm(prev => ({ ...prev, code: e.target.value }))}
                        className={`w-full px-3 py-2 border-0 border-b ${formErrors.code ? 'border-red-300' : 'border-gray-200'} focus:outline-none focus:border-indigo-400 rounded-sm`}
                        placeholder="e.g., CS301"
                        maxLength={20}
                      />
                      {formErrors.code && (<p className="mt-1 text-sm text-red-600">{formErrors.code}</p>)}
                    </div>

                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Credits *</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={courseForm.credits}
                        onChange={(e) => setCourseForm(prev => ({ ...prev, credits: e.target.value }))}
                        className={`w-full px-3 py-2 border-0 border-b ${formErrors.credits ? 'border-red-300' : 'border-gray-200'} focus:outline-none focus:border-indigo-400 rounded-sm`}
                      />
                      {formErrors.credits && (<p className="mt-1 text-sm text-red-600">{formErrors.credits}</p>)}
                    </div>

                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Semester *</label>
                      <select
                        value={courseForm.semester}
                        onChange={(e) => setCourseForm(prev => ({ ...prev, semester: e.target.value }))}
                        className="w-full px-3 py-2 border-0 border-b border-gray-200 focus:outline-none focus:border-indigo-400 rounded-sm"
                      >
                        {semesterOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Instructor</label>
                      <input
                        type="text"
                        value={courseForm.instructor}
                        onChange={(e) => setCourseForm(prev => ({ ...prev, instructor: e.target.value }))}
                        className={`w-full px-3 py-2 border-0 border-b ${formErrors.instructor ? 'border-red-300' : 'border-gray-200'} focus:outline-none focus:border-indigo-400 rounded-sm`}
                        placeholder="e.g., Dr. Smith"
                        maxLength={100}
                      />
                      {formErrors.instructor && (<p className="mt-1 text-sm text-red-600">{formErrors.instructor}</p>)}
                    </div>

                    <div>
                      <label className="block text-sm text-gray-500 mb-2">Color</label>
                      <div role="radiogroup" aria-label="Module color" className="grid grid-cols-8 gap-2">
                        {colorOptions.map(color => {
                          const selected = courseForm.color === color;
                          return (
                            <button
                              key={color}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => setCourseForm(prev => ({ ...prev, color }))}
                              className={`relative w-7 h-7 rounded-full transition transform focus:outline-none focus:ring-2 focus:ring-indigo-400 ${selected ? 'ring-2 ring-offset-1 ring-indigo-500 scale-105' : 'ring-1 ring-gray-200'}`}
                              style={{ backgroundColor: color }}
                              aria-label={`Select color ${color}`}
                            >
                              {selected && (<span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-semibold">✓</span>)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-500 mb-1">Description</label>
                      <textarea
                        value={courseForm.description}
                        onChange={(e) => setCourseForm(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className={`w-full px-3 py-2 border-0 border-b ${formErrors.description ? 'border-red-300' : 'border-gray-200'} focus:outline-none focus:border-indigo-400 rounded-sm`}
                        placeholder="Brief description of the module..."
                        maxLength={500}
                      />
                      <div className="flex justify-between mt-1">
                        {formErrors.description && (<p className="text-sm text-red-600">{formErrors.description}</p>)}
                        <p className="text-xs text-gray-500 ml-auto">{courseForm.description.length}/500</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 mt-6 pt-4 flex justify-end gap-3 px-6 pb-6">
                    <button onClick={closeModal} className="px-4 py-2 rounded text-gray-700 bg-gray-50 hover:bg-gray-100">Cancel</button>
                    <button onClick={handleSaveCourse} disabled={saving || !courseForm.name.trim()} className="ml-2 px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                      {saving ? <Loader2 className="animate-spin mr-2 inline-block" size={16} /> : <Save size={16} className="mr-2 inline-block" />}
                      {saving ? 'Saving...' : (editingCourse ? 'Update Module' : 'Save Module')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="cozy rounded-xl shadow-lg p-12">
            <div className="flex items-center justify-center">
              <Loader2 className="animate-spin mr-3 text-indigo-600" size={24} />
              <span className="text-gray-600">Loading modules...</span>
            </div>
          </div>
        )}

        {/* Course Lists */}
        {!loading && (
          <>
            {/* Current Semester */}
            <div className="cozy rounded-xl shadow-lg mb-6">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Calendar className="text-green-600" size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800">
                        Current Semester (2025/2026 - Semester 1)
                      </h2>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <BookOpen size={14} />
                          {getCurrentSemesterCourses().length} modules
                        </span>
                        <span className="flex items-center gap-1">
                          <GraduationCap size={14} />
                          {getTotalCredits(getCurrentSemesterCourses())} credits
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    Active
                  </span>
                </div>
              </div>
              
              <div className="p-6">
                {getCurrentSemesterCourses().length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <GraduationCap size={64} className="mx-auto mb-4 opacity-30" />
                    <h3 className="text-lg font-medium mb-2">No modules for current semester</h3>
                    <p className="mb-6">Start building your academic schedule by adding your first module.</p>
                    <button
                      onClick={handleAddCourse}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Add Your First Module
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {getCurrentSemesterCourses().map(course => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        onEdit={handleEditCourse}
                        onDelete={handleDeleteCourse}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Semester */}
            <div className="cozy rounded-xl shadow-lg mb-6">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Clock className="text-blue-600" size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-800">
                        Upcoming Semester (2025/2026 - Semester 2)
                      </h2>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <BookOpen size={14} />
                          {getUpcomingSemesterCourses().length} modules
                        </span>
                        <span className="flex items-center gap-1">
                          <GraduationCap size={14} />
                          {getTotalCredits(getUpcomingSemesterCourses())} credits
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    Upcoming
                  </span>
                </div>
              </div>
              
              <div className="p-6">
                {getUpcomingSemesterCourses().length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock size={48} className="mx-auto mb-4 opacity-30" />
                    <h3 className="text-lg font-medium mb-2">No modules planned</h3>
                    <p>Plan ahead for next semester by adding modules.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {getUpcomingSemesterCourses().map(course => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        onEdit={handleEditCourse}
                        onDelete={handleDeleteCourse}
                        isUpcoming={true}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Previous Semesters */}
            {getPreviousSemesterCourses().length > 0 && (
              <div className="cozy rounded-xl shadow-lg">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <BookOpen className="text-gray-600" size={20} />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-800">
                          Previous Semesters
                        </h2>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <BookOpen size={14} />
                            {getPreviousSemesterCourses().length} modules
                          </span>
                          <span className="flex items-center gap-1">
                            <GraduationCap size={14} />
                            {getTotalCredits(getPreviousSemesterCourses())} credits
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                      Completed
                    </span>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {getPreviousSemesterCourses().map(course => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        onEdit={handleEditCourse}
                        onDelete={handleDeleteCourse}
                        isPrevious={true}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Course Card Component
const CourseCard = ({ course, onEdit, onDelete, isPrevious = false, isUpcoming = false }) => {
  const getStatusBadge = () => {
    if (isPrevious) {
      return <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">Completed</span>;
    }
    if (isUpcoming) {
      return <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded-full">Upcoming</span>;
    }
    return <span className="text-xs px-2 py-1 bg-green-100 text-green-600 rounded-full">Active</span>;
  };

  return (
  <div 
    className={`course-card-container border rounded-xl hover:shadow-lg transition-all duration-200 cozy ${
      isPrevious ? 'opacity-75' : 'hover:-translate-y-1'
    }`}
    style={{ padding: '1.25rem' }}
  >
      <div className="course-card-header flex items-start justify-between mb-4 gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
            style={{ backgroundColor: course.color || '#3B82F6' }}
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 leading-tight text-base break-words">
              {course.name}
            </h3>
            {course.code && (
              <p className="text-sm text-gray-500 font-mono">{course.code}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onEdit(course)}
            className="text-gray-400 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-indigo-50"
            aria-label="Edit course"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => onDelete(course.id, course.name)}
            className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
            aria-label="Delete course"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="course-card-body space-y-3 text-sm text-gray-600">
        {course.instructor && (
          <div className="flex items-center gap-2">
            <Users size={16} className="text-gray-400 flex-shrink-0" />
            <span className="truncate">{course.instructor}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap size={16} className="text-gray-400" />
            <span>{course.credits} credit{course.credits !== 1 ? 's' : ''}</span>
          </div>
          {getStatusBadge()}
        </div>
        
        {course.attendanceSessionsCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-indigo-600">
            <Calendar size={14} />
            <span>{course.attendanceSessionsCount} attendance session{course.attendanceSessionsCount !== 1 ? 's' : ''}</span>
          </div>
        )}
        
        {course.description && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed border-t pt-3 mt-3">
            {course.description}
          </p>
        )}
      </div>
    </div>
  );
};

export default ModulesManager;