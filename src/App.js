import React, { useState, useEffect, useRef } from 'react';
import { Clock, TrendingUp, Plus, BookOpen, X, Check, Star, Zap, Target } from 'lucide-react';
import { buildLocalDateFromParts, formatTimeFromParts, parseDatePreserveLocal } from './lib/dateHelpers';

const UniversityPlanner = () => {
  const [events, setEvents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [animatedStats, setAnimatedStats] = useState({ total: 0, completed: 0 });
  const [selectedDay, setSelectedDay] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Animate stats when events change
  const animatedStatsRef = useRef(animatedStats);
  useEffect(() => { animatedStatsRef.current = animatedStats; }, [animatedStats]);

  useEffect(() => {
    const totalEvents = events.length;
    const completedEvents = events.filter(e => e.completed).length;

    const animateCounter = (start, end, setter, duration = 500) => {
      const startTime = performance.now();
      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.floor(start + (end - start) * progress);
        setter(current);
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    };

    const prevTotal = animatedStatsRef.current.total || 0;
    const prevCompleted = animatedStatsRef.current.completed || 0;

    animateCounter(prevTotal, totalEvents, (val) => setAnimatedStats(prev => ({ ...prev, total: val })));
    animateCounter(prevCompleted, completedEvents, (val) => setAnimatedStats(prev => ({ ...prev, completed: val })));
  }, [events]);

  // Get the next 7 days starting from today
  const getNextSevenDays = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const nextSevenDays = getNextSevenDays();

  // Get day label (Today, Tomorrow, or day name)
  const getDayLabel = (date, index) => {
    if (index === 0) return "Today";
    if (index === 1) return "Tomorrow";
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  // Get events for a specific date
  const getEventsForDate = (date) => {
    return events.filter(event => {
      let eventDateObj = null;
      if (event && event.time) eventDateObj = buildLocalDateFromParts(event.date, event.time);
      else if (event && event.date) eventDateObj = parseDatePreserveLocal(event.date) || buildLocalDateFromParts(event.date);
      if (!eventDateObj) return false;
      return eventDateObj.toDateString() === date.toDateString();
    });
  };

  // Get current week dates for calendar
  const getCurrentWeekDates = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const dates = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - currentDay + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getCurrentWeekDates();
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Get productivity score
  const getProductivityScore = () => {
    if (events.length === 0) return 0;
    return Math.round((events.filter(e => e.completed).length / events.length) * 100);
  };

  // Event Modal Component
  const EventModal = () => {
    const [eventData, setEventData] = useState({
      title: '',
      type: 'assignment',
      courseId: '',
      date: new Date().toISOString().split('T')[0],
      // time is optional now; empty string means date-only event
      time: '',
      description: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
      if (!eventData.title) return;
      setIsSubmitting(true);
      
      // Simulate loading
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // compose stored date value: if time provided, create a local Date object, otherwise keep date string
      const storedDate = eventData.time
        ? buildLocalDateFromParts(eventData.date, eventData.time)
        : eventData.date; // keep as YYYY-MM-DD

      const newEvent = {
        id: Date.now(),
        ...eventData,
        date: storedDate,
        completed: false
      };
      setEvents(prev => [...prev, newEvent]);
      setShowEventModal(false);
      setIsSubmitting(false);
      setEventData({
        title: '',
        type: 'assignment',
        courseId: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        description: ''
      });
    };

    const handleDelete = async () => {
      if (!eventData || !eventData.id) return;
      try {
        const ok = window.confirm('Delete this event? This cannot be undone.');
        if (!ok) return;
        setEvents(prev => prev.filter(e => String(e.id) !== String(eventData.id)));
        setShowEventModal(false);
      } catch (e) {
        console.warn('Delete failed', e);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="cozy rounded-2xl p-6 w-96 max-w-md transform transition-all duration-300 scale-100 animate-pulse">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{eventData?.id ? 'Edit Event' : 'Add New Event'}</h3>
            <div className="flex items-center gap-2">
              {eventData?.id && (
                <button onClick={handleDelete} className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md">Delete</button>
              )}
              <button onClick={() => setShowEventModal(false)} className="hover:rotate-90 transition-transform duration-200">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Event title"
              value={eventData.title}
              onChange={(e) => setEventData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 transform focus:scale-[1.02]"
            />
            
            <select
              value={eventData.type}
              onChange={(e) => setEventData(prev => ({ ...prev, type: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            >
              <option value="assignment">📝 Assignment</option>
              <option value="exam">📚 Exam</option>
              <option value="lab">🔬 Lab</option>
              <option value="project">🚀 Project</option>
              <option value="other">📌 Other</option>
            </select>

            {courses.length > 0 && (
              <select
                value={eventData.courseId}
                onChange={(e) => setEventData(prev => ({ ...prev, courseId: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="">Select a course (optional)</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </select>
            )}
            
            <div className="flex gap-3">
              <input
                type="date"
                value={eventData.date}
                onChange={(e) => setEventData(prev => ({ ...prev, date: e.target.value }))}
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
              <input
                type="time"
                value={eventData.time}
                onChange={(e) => setEventData(prev => ({ ...prev, time: e.target.value }))}
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            
            <textarea
              placeholder="Description (optional)"
              value={eventData.description}
              onChange={(e) => setEventData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20 resize-none transition-all duration-200"
            />
            
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Adding...
                </div>
              ) : (
                'Add Event'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Course Modal Component
  const CourseModal = () => {
    const [courseData, setCourseData] = useState({
      name: '',
      professor: '',
      color: 'bg-blue-500',
      credits: 3
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const colorOptions = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500',
  'bg-yellow-500', 'bg-indigo-500', 'bg-purple-500', 'bg-orange-500'
    ];

    const handleSubmit = async () => {
      if (!courseData.name || !courseData.professor) return;
      setIsSubmitting(true);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const newCourse = {
        id: Date.now(),
        ...courseData
      };
      setCourses(prev => [...prev, newCourse]);
      setShowCourseModal(false);
      setIsSubmitting(false);
      setCourseData({
        name: '',
        professor: '',
        color: 'bg-blue-500',
        credits: 3
      });
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="cozy rounded-2xl p-6 w-96 max-w-md transform transition-all duration-300 scale-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Add New Course</h3>
            <button onClick={() => setShowCourseModal(false)} className="hover:rotate-90 transition-transform duration-200">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Course name"
              value={courseData.name}
              onChange={(e) => setCourseData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 transform focus:scale-[1.02]"
            />
            
            <input
              type="text"
              placeholder="Professor name"
              value={courseData.professor}
              onChange={(e) => setCourseData(prev => ({ ...prev, professor: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 transform focus:scale-[1.02]"
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Course Color</label>
              <div className="flex gap-2 flex-wrap">
                {colorOptions.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCourseData(prev => ({ ...prev, color }))}
                    className={`w-8 h-8 rounded-full ${color} ${courseData.color === color ? 'ring-2 ring-gray-400 scale-110' : 'hover:scale-110'} transition-all duration-200`}
                  />
                ))}
              </div>
            </div>
            
            <input
              type="number"
              placeholder="Credits"
              value={courseData.credits}
              onChange={(e) => setCourseData(prev => ({ ...prev, credits: parseInt(e.target.value) }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              min="1"
              max="6"
            />
            
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Adding...
                </div>
              ) : (
                'Add Course'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
  <div className="cozy border-b border-gray-200 backdrop-blur-lg bg-opacity-80 sticky top-0 z-40">
        <div className="px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800">Overview</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              {currentTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
            <div className="text-lg font-medium text-gray-600">
              {currentDate.toLocaleDateString('en-US', { month: 'long' })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Left Side */}
        <div className="w-1/2 p-6 space-y-6">
          {/* Weekly Report */}
          <div className="cozy rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full flex items-center justify-center animate-pulse">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-medium">Weekly report</span>
            </div>
            
            <div className="mb-4 h-24 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 transform -skew-x-12 animate-pulse"></div>
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center animate-bounce">
                <div className="text-2xl">📊</div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-gray-800 font-medium">{animatedStats.total} total events</p>
                  {getProductivityScore() > 80 && <Star className="w-4 h-4 text-yellow-500 animate-pulse" />}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-500">{animatedStats.completed} completed</p>
                  {getProductivityScore() > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${getProductivityScore()}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-green-600 font-medium">{getProductivityScore()}%</span>
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setShowCourseModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 text-blue-600 rounded-lg text-sm font-medium hover:from-blue-100 hover:to-purple-100 transition-all duration-300 transform hover:scale-105 hover:shadow-md"
              >
                <BookOpen className="w-4 h-4" />
                Add Course
              </button>
            </div>
          </div>

          {/* Days List */}
          <div className="space-y-6">
            {nextSevenDays.map((date, index) => {
              const dayLabel = getDayLabel(date, index);
              const formattedDate = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              });
              const dayEvents = getEventsForDate(date);
              const isSelected = selectedDay === index;
              
              return (
                <div 
                  key={index} 
                  className={`bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer ${
                    isSelected ? 'ring-2 ring-blue-500 scale-[1.02]' : ''
                  }`}
                  onClick={() => setSelectedDay(index)}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h2 className={`text-2xl font-semibold ${index === 0 ? 'text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600' : 'text-gray-800'}`}>
                      {dayLabel}
                      {index === 0 && <Zap className="w-6 h-6 text-yellow-500 inline-block ml-2 animate-pulse" />}
                    </h2>
                    <span className="text-sm text-gray-500">{formattedDate}</span>
                  </div>
                  
                  {dayEvents.length > 0 ? (
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full flex items-center justify-center">
                          <Clock className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-medium">
                          Pending events ({dayEvents.filter(e => !e.completed).length})
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        {dayEvents.map(event => {
                          const course = courses.find(c => c.id === parseInt(event.courseId));
                          return (
                            <div key={event.id} className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${event.completed ? 'bg-green-50' : 'bg-gray-50 hover:bg-blue-50'}`}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEvents(prev => prev.map(e => 
                                    e.id === event.id ? { ...e, completed: !e.completed } : e
                                  ));
                                }}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 transform hover:scale-110 ${
                                  event.completed 
                                    ? 'bg-gradient-to-br from-green-400 to-green-600 border-green-500' 
                                    : 'border-gray-300 hover:border-green-500 hover:bg-green-50'
                                }`}
                              >
                                {event.completed && <Check className="w-3 h-3 text-white" />}
                              </button>
                              <div className="flex-1">
                                <div className={`font-medium transition-all duration-200 ${event.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                  {event.title}
                                </div>
                                {course && (
                                  <div className={`text-xs px-2 py-1 rounded-full inline-block mt-1 ${course.color} text-white`}>
                                    {course.name}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-gray-400">
                                {formatTimeFromParts(event.date, event.time)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      No events scheduled
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side */}
        <div className="w-1/2 p-6 flex flex-col space-y-6">
          {/* Calendar */}
          <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <h2 className="text-lg font-medium text-gray-600 text-center mb-4">September</h2>
            
            {/* Calendar Grid */}
            <div className="mb-6">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {dayNames.map((day, index) => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar dates */}
              <div className="grid grid-cols-7 gap-2">
                {weekDates.map((date, index) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  const hasEvents = getEventsForDate(date).length > 0;
                  return (
                    <div key={index} className="text-center">
                      <div className={`w-8 h-8 flex items-center justify-center text-sm font-medium mx-auto relative transition-all duration-200 cursor-pointer ${
                        isToday 
                          ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full shadow-lg animate-pulse' 
                          : 'text-gray-700 hover:bg-blue-100 rounded-full hover:scale-110'
                      }`}>
                        {date.getDate()}
                        {hasEvents && !isToday && (
                          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full animate-pulse"></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Advanced Weekly Timetable */}
          <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 flex-1 flex flex-col">
            {/* Timetable Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Timetable</h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const newDate = new Date(currentDate);
                      newDate.setDate(newDate.getDate() - 7);
                      setCurrentDate(newDate);
                    }}
                    className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-blue-100 flex items-center justify-center transition-all duration-200 hover:scale-105"
                  >
                    <span className="text-gray-600 text-lg">←</span>
                  </button>
                  <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                    <span className="text-sm font-semibold text-gray-700">
                      {currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      const newDate = new Date(currentDate);
                      newDate.setDate(newDate.getDate() + 7);
                      setCurrentDate(newDate);
                    }}
                    className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-blue-100 flex items-center justify-center transition-all duration-200 hover:scale-105"
                  >
                    <span className="text-gray-600 text-lg">→</span>
                  </button>
                </div>
              </div>
              
              {/* Day Headers */}
              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="grid grid-cols-8 gap-2">
                  <div className="h-12 flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Time</span>
                  </div>
                  {weekDates.map((date, index) => {
                    const isToday = date.toDateString() === new Date().toDateString();
                    const dayEventsCount = getEventsForDate(date).length;
                    
                    return (
                      <div key={index} className={`h-12 rounded-xl flex flex-col items-center justify-center relative transition-all duration-300 ${
                        isToday 
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg scale-105' 
                          : 'bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300'
                      }`}>
                        <div className={`text-xs font-medium uppercase tracking-wide ${
                          isToday ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={`text-lg font-bold ${isToday ? 'text-white' : 'text-gray-800'}`}>
                          {date.getDate()}
                        </div>
                        {dayEventsCount > 0 && !isToday && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-red-400 to-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                            {dayEventsCount}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Timetable Grid */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto">
                <div className="p-4">
                  {/* Time slots from 7 AM to 9 PM */}
                  {Array.from({ length: 15 }, (_, i) => i + 7).map((hour) => {
                    const currentHour = currentTime.getHours();
                    const isCurrentHour = hour === currentHour;
                    const timeLabel = hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`;
                    
                    return (
                      <div key={hour} className="mb-2">
                        <div className="grid grid-cols-8 gap-2 items-center">
                          {/* Time label */}
                          <div className={`h-16 rounded-xl flex items-center justify-center transition-all duration-200 ${
                            isCurrentHour 
                              ? 'bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-400 scale-105' 
                              : 'bg-gray-50'
                          }`}>
                            <span className={`text-sm font-semibold ${
                              isCurrentHour ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {timeLabel}
                            </span>
                          </div>
                          
                          {/* Day cells */}
                          {weekDates.map((date, dayIndex) => {
                            const isToday = date.toDateString() === new Date().toDateString();
                            const dayEvents = getEventsForDate(date).filter(event => {
                              try {
                                const evtDt = event && event.time ? buildLocalDateFromParts(event.date, event.time) : (parseDatePreserveLocal(event.date) || buildLocalDateFromParts(event.date));
                                return evtDt ? evtDt.getHours() === hour : false;
                              } catch (e) { return false; }
                            });
                            
                            return (
                              <div 
                                key={`${hour}-${dayIndex}`} 
                                className={`h-16 rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer relative group ${
                                  isCurrentHour && isToday 
                                    ? 'border-red-300 bg-gradient-to-br from-red-50 to-orange-50' 
                                    : dayEvents.length > 0
                                    ? 'border-transparent'
                                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                }`}
                                onClick={() => setShowEventModal(true)}
                              >
                                {dayEvents.length > 0 ? (
                                  <div className="h-full w-full space-y-1 p-1">
                                    {dayEvents.slice(0, 2).map((event, eventIndex) => {
                                      const course = courses.find(c => c.id === parseInt(event.courseId));
                                      return (
                                        <div 
                                          key={event.id}
                                          className={`h-6 px-2 rounded-lg text-white text-xs font-medium flex items-center justify-between transition-all duration-200 hover:scale-105 cursor-pointer shadow-sm ${
                                            course ? course.color : 'bg-gradient-to-r from-blue-500 to-blue-600'
                                          } ${event.completed ? 'opacity-60 line-through' : 'hover:shadow-md'}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEvents(prev => prev.map(e => 
                                              e.id === event.id ? { ...e, completed: !e.completed } : e
                                            ));
                                          }}
                                        >
                                          <span className="truncate flex-1">{event.title}</span>
                                          <div className="w-4 h-4 flex items-center justify-center">
                                            {event.completed ? (
                                              <Check className="w-3 h-3" />
                                            ) : (
                                              <div className="w-2 h-2 bg-white rounded-full opacity-80"></div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {dayEvents.length > 2 && (
                                      <div className="text-xs text-center text-gray-500 font-medium">
                                        +{dayEvents.length - 2} more
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center h-full">
                                    <Plus className="w-5 h-5 text-gray-400" />
                                  </div>
                                )}
                                
                                {/* Current time indicator */}
                                {isCurrentHour && isToday && (
                                  <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 z-10">
                                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg"></div>
                                    <div className="absolute top-1/2 left-3 w-full h-0.5 bg-gradient-to-r from-red-500 to-transparent transform -translate-y-1/2"></div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Timetable Footer */}
            <div className="p-4 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50 rounded-b-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-dashed border-gray-300 rounded"></div>
                    <span>Click to add event</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>Click event to toggle</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span>Current time</span>
                  </div>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentDate(new Date())}
                  className="px-4 py-2 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  Today
                </button>
                <button 
                  onClick={() => setShowEventModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  Quick Add
                </button>
                <button 
                  onClick={() => setShowCourseModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  Add Course
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Add Button */}
      <button 
        onClick={() => setShowEventModal(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-110 hover:rotate-12 group"
      >
        <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full animate-pulse"></div>
      </button>

      {/* Modals */}
      {showEventModal && <EventModal />}
      {showCourseModal && <CourseModal />}
    </div>
  );
};

export default UniversityPlanner; 