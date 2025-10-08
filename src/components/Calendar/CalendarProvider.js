"use client";
import React, { createContext, useContext, useMemo, useState } from 'react';
import { useLocalStorage } from '../../lib/useLocalStorage';

const CalendarContext = createContext(null);

export function CalendarProvider({ children, initialEvents = [], initialUsers = [] }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState(initialEvents);
  const [users] = useState(initialUsers);

  const addEvent = (ev) => setEvents((s) => [...s, ev]);
  const updateEvent = (ev) => setEvents((s) => s.map((e) => (e.id === ev.id ? ev : e)));
  const removeEvent = (id) => setEvents((s) => s.filter((e) => e.id !== id));

  const value = useMemo(() => ({
    selectedDate,
    setSelectedDate,
    events,
    addEvent,
    updateEvent,
    removeEvent,
    users,
  }), [selectedDate, events, users]);

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar must be used inside CalendarProvider');
  return ctx;
}
