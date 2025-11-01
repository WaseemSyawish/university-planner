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

// Expose a global type for legacy callers that use window.__schedulerHandlers
declare global {
  interface Window {
    __schedulerHandlers?: any;
  }
}
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
import { parseDatePreserveLocal, buildLocalDateFromParts, toYMDLocal } from '../lib/dateHelpers';
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

// Minimal normalization for incoming event objects so the rest of the app
// can rely on common fields. This keeps the change local and low-risk.
function normalizeEvent(ev: any) {
  if (!ev || typeof ev !== 'object') return ev;
  const clone: any = { ...ev };

  // normalize color: prefer `color`, then `raw.color`, `raw.color_key`, or `color_key`.
  // If value looks like a variant name, map it to a sensible color key.
  const candidateColor =
    clone.color ||
    (clone.raw && (clone.raw.color || clone.raw.color_key || clone.raw.colorKey)) ||
    clone.color_key ||
    clone.colorKey ||
    clone.variant ||
    clone.type ||
    null;

  const variantToKey: Record<string, string> = {
    primary: 'blue',
    success: 'green',
    warning: 'yellow',
    danger: 'red',
    default: 'gray',
  };

  if (candidateColor) {
    // Normalize string forms: hex (#aabbcc), Tailwind-like classes (bg-blue-500),
    // semantic classes (bg-primary) or simple keys ('blue').
    if (typeof candidateColor === 'string') {
      const raw = candidateColor.trim();
      // hex
      if (/^#/.test(raw)) {
        clone.color = raw;
      } else {
        // remove leading 'bg-' if present
        let s = raw.replace(/^bg-/, '');
        // if it's a tailwind shade like 'blue-500', take the base color
        const shadeMatch = s.match(/^([a-z]+)-\d{3,4}$/i);
        if (shadeMatch) s = shadeMatch[1];

        // map some common semantic names to canonical keys
        const semanticMap: Record<string, string> = {
          primary: 'blue',
          secondary: 'slate',
          accent: 'purple',
          info: 'blue',
          success: 'green',
          warning: 'yellow',
          error: 'red',
          neutral: 'gray',
        };

        if (variantToKey[s]) {
          clone.color = variantToKey[s];
        } else if (semanticMap[s]) {
          clone.color = semanticMap[s];
        } else if (/^[a-z]+$/i.test(s)) {
          // common color keyword like 'blue', 'red', etc.
          clone.color = s.toLowerCase();
        } else {
          // last resort: keep original string
          clone.color = raw;
        }
      }
    } else {
      // non-string candidate: keep as-is
      clone.color = candidateColor;
    }
  }

  // Normalize template id presence: server expects `template_id` for bulk ops
  const templateId =
    clone.template_id ||
    clone.templateId ||
    (clone.raw && (clone.raw.template_id || clone.raw.templateId)) ||
    null;
  if (templateId) clone.template_id = templateId;

  return clone;
}

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
      return { ...state, events: [...state.events, normalizeEvent(action.payload)] };

    case "REMOVE_EVENT":
      return {
        ...state,
        events: state.events.filter((event) => event.id !== action.payload.id),
      };
    case "UPDATE_EVENT":
      return {
        ...state,
        events: state.events.map((event) =>
          event.id === action.payload.id ? normalizeEvent(action.payload) : event
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
      }).map((ev: any) => normalizeEvent(ev));
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
  // onUpdateEvent may accept an optional scope parameter when callers want to
  // indicate whether the change should apply to a single occurrence, future
  // occurrences, or the whole series.
  onUpdateEvent?: (event: Event, scope?: string) => void;
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
      const eventStart = parseDatePreserveLocal(event.startDate) || (event.startDate ? new Date(event.startDate) : null);
      const eventEnd = parseDatePreserveLocal(event.endDate) || (event.endDate ? new Date(event.endDate) : null);

  // Create new Date objects to avoid mutating `currentDate`
  const startOfDay = new Date(currentDate);
  startOfDay.setDate(day);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(currentDate);
  endOfDay.setDate(day + 1);
  endOfDay.setHours(0, 0, 0, 0);

      // Check if the event starts or spans across the given day
      const isSameDay = eventStart &&
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
    const toMillis = (d: any) => {
      if (d instanceof Date) return d.getTime();
      const dt = parseDatePreserveLocal(d);
      if (dt && !isNaN(dt.getTime())) return dt.getTime();
      return new Date(d).getTime();
    };
    const ensureDate = (d: any) => (d instanceof Date ? d : (parseDatePreserveLocal(d) || new Date(d)));

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

  async function handleUpdateEvent(event: Event, id: string, scope?: string) {
    // For series-scoped updates (all/future) we prefer the server-authoritative
    // path and do a preview-then-apply sequence from the provider so all UI
    // entrypoints behave consistently. If this fails we fall back to the
    // parent-provided handler or optimistic local update.
    if (scope === 'all' || scope === 'future') {
      try {
        // Serialize a minimal body for preview; include date when available so
        // server can compute 'future' boundaries correctly.
        const serializeDate = (d: any) => {
          try {
            if (!d) return undefined;
            if (d instanceof Date) return d.toISOString();
            return String(d);
          } catch (e) { return undefined; }
        };

        const previewBody: any = {};
        if (Object.prototype.hasOwnProperty.call(event, 'date')) previewBody.date = event.date;
        else if (Object.prototype.hasOwnProperty.call(event, 'startDate')) previewBody.date = serializeDate((event as any).startDate);

        const previewQs = new URLSearchParams({ scope, preview: 'true' });
        const previewUrl = `/api/events/${encodeURIComponent(id)}?${previewQs.toString()}`;
        const previewRes = await fetch(previewUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(previewBody)
        });

        // If preview failed, throw to trigger fallback below
        if (!previewRes.ok) {
          const txt = await previewRes.text().catch(() => null);
          throw new Error(`Series preview failed ${previewRes.status}: ${txt}`);
        }

        const previewJson = await previewRes.json().catch(() => null);
        // Now apply the update on the server using the authoritative payload.
        // Build the apply body from the incoming event (convert Date -> ISO)
        const applyBody: any = {};
        if (Object.prototype.hasOwnProperty.call(event, 'title')) applyBody.title = (event as any).title;
        if (Object.prototype.hasOwnProperty.call(event, 'description')) applyBody.description = (event as any).description;
        if (Object.prototype.hasOwnProperty.call(event, 'time')) applyBody.time = (event as any).time;
        if (Object.prototype.hasOwnProperty.call(event, 'date')) applyBody.date = event.date;
        if (Object.prototype.hasOwnProperty.call(event, 'meta')) applyBody.meta = (event as any).meta;
        // include repeatOption when present on raw/meta
        try { if ((event as any).repeatOption) applyBody.repeatOption = (event as any).repeatOption; } catch (e) {}

        const applyQs = new URLSearchParams({ scope });
        const applyUrl = `/api/events/${encodeURIComponent(id)}?${applyQs.toString()}`;
        const applyRes = await fetch(applyUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(applyBody)
        });

        const applyJson = await applyRes.json().catch(() => null);
        if (!applyRes.ok) {
          const txt = await applyRes.text().catch(() => null);
          throw new Error(`Series apply failed ${applyRes.status}: ${txt}`);
        }

        // Refresh authoritative event list from server when available
        try {
          const listRes = await fetch('/api/events');
          if (listRes && listRes.ok) {
            const body = await listRes.json().catch(() => null);
            const eventsList = Array.isArray(body?.events) ? body.events : (Array.isArray(body) ? body : []);
            dispatch({ type: 'SET_EVENTS', payload: eventsList });
          }
        } catch (e) {
          // non-fatal: if refresh fails, attempt to update local event with returned value
          try {
            if (applyJson && applyJson.event) dispatch({ type: 'UPDATE_EVENT', payload: applyJson.event });
          } catch (e2) {}
        }

        return applyJson;
      } catch (seriesErr) {
        console.warn('[SchedulerProvider] series-scoped update failed, falling back to parent handler or optimistic update', seriesErr);
        // fall through to parent handler / optimistic update below
      }
    }

    // Prefer to let the parent persist the change and return the canonical
    // event; only then update local state with the authoritative values.
    if (onUpdateEvent) {
      try {
        const res: any = await onUpdateEvent({ ...event, id }, scope);
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

  // scope-aware delete handler. If scope === 'all' attempts a server-side
  // bulk delete (DELETE /api/events/{id}?scope=all) and then refreshes the
  // provider state by loading current events from the server. When scope
  // is omitted or 'single', behavior is unchanged (call parent handler or
  // remove locally).
  async function handleDeleteEvent(id: string, scope?: string) {
  console.log(`[SchedulerProvider] handleDeleteEvent called: id=${id}, scope=${scope}`);
  
  try {
    if (scope === 'all') {
      // Discover template_id locally to pass to server
      let discoveredTplId: string | null = null;
      let eventToDelete: any = null;
      
      try {
        const events = (state && state.events) ? state.events : [];
        eventToDelete = events.find((ev: any) => String(ev.id) === String(id)) || null;
        
        console.log('[SchedulerProvider] Event found in state:', eventToDelete);
        console.log('[SchedulerProvider] All events:', events.map((e: any) => ({ 
          id: e.id, 
          title: e.title, 
          template_id: e.template_id 
        })));
        
        if (eventToDelete) {
          // Cast to any to access properties that might not be in type definition
          const evt = eventToDelete as any;
          
          discoveredTplId = 
            evt.template_id || 
            evt.templateId ||
            (evt.raw && (evt.raw.template_id || evt.raw.templateId)) || 
            null;
          
          console.log('[SchedulerProvider] Discovered template_id:', discoveredTplId);
          console.log('[SchedulerProvider] Full event object:', JSON.stringify(eventToDelete, null, 2));
        } else {
          console.warn('[SchedulerProvider] Event not found in state for id:', id);
        }
      } catch (e) {
        console.warn('[SchedulerProvider] Failed to discover template_id:', e);
      }
      
      console.log(`[SchedulerProvider] Attempting bulk delete with template_id=${discoveredTplId}`);
      
      // Call server-side bulk delete
      try {
        const queryParams = new URLSearchParams({ scope: 'all' });
        if (discoveredTplId) {
          queryParams.append('templateId', discoveredTplId);
        } else {
          // If no template_id discovered, try to provide repeatOption to help server
          // identify series materialized without template linkage.
          try {
            const evt: any = eventToDelete || null;
            const repeatOption = evt && (evt.repeatOption || (evt.raw && (evt.raw.repeatOption || evt.raw.repeat_option))) || null;
            if (repeatOption) queryParams.append('repeatOption', String(repeatOption));
          } catch (e) { /* ignore */ }
        }

        const url = `/api/events/${encodeURIComponent(id)}?${queryParams.toString()}`;
        console.log(`[SchedulerProvider] DELETE request: ${url}`);
        
        const res = await fetch(url, { 
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const responseData = await res.json().catch(() => ({}));
        console.log('[SchedulerProvider] DELETE response:', { 
          ok: res.ok, 
          status: res.status, 
          data: responseData 
        });
        
        if (!res.ok) {
          // If the server indicates the event is not part of a series (missing template),
          // perform a single-event delete fallback rather than throwing immediately.
          const code = responseData && responseData.code ? responseData.code : null;
          const msg = responseData && responseData.message ? String(responseData.message).toLowerCase() : '';
          if (code === 'NO_TEMPLATE' || msg.includes('not part of') || msg.includes('template_id is missing') || msg.includes('template id is missing')) {
            console.warn('[SchedulerProvider] Server returned NO_TEMPLATE or missing template; attempting single-delete fallback for id=', id);
            try {
              const singleRes = await fetch(`/api/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
              if (singleRes && singleRes.ok) {
                // refresh events if possible
                try {
                  const listRes = await fetch('/api/events');
                  if (listRes && listRes.ok) {
                    const body = await listRes.json().catch(() => null);
                    const eventsList = Array.isArray(body?.events) ? body.events : (Array.isArray(body) ? body : []);
                    dispatch({ type: 'SET_EVENTS', payload: eventsList });
                    return { success: true, deleted: true, count: 1 };
                  }
                } catch (e) {
                  // Fall through to local remove
                }
                // If refresh failed, remove locally
                dispatch({ type: 'REMOVE_EVENT', payload: { id } });
                return { success: true, deleted: true, count: 1 };
              }
            } catch (e) {
              console.warn('[SchedulerProvider] single-delete fallback request failed', e);
            }
            // If fallback didn't succeed, allow error to be thrown below
          }
          throw new Error(responseData.message || `Delete failed with status ${res.status}`);
        }
        
        // Success - refresh events from server
        console.log('[SchedulerProvider] Bulk delete successful, refreshing events...');
        
        try {
          const listRes = await fetch('/api/events');
          if (listRes && listRes.ok) {
            const body = await listRes.json().catch(() => null);
            const eventsList = Array.isArray(body?.events) ? body.events : (Array.isArray(body) ? body : []);
            
            console.log(`[SchedulerProvider] Loaded ${eventsList.length} events after bulk delete`);
            dispatch({ type: 'SET_EVENTS', payload: eventsList });
            
            return { 
              success: true, 
              deleted: true, 
              count: responseData.deletedCount || responseData.details?.total || 0 
            };
          }
        } catch (refreshErr) {
          console.warn('[SchedulerProvider] Failed to refresh events after bulk delete:', refreshErr);
          
          // Fallback: remove events with matching template_id from local state
          if (discoveredTplId) {
            const events = (state && state.events) ? state.events : [];
            const filtered = events.filter((ev: any) => {
              const evTpl = 
                ev.template_id || 
                ev.templateId ||
                (ev.raw && (ev.raw.template_id || ev.raw.templateId)) || 
                null;
              return !evTpl || String(evTpl) !== String(discoveredTplId);
            });
            
            console.log(`[SchedulerProvider] Filtered ${events.length - filtered.length} events locally`);
            dispatch({ type: 'SET_EVENTS', payload: filtered });
          }
        }
        
        return { success: true, deleted: true };
        
      } catch (deleteErr: any) {
        console.error('[SchedulerProvider] Bulk delete failed:', deleteErr);
        
        // If server delete failed, try client-side fallback
        if (discoveredTplId) {
          console.log('[SchedulerProvider] Attempting client-side bulk delete fallback...');
          
          try {
            // Fetch all events
            const listRes = await fetch('/api/events');
            if (listRes && listRes.ok) {
              const body = await listRes.json().catch(() => null);
              const eventsList = Array.isArray(body?.events) ? body.events : (Array.isArray(body) ? body : []);
              
              // Find all events with matching template_id
              const toDelete = eventsList.filter((ev: any) => {
                const evTpl = 
                  ev.template_id || 
                  ev.templateId ||
                  (ev.raw && (ev.raw.template_id || ev.raw.templateId)) || 
                  null;
                return evTpl && String(evTpl) === String(discoveredTplId);
              });
              
              console.log(`[SchedulerProvider] Found ${toDelete.length} events to delete`);
              
              // Delete each event individually
              let deletedCount = 0;
              for (const ev of toDelete) {
                try {
                  const delRes = await fetch(`/api/events/${encodeURIComponent(ev.id)}`, { 
                    method: 'DELETE' 
                  });
                  if (delRes.ok) deletedCount++;
                } catch (e) {
                  console.warn(`[SchedulerProvider] Failed to delete event ${ev.id}:`, e);
                }
              }
              
              console.log(`[SchedulerProvider] Deleted ${deletedCount}/${toDelete.length} events`);
              
              // Refresh events list
              const refreshRes = await fetch('/api/events');
              if (refreshRes && refreshRes.ok) {
                const refreshBody = await refreshRes.json().catch(() => null);
                const refreshedEvents = Array.isArray(refreshBody?.events) ? refreshBody.events : (Array.isArray(refreshBody) ? refreshBody : []);
                dispatch({ type: 'SET_EVENTS', payload: refreshedEvents });
                
                return { success: true, deleted: true, count: deletedCount };
              }
            }
          } catch (fallbackErr) {
            console.error('[SchedulerProvider] Client-side fallback failed:', fallbackErr);
          }
        }
        
        // Last resort: remove locally
        console.log('[SchedulerProvider] Removing event locally as last resort');
        dispatch({ type: 'REMOVE_EVENT', payload: { id } });
        
        throw deleteErr;
      }
    }
    
    // Single delete (scope !== 'all')
    if (onDeleteEvent) {
      try {
        const result: any = await onDeleteEvent(id);
        dispatch({ type: "REMOVE_EVENT", payload: { id } });
        return result;
      } catch (e) {
        console.warn('[SchedulerProvider] onDeleteEvent handler failed:', e);
        dispatch({ type: "REMOVE_EVENT", payload: { id } });
        throw e;
      }
    }
    
    dispatch({ type: "REMOVE_EVENT", payload: { id } });
    return { success: true };
    
  } catch (err) {
    console.error('[SchedulerProvider] handleDeleteEvent error:', err);
    
    // Remove locally as last resort
    try {
      dispatch({ type: "REMOVE_EVENT", payload: { id } });
    } catch (e) {}
    
    return { success: false, error: err };
  }
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

  // Expose a global shortcut so non-context callers (legacy code paths)
  // can delegate to the provider's handlers via window.__schedulerHandlers.
  // This keeps backward compatibility with components that reference that
  // global instead of using the context hook.
  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        // assign a shallow copy to avoid external mutation of our handlers
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        window.__schedulerHandlers = handlers;
      }
    } catch (e) {}
    return () => {
      try {
        if (typeof window !== 'undefined' && window.__schedulerHandlers) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          delete window.__schedulerHandlers;
        }
      } catch (e) {}
    };
  }, [handlers]);

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
