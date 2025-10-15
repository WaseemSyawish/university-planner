"use client";

import React, { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

import { ArrowLeft, ArrowRight } from "lucide-react";

import { useScheduler } from "@/providers/schedular-provider";
import { useModal } from "@/providers/modal-context";
import AddEventModal from "@/components/schedule/_modals/add-event-modal";
import EventStyled from "../event-component/event-styled";
import { CustomEventModal, Event } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CustomModal from "@/components/ui/custom-modal";

// Lightweight wrapper to memoize event props and avoid unnecessary re-renders
const EventWrapper = React.memo(function EventWrapper({
  event,
  CustomEventComponent,
  CustomEventModal,
}: {
  event: Event;
  CustomEventComponent?: React.FC<Event>;
  CustomEventModal?: CustomEventModal;
}) {
  const memoized = React.useMemo(() => ({ ...event, CustomEventComponent, minmized: true }), [event, CustomEventComponent]);
  return <EventStyled event={memoized as any} CustomEventModal={CustomEventModal} />;
});

// Generate hours in 12-hour format
const hours = Array.from({ length: 24 }, (_, i) => {
  const hour = i % 12 || 12;
  const ampm = i < 12 ? "AM" : "PM";
  return `${hour}:00 ${ampm}`;
});

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 5 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.12 } },
};

const pageTransitionVariants = {
  enter: (direction: number) => ({
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    opacity: 0,
    transition: {
      opacity: { duration: 0.2, ease: "easeInOut" },
    },
  }),
};

// Precise time-based event grouping function
const groupEventsByTimePeriod = (events: Event[] | undefined) => {
  if (!events || events.length === 0) return [];
  
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  
  const eventsOverlap = (event1: Event, event2: Event) => {
    const start1 = new Date(event1.startDate).getTime();
    const end1 = new Date(event1.endDate).getTime();
    const start2 = new Date(event2.startDate).getTime();
    const end2 = new Date(event2.endDate).getTime();
    
    return (start1 < end2 && start2 < end1);
  };
  
  const buildOverlapGraph = (events: Event[]) => {
    const graph: Record<string, string[]> = {};
    
    events.forEach(event => {
      graph[event.id] = [];
    });
    
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        if (eventsOverlap(events[i], events[j])) {
          graph[events[i].id].push(events[j].id);
          graph[events[j].id].push(events[i].id);
        }
      }
    }
    
    return graph;
  };
  
  const findConnectedComponents = (graph: Record<string, string[]>, events: Event[]) => {
    const visited: Record<string, boolean> = {};
    const components: Event[][] = [];
    
    const dfs = (nodeId: string, component: string[]) => {
      visited[nodeId] = true;
      component.push(nodeId);
      
      for (const neighbor of graph[nodeId]) {
        if (!visited[neighbor]) {
          dfs(neighbor, component);
        }
      }
    };
    
    for (const event of events) {
      if (!visited[event.id]) {
        const component: string[] = [];
        dfs(event.id, component);
        
        const eventGroup = component.map(id => 
          events.find(e => e.id === id)!
        );
        
        components.push(eventGroup);
      }
    }
    
    return components;
  };
  
  const graph = buildOverlapGraph(sortedEvents);
  const timeGroups = findConnectedComponents(graph, sortedEvents);
  
  return timeGroups.map(group => 
    group.sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    )
  );
};

export default function DailyView({
  prevButton,
  nextButton,
  CustomEventComponent,
  CustomEventModal,
  stopDayEventSummary,
  classNames,
}: {
  prevButton?: React.ReactNode;
  nextButton?: React.ReactNode;
  CustomEventComponent?: React.FC<Event>;
  CustomEventModal?: CustomEventModal;
  stopDayEventSummary?: boolean;
  classNames?: { prev?: string; next?: string; addEvent?: string };
}) {
  const hoursColumnRef = useRef<HTMLDivElement>(null);
  // Replace per-frame React state updates with DOM writes. Keep a small
  // isHovering state to toggle visibility; update timeline text/position via refs.
  const [isHovering, setIsHovering] = useState(false);
  const isHoveringRef = useRef(false);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const badgeRef = useRef<HTMLDivElement | null>(null);
  const rAFRef = useRef<number | null>(null);
  const lastMouseEventRef = useRef<MouseEvent | null>(null);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [direction, setDirection] = useState<number>(0);
  const { setOpen } = useModal();
  const { getters, handlers } = useScheduler();

  React.useEffect(() => {
    function onGoToDate(e: any) {
      try {
        const d = e?.detail?.date ? new Date(String(e.detail.date)) : new Date();
        setCurrentDate(d);
      } catch (err) {}
    }
    window.addEventListener('scheduler:goToDate', onGoToDate as any);
    return () => window.removeEventListener('scheduler:goToDate', onGoToDate as any);
  }, []);

  // Batch mousemove updates via requestAnimationFrame to avoid flooding React
  // with setState calls while the user is moving the mouse.

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!hoursColumnRef.current) return;
    // ensure hover flag set once
    if (!isHoveringRef.current) {
      isHoveringRef.current = true;
      setIsHovering(true);
    }

    lastMouseEventRef.current = e.nativeEvent;

    if (rAFRef.current == null) {
      rAFRef.current = requestAnimationFrame(() => {
        try {
          const ev = lastMouseEventRef.current;
          if (!ev || !hoursColumnRef.current) return;
          const rect = hoursColumnRef.current.getBoundingClientRect();
          const y = ev.clientY - rect.top;
          const hourHeight = rect.height / 24;
          const hour = Math.max(0, Math.min(23, Math.floor(y / hourHeight)));
          const minuteFraction = (y % hourHeight) / hourHeight;
          const minutes = Math.floor(minuteFraction * 60);

          const hour12 = hour % 12 || 12;
          const ampm = hour < 12 ? "AM" : "PM";
          const formatted = `${hour12}:${Math.max(0, minutes).toString().padStart(2, "0")} ${ampm}`;

          const position = Math.max(0, Math.min(rect.height, Math.round(y)));

          if (timelineRef.current) timelineRef.current.style.top = `${position}px`;
          if (badgeRef.current) badgeRef.current.textContent = formatted;
        } finally {
          if (rAFRef.current != null) { cancelAnimationFrame(rAFRef.current); rAFRef.current = null; }
        }
      });
    }
  }, []);

  // cleanup
  React.useEffect(() => {
    return () => {
      if (rAFRef.current != null) {
        cancelAnimationFrame(rAFRef.current);
        rAFRef.current = null;
      }
    };
  }, []);

  const getFormattedDayTitle = useCallback(
    () => currentDate.toDateString(),
    [currentDate]
  );

  const dayEvents = getters.getEventsForDay(
    currentDate?.getDate() || 0,
    currentDate
  );
  
  // Memoize grouping and layout to avoid expensive recomputation on frequent
  // UI-only updates (like mousemove timeline). Use a compact events key
  // based on id,start,end timestamps so changes to other UI state don't
  // invalidate the memo.
  const eventsKey = React.useMemo(() => {
    if (!dayEvents) return '';
    return dayEvents
      .map(e => `${e.id}:${new Date(e.startDate).getTime()}:${new Date(e.endDate).getTime()}`)
      .join('|');
  }, [dayEvents]);

  const timeGroups = React.useMemo(() => groupEventsByTimePeriod(dayEvents), [eventsKey]);

  const computeMinaStyle = React.useCallback((event: Event, allDayEvents: Event[] | undefined) => {
    const ROW_PX_PER_HOUR = 64;
    const ensureDate = (d: any) => (d instanceof Date ? d : new Date(d));

    const items = (allDayEvents || [])
      .filter((ev) => ev && ev.startDate && ev.endDate)
      .map((ev) => {
        const s = ensureDate(ev.startDate);
        const e = ensureDate(ev.endDate);
        const startMinutes = s.getHours() * 60 + s.getMinutes();
        const endMinutes = e.getHours() * 60 + e.getMinutes();
        const duration = Math.max(1, endMinutes - startMinutes);
        return { ev, startMinutes, endMinutes, duration };
      })
      .sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);

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

    const thisStart = ensureDate(event.startDate);
    const thisEnd = ensureDate(event.endDate);
    const thisStartMin = thisStart.getHours() * 60 + thisStart.getMinutes();
    const thisEndMin = thisEnd.getHours() * 60 + thisEnd.getMinutes();
    const thisDuration = Math.max(1, thisEndMin - thisStartMin);

    let colIndex = 0;
    for (let ci = 0; ci < columns.length; ci++) {
      if (columns[ci].some((it) => it.ev.id === event.id)) {
        colIndex = ci;
        break;
      }
    }

    const widthPercent = 100 / totalCols;
    const leftPercent = colIndex * widthPercent;

    const rawTop = (thisStartMin / 60) * ROW_PX_PER_HOUR;
    const rawHeight = (thisDuration / 60) * ROW_PX_PER_HOUR;
    const topPx = Math.max(0, Math.floor(rawTop));
    const heightPx = Math.max(20, Math.ceil(rawHeight) + 1);

    return {
      height: `${heightPx}px`,
      top: `${topPx}px`,
      zIndex: colIndex + 1,
      left: `${leftPercent}%`,
      maxWidth: `${widthPercent}%`,
      minWidth: `${widthPercent}%`,
      _debug: { startMinutes: thisStartMin, endMinutes: thisEndMin, durationMinutes: thisDuration, topPx, heightPx }
    };
  }, [eventsKey]);

  function handleAddEvent(event?: Event) {
    const startDate = event?.startDate || new Date();
    const endDate = event?.endDate || new Date();

    setOpen(
      <CustomModal title="Add Event">
        <AddEventModal
          CustomAddEventModal={
            CustomEventModal?.CustomAddEventModal?.CustomForm
          }
        />
      </CustomModal>,
      async () => {
        return {
          ...event,
          startDate,
          endDate,
        };
      }
    );
  }

  function handleAddEventDay(detailedHour: string) {
    if (!detailedHour) {
      console.error("Detailed hour not provided.");
      return;
    }

    const [timePart, ampm] = detailedHour.split(" ");
    const [hourStr, minuteStr] = timePart.split(":");
    let hours = parseInt(hourStr);
    const minutes = parseInt(minuteStr);

    if (ampm === "PM" && hours < 12) {
      hours += 12;
    } else if (ampm === "AM" && hours === 12) {
      hours = 0;
    }

    const chosenDay = currentDate.getDate();

    if (chosenDay < 1 || chosenDay > 31) {
      console.error("Invalid day selected:", chosenDay);
      return;
    }

    const date = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      chosenDay,
      hours,
      minutes
    );

    handleAddEvent({
      startDate: date,
      endDate: new Date(date.getTime() + 60 * 60 * 1000),
      title: "",
      id: "",
      variant: "primary",
    });
  }

  const handleNextDay = useCallback(() => {
    setDirection(1);
    const nextDay = new Date(currentDate);
    nextDay.setDate(currentDate.getDate() + 1);
    setCurrentDate(nextDay);
  }, [currentDate]);

  const handlePrevDay = useCallback(() => {
    setDirection(-1);
    const prevDay = new Date(currentDate);
    prevDay.setDate(currentDate.getDate() - 1);
    setCurrentDate(prevDay);
  }, [currentDate]);

  return (
    <div className="bg-gray-50/50 dark:bg-slate-900/50 rounded-xl p-6">
      <div className="flex justify-between gap-3 flex-wrap mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {getFormattedDayTitle()}
        </h1>

        <div className="flex ml-auto gap-2">
          {prevButton ? (
            <div onClick={handlePrevDay}>{prevButton}</div>
          ) : (
            <Button
              variant={"outline"}
              style={{ padding: '0.5rem 1rem' }}
              className={cn(
                classNames?.prev,
                'text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800 hover:border-gray-400 dark:hover:border-slate-500 transition-all duration-200 shadow-sm'
              )}
              onClick={handlePrevDay}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Prev
            </Button>
          )}
          {nextButton ? (
            <div onClick={handleNextDay}>{nextButton}</div>
          ) : (
            <Button
              variant={"outline"}
              style={{ padding: '0.5rem 1rem' }}
              className={cn(
                classNames?.next,
                'text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800 hover:border-gray-400 dark:hover:border-slate-500 transition-all duration-200 shadow-sm'
              )}
              onClick={handleNextDay}
            >
              Next
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
      <div>
        <div key={currentDate.toISOString()} className="flex flex-col gap-4">
          <div className="relative rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-md overflow-hidden">
            <div
              className="relative rounded-xl flex ease-in-out"
              ref={hoursColumnRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => {
                isHoveringRef.current = false;
                setIsHovering(false);
              }}
            >
              {/* Time column - improved styling */}
              <div className="flex flex-col bg-gray-50 dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700">
                {hours.map((hour, index) => (
                  <div
                    key={`hour-${index}`}
                    className="cursor-pointer transition duration-200 px-3 py-2 h-[64px] flex items-center text-left text-xs font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                  >
                    {hour}
                  </div>
                ))}
              </div>
              
              {/* Events grid - improved contrast */}
              <div className="flex relative flex-grow flex-col bg-white dark:bg-slate-800">
                {Array.from({ length: 24 }).map((_, index) => (
                  <div
                    onClick={() => {
                      // read current hovered time from badge (fallback to noon)
                      const current = badgeRef.current?.textContent || "12:00 PM";
                      handleAddEventDay(current as string);
                    }}
                    key={`hour-${index}`}
                    className={cn(
                      "cursor-pointer w-full relative border-b transition duration-200 p-4 h-[64px] text-left text-sm",
                      "border-gray-100 dark:border-slate-700/50",
                      "hover:bg-purple-50 dark:hover:bg-purple-900/10"
                    )}
                  >
                    <div className="absolute bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center text-sm font-medium text-purple-700 dark:text-purple-300 opacity-0 transition left-0 top-0 duration-250 hover:opacity-100 w-full h-full">
                      + Add Event
                    </div>
                  </div>
                ))}
                
                {/* Render events */}
                {dayEvents && dayEvents?.length
                  ? dayEvents?.map((event, eventIndex) => {
                      let eventsInSamePeriod = 1;
                      let periodIndex = 0;
                      
                      for (let i = 0; i < timeGroups.length; i++) {
                        const groupIndex = timeGroups[i].findIndex(e => e.id === event.id);
                        if (groupIndex !== -1) {
                          eventsInSamePeriod = timeGroups[i].length;
                          periodIndex = groupIndex;
                          break;
                        }
                      }
                      
                      const {
                        height,
                        left,
                        maxWidth,
                        minWidth,
                        top,
                        zIndex,
                      } = computeMinaStyle(event, dayEvents);
                      
                      return (
                        <div
                          key={event.id}
                          style={{
                            display: 'block',
                            minHeight: height,
                            height: height,
                            top: top,
                            left: left,
                            maxWidth: maxWidth,
                            minWidth: minWidth,
                            padding: "0 2px",
                            boxSizing: "border-box",
                            overflow: 'visible',
                          }}
                          className="absolute z-50 pointer-events-auto"
                        >
                          {/** Memoize event props to avoid recreating object each render **/}
                          <EventWrapper
                            event={event}
                            CustomEventComponent={CustomEventComponent}
                            CustomEventModal={CustomEventModal}
                          />
                        </div>
                      );
                    })
                  : ""}
              </div>
            </div>

            {/* Hover timeline - updated to use DOM writes so we avoid re-rendering */}
            <div
              ref={timelineRef}
              className="absolute left-[60px] w-[calc(100%-60px)] h-[2px] bg-purple-500 dark:bg-purple-400 rounded-full pointer-events-none z-40 shadow-sm"
              style={{ top: `0px`, display: isHovering ? 'block' : 'none' }}
            >
              <div
                ref={badgeRef}
                className="absolute -translate-y-1/2 bg-white dark:bg-slate-800 border-purple-400 dark:border-purple-500 text-purple-700 dark:text-purple-300 font-medium z-50 left-[-55px] text-xs shadow-md px-2 py-0.5 rounded"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}