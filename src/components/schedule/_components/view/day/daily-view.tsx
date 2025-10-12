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
      staggerChildren: 0.05, // Stagger effect between children
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
  
  // Sort events by start time
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  
  // Precise time overlap checking function
  const eventsOverlap = (event1: Event, event2: Event) => {
    const start1 = new Date(event1.startDate).getTime();
    const end1 = new Date(event1.endDate).getTime();
    const start2 = new Date(event2.startDate).getTime();
    const end2 = new Date(event2.endDate).getTime();
    
    // Strict time overlap - one event starts before the other ends
    return (start1 < end2 && start2 < end1);
  };
  
  // Use a graph-based approach to find connected components (overlapping event groups)
  const buildOverlapGraph = (events: Event[]) => {
    // Create adjacency list
    const graph: Record<string, string[]> = {};
    
    // Initialize graph
    events.forEach(event => {
      graph[event.id] = [];
    });
    
    // Build connections
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
  
  // Find connected components using DFS
  const findConnectedComponents = (graph: Record<string, string[]>, events: Event[]) => {
    const visited: Record<string, boolean> = {};
    const components: Event[][] = [];
    
    // DFS function to traverse the graph
    const dfs = (nodeId: string, component: string[]) => {
      visited[nodeId] = true;
      component.push(nodeId);
      
      for (const neighbor of graph[nodeId]) {
        if (!visited[neighbor]) {
          dfs(neighbor, component);
        }
      }
    };
    
    // Find all connected components
    for (const event of events) {
      if (!visited[event.id]) {
        const component: string[] = [];
        dfs(event.id, component);
        
        // Map IDs back to events
        const eventGroup = component.map(id => 
          events.find(e => e.id === id)!
        );
        
        components.push(eventGroup);
      }
    }
    
    return components;
  };
  
  // Build the overlap graph
  const graph = buildOverlapGraph(sortedEvents);
  
  // Find connected components (groups of overlapping events)
  const timeGroups = findConnectedComponents(graph, sortedEvents);
  
  // Sort events within each group by start time
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
  const [detailedHour, setDetailedHour] = useState<string | null>(null);
  const [timelinePosition, setTimelinePosition] = useState<number>(0);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [direction, setDirection] = useState<number>(0);
  const { setOpen } = useModal();
  const { getters, handlers } = useScheduler();

  // Listen for external 'go to date' requests (e.g., header Today button)
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

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (!hoursColumnRef.current) return;
      const rect = hoursColumnRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const hourHeight = rect.height / 24;
      const hour = Math.max(0, Math.min(23, Math.floor(y / hourHeight)));
      const minuteFraction = (y % hourHeight) / hourHeight;
      const minutes = Math.floor(minuteFraction * 60);

      // Format in 12-hour format
      const hour12 = hour % 12 || 12;
      const ampm = hour < 12 ? "AM" : "PM";
      setDetailedHour(
        `${hour12}:${Math.max(0, minutes).toString().padStart(2, "0")} ${ampm}`
      );

      // Ensure timelinePosition is never negative and is within bounds
      const position = Math.max(0, Math.min(rect.height, Math.round(y)));
      setTimelinePosition(position);
    },
    []
  );

  const getFormattedDayTitle = useCallback(
    () => currentDate.toDateString(),
    [currentDate]
  );

  const dayEvents = getters.getEventsForDay(
    currentDate?.getDate() || 0,
    currentDate
  );
  
  // Calculate time groups once for all events
  const timeGroups = groupEventsByTimePeriod(dayEvents);

  // Simple Mina-style minutes-based layout helper (keeps logic local and minimal)
  const computeMinaStyle = (event: Event, allDayEvents: Event[] | undefined) => {
    const ROW_PX_PER_HOUR = 64; // must match the hour row height used in the markup (h-[64px])
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

    // find which column this event belongs to by matching ids
    let colIndex = 0;
    for (let ci = 0; ci < columns.length; ci++) {
      if (columns[ci].some((it) => it.ev.id === event.id)) {
        colIndex = ci;
        break;
      }
    }

    const widthPercent = 100 / totalCols;
    const leftPercent = colIndex * widthPercent;

    // Round/ceil pixel values to avoid subpixel gaps caused by fractional
    // computations and different device pixel ratios. Add a 1px buffer to
    // height to ensure the colored surface reaches the grid line below.
    const rawTop = (thisStartMin / 60) * ROW_PX_PER_HOUR;
    const rawHeight = (thisDuration / 60) * ROW_PX_PER_HOUR;
    const topPx = Math.max(0, Math.floor(rawTop));
    // Ensure minimal visible height and add a small buffer to avoid 1px gaps
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
  };

  function handleAddEvent(event?: Event) {
    // Create the modal content with the provided event data or defaults
    const startDate = event?.startDate || new Date();
    const endDate = event?.endDate || new Date();

    // Open the modal with the content
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

    // Parse the 12-hour format time
    const [timePart, ampm] = detailedHour.split(" ");
    const [hourStr, minuteStr] = timePart.split(":");
    let hours = parseInt(hourStr);
    const minutes = parseInt(minuteStr);

    // Convert to 24-hour format for Date object
    if (ampm === "PM" && hours < 12) {
      hours += 12;
    } else if (ampm === "AM" && hours === 12) {
      hours = 0;
    }

    const chosenDay = currentDate.getDate();

    // Ensure day is valid
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
      endDate: new Date(date.getTime() + 60 * 60 * 1000), // 1-hour duration
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
    <div className="bg-gray-50/30 rounded-xl p-6">
      <div className="flex justify-between gap-3 flex-wrap mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
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
                'text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm'
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
                'text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm'
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
          {/* All-day strip removed per UX request: do not show all-day events above the hourly timetable. */}

          <div className="relative rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            <div
              className="relative rounded-xl flex ease-in-out"
              ref={hoursColumnRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setDetailedHour(null)}
            >
              <div className="flex flex-col bg-gray-50/50 border-r border-gray-200">
                {hours.map((hour, index) => (
                  <div
                    key={`hour-${index}`}
                    className="cursor-pointer transition duration-300 px-4 py-2 h-[64px] flex items-center text-left text-sm text-gray-600 font-medium"
                  >
                    {hour}
                  </div>
                ))}
              </div>
              <div className="flex relative flex-grow flex-col bg-white">
                {Array.from({ length: 24 }).map((_, index) => (
                  <div
                    onClick={() => {
                      handleAddEventDay(detailedHour as string);
                    }}
                    key={`hour-${index}`}
                    className="cursor-pointer w-full relative border-b border-gray-100 hover:bg-purple-50/30 transition duration-300 p-4 h-[64px] text-left text-sm text-gray-500"
                  >
                    <div className="absolute bg-purple-500/10 flex items-center justify-center text-sm font-medium text-purple-700 opacity-0 transition left-0 top-0 duration-250 hover:opacity-100 w-full h-full">
                      + Add Event
                    </div>
                  </div>
                ))}
                {dayEvents && dayEvents?.length
                  ? dayEvents?.map((event, eventIndex) => {
                      // Find which time group this event belongs to
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
                      
                      // Use a local Mina-style layout helper to compute top/height/column packing
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
                          className="absolute transition-all duration-300 z-50 pointer-events-auto"
                        >
                          <EventStyled
                            event={{
                              ...event,
                              CustomEventComponent,
                              minmized: true,
                            }}
                            CustomEventModal={CustomEventModal}
                          />
                        </div>
                      );
                    })
                  : ""}
              </div>
            </div>

            {detailedHour && (
              <div
                className="absolute left-[80px] w-[calc(100%-80px)] h-[2px] bg-purple-500/50 rounded-full pointer-events-none z-40"
                style={{ top: `${timelinePosition}px` }}
              >
                <Badge
                  variant="outline"
                  className="absolute -translate-y-1/2 bg-white border-purple-300 text-purple-700 font-medium z-50 left-[-65px] text-xs shadow-sm"
                >
                  {detailedHour}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}