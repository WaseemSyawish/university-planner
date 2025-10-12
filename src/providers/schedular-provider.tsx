"use client";

// SchedulerContext.tsx
import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  Dispatch,
  useEffect,
} from "react";
import { z } from "zod";

import {
  Action,
  Event,
  Getters,
  Handlers,
  SchedulerContextType,
  startOfWeek,
} from "@/types/index";
// date helpers for week calculations
import { getWeek } from 'date-fns/getWeek';
import { startOfWeekYear } from 'date-fns/startOfWeekYear';
import { addDays } from 'date-fns/addDays';
import ModalProvider from "./modal-context";
// Define event and state types

interface SchedulerState {
  events: Event[];
}

// Define the variant options
export const variants = [
  "success",
  "primary",
  "default",
  "warning",
  "danger",
] as const;

// Initial state
const initialState: SchedulerState = {
  events: [],
};

// Reducer function
const schedulerReducer = (
  state: SchedulerState,
  action: Action
): SchedulerState => {
  switch (action.type) {
    case "ADD_EVENT":
      // avoid duplicates by id
      if (!action.payload || !action.payload.id) {
        return state;
      }
      if (state.events.some(e => e.id === action.payload.id)) return state;
      return { ...state, events: [...state.events, action.payload] };

    case "REMOVE_EVENT":
      return {
        ...state,
        events: state.events.filter((event) => event.id !== action.payload.id),
      };
    case "UPDATE_EVENT":
      return {
        ...state,
        events: state.events.map((event) =>
          event.id === action.payload.id ? action.payload : event
        ),
      };
    case "SET_EVENTS":
      // ensure payload is deduped by id
      const list = Array.isArray(action.payload) ? action.payload : [];
      const seen = new Set();
      const deduped = list.filter((ev: Event) => {
        if (!ev || !ev.id) return false;
        if (seen.has(ev.id)) return false;
        seen.add(ev.id);
        return true;
      });
      return { ...state, events: deduped };

    default:
      return state;
  }
};

// Create the context with the correct type
const SchedulerContext = createContext<SchedulerContextType | undefined>(
  undefined
);

// Provider component
export const SchedulerProvider = ({
  children,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  initialState,
  weekStartsOn = "sunday",
  recurrenceOptions,
}: {
  onAddEvent?: (event: Event) => void;
  onUpdateEvent?: (event: Event) => void;
  onDeleteEvent?: (id: string) => void;
  weekStartsOn?: startOfWeek;
  children: ReactNode;
  initialState?: Event[];
  recurrenceOptions?: Array<{ id: string; label: string; rruleTemplate?: string | null }>
}) => {
  const [state, dispatch] = useReducer(
    schedulerReducer,
    { events: initialState ?? [] } // Sets initialState or an empty array as the default
  );

  useEffect(() => {
    if (initialState) {
      dispatch({ type: "SET_EVENTS", payload: initialState });
    }
  }, [initialState]);

  // Normalize weekStartsOn to supported values and fall back to sensible default
  // The settings UI uses 'monday' as its default, but some pages may pass 'sunday'.
  // Accept only 'sunday' or 'monday'. If another value is provided, default to 'monday'.
  const normalizedWeekStartsOn = weekStartsOn === 'sunday' ? 'sunday' : 'monday';

  // global getters
  const getDaysInMonth = (month: number, year: number) => {
    return Array.from(
      { length: new Date(year, month + 1, 0).getDate() },
      (_, index) => ({
        day: index + 1,
        events: [],
      })
    );
  };

  const getDaysInWeek = (week: number, year: number) => {
    // Use date-fns' startOfWeekYear to compute the first week start
    // Respect provider's weekStartsOn option (0 = Sunday, 1 = Monday)
  const startDay = normalizedWeekStartsOn === "sunday" ? 0 : 1;
  const firstWeekStart = startOfWeekYear(new Date(year, 0, 1), { weekStartsOn: startDay });
    const weekStart = addDays(firstWeekStart, (week - 1) * 7);

    // Generate the week's days
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    return days;
  };

  const getWeekNumber = (date: Date) => {
    // Use date-fns getWeek which respects weekStartsOn and firstWeekContainsDate
  const weekStartsOnOption = normalizedWeekStartsOn === "sunday" ? 0 : 1;
    // firstWeekContainsDate default to 4 (ISO-like behavior) to keep consistency
    return getWeek(date, { weekStartsOn: weekStartsOnOption, firstWeekContainsDate: 4 });
  };

  // Helper function to filter events for a specific day
  const getEventsForDay = (day: number, currentDate: Date) => {
    // Create a view of events where we prefer localStorage-backed endDate when
    // the server row doesn't include it. This allows the UI to reflect the
    // user's chosen end time even if the DB/Prisma schema didn't persist it.
    const adjustedEvents = (state?.events || []).map((event) => {
      try {
        if (typeof window !== 'undefined' && event && event.id) {
          const key = `saved_event_${event.id}`;
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && parsed.endDate && (!event.endDate || String(event.endDate) !== String(parsed.endDate))) {
                return { ...event, endDate: parsed.endDate };
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
      return event;
    });

    return adjustedEvents.filter((event) => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);

      // Create new Date objects to avoid mutating `currentDate`
      const startOfDay = new Date(currentDate);
      startOfDay.setDate(day);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(currentDate);
      endOfDay.setDate(day + 1);
      endOfDay.setHours(0, 0, 0, 0);

      // Check if the event starts or spans across the given day
      const isSameDay =
        eventStart.getDate() === day &&
        eventStart.getMonth() === currentDate.getMonth() &&
        eventStart.getFullYear() === currentDate.getFullYear();

      const isSpanningDay = eventStart < endOfDay && eventEnd >= startOfDay;

      return isSameDay || isSpanningDay;
    });
  };

  const getDayName = (day: number) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[day];
  };

  const getters: Getters = {
    getDaysInMonth,
    getEventsForDay,
    getDaysInWeek,
    getWeekNumber,
    getDayName,
  };

  // handlers
  function handleEventStyling(
    event: Event, 
    dayEvents: Event[],
    periodOptions?: { 
      eventsInSamePeriod?: number; 
      periodIndex?: number; 
      adjustForPeriod?: boolean;
    }
  ) {
    // Mina-inspired minutes-based layout
    const toMillis = (d: any) => (d instanceof Date ? d.getTime() : new Date(d).getTime());
    const ensureDate = (d: any) => (d instanceof Date ? d : new Date(d));

    // Row height per hour - matches the hourly row height used in day/week views (64px)
    const ROW_PX_PER_HOUR = 64;

    // Build a list of items for the same day (or overlapping range)
    const items = (dayEvents || []).filter((ev) => ev && ev.startDate && ev.endDate).map(ev => {
      const s = ensureDate(ev.startDate);
      const e = ensureDate(ev.endDate);
      const startMinutes = s.getHours() * 60 + s.getMinutes();
      const endMinutes = e.getHours() * 60 + e.getMinutes();
      const duration = Math.max(1, endMinutes - startMinutes);
      return { ev, startMinutes, endMinutes, duration };
    }).sort((a,b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);

    // Simple column packing like Mina: place each event in the first column that doesn't overlap
    const columns: Array<Array<any>> = [];
    const columnsIndexMap: number[] = [];
    items.forEach((it, idx) => {
      let placed = false;
      for (let ci = 0; ci < columns.length; ci++) {
        const col = columns[ci];
        const last = col[col.length - 1];
        if (it.startMinutes >= last.endMinutes) {
          col.push(it);
          columnsIndexMap[idx] = ci;
          placed = true;
          break;
        }
      }
      if (!placed) {
        columnsIndexMap[idx] = columns.length;
        columns.push([it]);
      }
    });

    const totalCols = Math.max(1, columns.length);

    // Find current event item
    const thisStart = ensureDate(event.startDate);
    const thisEnd = ensureDate(event.endDate);
    const thisStartMin = thisStart.getHours() * 60 + thisStart.getMinutes();
    const thisEndMin = thisEnd.getHours() * 60 + thisEnd.getMinutes();
    const thisDuration = Math.max(1, thisEndMin - thisStartMin);

    // Determine which column index this event occupies (fallback to 0)
    let colIndex = 0;
    for (let ci = 0; ci < columns.length; ci++) {
      if (columns[ci].some(it => it.ev.id === event.id)) { colIndex = ci; break; }
    }

    const widthPercent = 100 / totalCols;
    const leftPercent = colIndex * widthPercent;

    // Compute pixels
    const topPx = (thisStartMin / 60) * ROW_PX_PER_HOUR;
    const heightPx = Math.max(20, (thisDuration / 60) * ROW_PX_PER_HOUR);

    return {
      height: `${heightPx}px`,
      top: `${topPx}px`,
      zIndex: colIndex + 1,
      left: `${leftPercent}%`,
      maxWidth: `${widthPercent}%`,
      minWidth: `${widthPercent}%`,
    };
  }

  async function handleAddEvent(event: Event) {
    // If a parent handler is provided, call it and await its result. Only
    // update local state after the parent returns a server-canonical event so
    // the provider does not keep optimistic (possibly different) values that
    // get overwritten on reload.
    if (onAddEvent) {
      try {
        const res: any = await onAddEvent(event);
          // If parent returned the saved canonical event, use it to update local state
          if (res && res.id) {
            try { dispatch({ type: "ADD_EVENT", payload: res }); } catch (e) {}
            return res;
          }
          // Parent did not return a canonical saved event.
          // Fall back to local optimistic add so the UI still reflects the new event.
          try { dispatch({ type: "ADD_EVENT", payload: event }); } catch (e) {}
          return event;
        } catch (e: any) {
          // If the error is a client-side (4xx) response, rethrow so callers can show validation
          // Otherwise (network error or 5xx) we can fallback to local optimistic add to keep UI responsive
          try {
            const status = e && (e.status || e.statusCode || (e.response && e.response.status))
            if (status && Number(status) >= 400 && Number(status) < 500) {
              console.warn('[SchedulerProvider] onAddEvent returned client error, aborting local fallback', status, e)
              throw e
            }
          } catch (inner) {}
          console.warn('[SchedulerProvider] onAddEvent handler failed, falling back to local add', e);
        }
    }
    dispatch({ type: "ADD_EVENT", payload: event });
    return event;
  }

  async function handleUpdateEvent(event: Event, id: string) {
    // Prefer to let the parent persist the change and return the canonical
    // event; only then update local state with the authoritative values.
    if (onUpdateEvent) {
      try {
        const res: any = await onUpdateEvent({ ...event, id });
        if (res && res.id) {
          try { dispatch({ type: "UPDATE_EVENT", payload: res }); } catch (e) {}
        }
        return res;
      } catch (e) {
        // If parent handler fails, fall back to optimistic local update so UI still reflects change
        console.warn('[SchedulerProvider] onUpdateEvent handler failed, applying optimistic update', e);
        try { dispatch({ type: "UPDATE_EVENT", payload: { ...event, id } }); } catch (err) {}
        // rethrow so callers can handle failure if needed
        throw e;
      }
    }

    // No parent handler: do a local optimistic update
    try {
      dispatch({ type: "UPDATE_EVENT", payload: { ...event, id } });
    } catch (e) {
      console.warn('[SchedulerProvider] local dispatch update failed', e);
    }
    return { ...event, id };
  }

  function handleDeleteEvent(id: string) {
    if (onDeleteEvent) {
      try {
        const maybe: any = onDeleteEvent(id);
        return maybe;
      } catch (e) {
        // fall back to local remove
      }
    }
    dispatch({ type: "REMOVE_EVENT", payload: { id } });
  }

  // Local-only handlers: allow callers to update provider state without delegating
  // persistence to parent page handlers. Useful when the caller performs the
  // network request itself and only wants to update UI after confirmation.
  function handleLocalAddEvent(event: Event) {
    try {
      try {
        // debug: log the incoming event for troubleshooting
        console.debug('[SchedulerProvider] handleLocalAddEvent incoming:', event);
      } catch (e) {}
      dispatch({ type: "ADD_EVENT", payload: event });
      try {
        console.debug('[SchedulerProvider] events after add (count):', (state && state.events && state.events.length) ? state.events.length + 1 : 'unknown');
      } catch (e) {}
    } catch (e) {
      // swallow - UI best-effort
    }
  }

  function handleLocalUpdateEvent(event: Event) {
    try {
      try {
        console.debug('[SchedulerProvider] handleLocalUpdateEvent incoming:', event);
      } catch (e) {}
      if (!event || !event.id) return;
      dispatch({ type: "UPDATE_EVENT", payload: event });
      try {
        console.debug('[SchedulerProvider] events after update (count):', (state && state.events && state.events.length) ? state.events.length : 'unknown');
      } catch (e) {}
    } catch (e) {
      // swallow
    }
  }

  const handlers: Handlers = {
    handleEventStyling,
    handleAddEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    // local-only helpers
    handleLocalAddEvent,
    handleLocalUpdateEvent,
  };

  return (
    <SchedulerContext.Provider
      // include recurrenceOptions if passed via props (kept backward compatible)
      value={{ events: state, dispatch, getters, handlers, weekStartsOn, recurrenceOptions }}
    >
      <ModalProvider>{children}</ModalProvider>
    </SchedulerContext.Provider>
  );
};

// Custom hook to use the scheduler context
export const useScheduler = () => {
  const context = useContext(SchedulerContext);
  if (!context) {
    throw new Error("useScheduler must be used within a SchedulerProvider");
  }
  return context;
};
