import React, { useRef, useState, useEffect, useCallback } from "react";
import { useScheduler } from "@/providers/schedular-provider";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion, HTMLMotionProps } from "framer-motion";
import { useModal } from "@/providers/modal-context";
import AddEventModal from "@/components/schedule/_modals/add-event-modal";
import EventStyled from "../event-component/event-styled";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Maximize2, ChevronLeft, Maximize } from "lucide-react";
import clsx from "clsx";
import { cn } from "@/lib/utils";
import { Event, CustomEventModal } from "@/types";
import CustomModal from "@/components/ui/custom-modal";

const MotionDiv = motion.div as unknown as React.ComponentType<
  HTMLMotionProps<"div"> & { className?: string }
>;

const hours = Array.from({ length: 24 }, (_, i) => {
  const hour = i % 12 || 12;
  const ampm = i < 12 ? "AM" : "PM";
  return `${hour}:00 ${ampm}`;
});

const pageTransitionVariants = {
  enter: (direction: number) => ({
    opacity: 0,
  }),
  center: {
    opacity: 1,
  },
  exit: (direction: number) => ({
    opacity: 0,
    transition: {
      opacity: { duration: 0.2, ease: "easeInOut" },
    },
  }),
};

export default function WeeklyView({
  prevButton,
  nextButton,
  CustomEventComponent,
  CustomEventModal,
  classNames,
}: {
  prevButton?: React.ReactNode;
  nextButton?: React.ReactNode;
  CustomEventComponent?: React.FC<Event>;
  CustomEventModal?: CustomEventModal;
  classNames?: { prev?: string; next?: string; addEvent?: string };
}) {
  const { getters, handlers } = useScheduler();
  const hoursColumnRef = useRef<HTMLDivElement>(null);
  const [detailedHour, setDetailedHour] = useState<string | null>(null);
  const [timelinePosition, setTimelinePosition] = useState<number>(0);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [direction, setDirection] = useState<number>(0);
  const { setOpen } = useModal();

  const daysOfWeek = getters?.getDaysInWeek(
    getters?.getWeekNumber(currentDate),
    currentDate.getFullYear()
  );

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!hoursColumnRef.current) return;
    const rect = hoursColumnRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hourHeight = rect.height / 24;
    const hour = Math.max(0, Math.min(23, Math.floor(y / hourHeight)));
    const minuteFraction = (y % hourHeight) / hourHeight;
    const minutes = Math.floor(minuteFraction * 60);
    
    const hour12 = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";
    setDetailedHour(
      `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`
    );
    
    const position = Math.max(0, Math.min(rect.height, Math.round(y)));
    setTimelinePosition(position);
  }, []);

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

  const handleNextWeek = useCallback(() => {
    setDirection(1);
    const nextWeek = new Date(currentDate);
    nextWeek.setDate(currentDate.getDate() + 7);
    setCurrentDate(nextWeek);
  }, [currentDate]);

  const handlePrevWeek = useCallback(() => {
    setDirection(-1);
    const prevWeek = new Date(currentDate);
    prevWeek.setDate(currentDate.getDate() - 7);
    setCurrentDate(prevWeek);
  }, [currentDate]);

  function handleAddEventWeek(dayIndex: number, detailedHour: string) {
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

    const chosenDay = daysOfWeek[dayIndex % 7].getDate();

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
    
    const graph: Record<string, Set<string>> = {};
    
    for (const event of sortedEvents) {
      graph[event.id] = new Set<string>();
    }
    
    for (let i = 0; i < sortedEvents.length; i++) {
      for (let j = i + 1; j < sortedEvents.length; j++) {
        if (eventsOverlap(sortedEvents[i], sortedEvents[j])) {
          graph[sortedEvents[i].id].add(sortedEvents[j].id);
          graph[sortedEvents[j].id].add(sortedEvents[i].id);
        }
      }
    }
    
    const visited = new Set<string>();
    const groups: Event[][] = [];
    
    for (const event of sortedEvents) {
      if (!visited.has(event.id)) {
        const group: Event[] = [];
        const stack: Event[] = [event];
        visited.add(event.id);
        
        while (stack.length > 0) {
          const current = stack.pop()!;
          group.push(current);
          
          for (const neighborId of graph[current.id]) {
            if (!visited.has(neighborId)) {
              const neighbor = sortedEvents.find(e => e.id === neighborId);
              if (neighbor) {
                stack.push(neighbor);
                visited.add(neighborId);
              }
            }
          }
        }
        
        group.sort((a, b) => 
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );
        
        groups.push(group);
      }
    }
    
    return groups;
  };

  const computeMinaStyle = (event: Event, allDayEvents: Event[] | undefined) => {
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
    };
  };

  return (
    <div className="bg-gray-50/30 rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Week {getters.getWeekNumber(currentDate)}
        </h1>

        <div className="flex ml-auto gap-2">
          {prevButton ? (
            <div onClick={handlePrevWeek}>{prevButton}</div>
          ) : (
            <Button
              variant="outline"
              style={{ padding: '0.5rem 1rem' }}
              className={cn(
                classNames?.prev,
                'text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm'
              )}
              onClick={handlePrevWeek}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Prev
            </Button>
          )}
          {nextButton ? (
            <div onClick={handleNextWeek}>{nextButton}</div>
          ) : (
            <Button
              variant="outline"
              style={{ padding: '0.5rem 1rem' }}
              className={cn(
                classNames?.next,
                'text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm'
              )}
              onClick={handleNextWeek}
            >
              Next
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false} custom={direction} mode="wait">
        <MotionDiv
          key={currentDate.toISOString()}
          custom={direction}
          variants={pageTransitionVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ opacity: { duration: 0.2 } }}
          className="relative rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden"
        >
          <div className="flex">
            {/* Hours Column */}
            <div className="flex flex-col bg-gray-50/50 border-r border-gray-200">
              <div className="h-[80px] px-4 py-2 border-b border-gray-200"></div>
              {hours.map((hour, index) => (
                <div
                  key={`hour-${index}`}
                  className="px-4 py-2 h-[64px] flex items-center text-left text-sm text-gray-600 font-medium"
                >
                  {hour}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="flex-grow">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/50">
                {daysOfWeek.map((day, idx) => {
                  const isToday =
                    new Date().getDate() === day.getDate() &&
                    new Date().getMonth() === currentDate.getMonth() &&
                    new Date().getFullYear() === currentDate.getFullYear();

                  return (
                    <div
                      key={idx}
                      className="relative group h-[80px] flex flex-col items-center justify-center border-r border-gray-200 last:border-r-0"
                    >
                      <div className="text-sm font-medium text-gray-600">
                        {getters.getDayName(day.getDay())}
                      </div>
                      <div
                        className={cn(
                          "text-lg font-semibold mt-1",
                          isToday
                            ? "text-purple-600"
                            : "text-gray-900"
                        )}
                      >
                        {day.getDate()}
                      </div>

                      {/* Fullscreen icon */}
                      <div
                        className="absolute top-2 right-2 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          const selectedDay = new Date(
                            currentDate.getFullYear(),
                            currentDate.getMonth(),
                            day.getDate()
                          );
                          
                          const dayEvents = getters.getEventsForDay(
                            day.getDate(),
                            currentDate
                          );
                          
                          setOpen(
                            <CustomModal title={`${getters.getDayName(day.getDay())} ${day.getDate()}, ${selectedDay.getFullYear()}`}>
                              <div className="flex flex-col space-y-4 p-4">
                                <div className="flex items-center mb-4">
                                  <ChevronLeft 
                                    className="cursor-pointer hover:text-purple-600 mr-2" 
                                    onClick={() => setOpen(null)}
                                  />
                                  <h2 className="text-2xl font-bold">{selectedDay.toDateString()}</h2>
                                </div>
                                
                                {dayEvents && dayEvents.length > 0 ? (
                                  <div className="space-y-4">
                                    <div className="relative bg-gray-50 rounded-lg p-4 min-h-[500px]">
                                      <div className="grid grid-cols-[100px_1fr] h-full">
                                        <div className="flex flex-col">
                                          {hours.map((hour, index) => (
                                            <div
                                              key={`hour-${index}`}
                                              className="h-16 p-2 text-sm text-gray-600 border-r border-b border-gray-200"
                                            >
                                              {hour}
                                            </div>
                                          ))}
                                        </div>
                                        
                                        <div className="relative">
                                          {Array.from({ length: 24 }).map((_, index) => (
                                            <div
                                              key={`grid-${index}`}
                                              className="h-16 border-b border-gray-200"
                                            />
                                          ))}
                                          
                                          {dayEvents.map((event) => {
                                            const { height, top, left, maxWidth, minWidth } = computeMinaStyle(event, dayEvents);
                                            
                                            return (
                                              <div
                                                key={event.id}
                                                style={{
                                                  position: 'absolute',
                                                  display: 'block',
                                                  height,
                                                  minHeight: height,
                                                  top,
                                                  left,
                                                  maxWidth,
                                                  minWidth,
                                                  padding: '0 2px',
                                                  boxSizing: 'border-box',
                                                  overflow: 'visible'
                                                }}
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
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center py-10 text-gray-500">
                                    <p>No events scheduled for this day</p>
                                    <Button 
                                      variant="outline" 
                                      className="mt-4"
                                      onClick={() => {
                                        setOpen(null);
                                        handleAddEventWeek(idx, detailedHour || "12:00 PM");
                                      }}
                                    >
                                      Add Event
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </CustomModal>
                          );
                        }}
                      >
                        <Maximize size={16} className="text-gray-400 hover:text-purple-600" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time Grid with Events */}
              <div
                ref={hoursColumnRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setDetailedHour(null)}
                className="relative grid grid-cols-7"
              >
                {Array.from({ length: 7 }, (_, dayIndex) => {
                  const dayEvents = getters.getEventsForDay(
                    daysOfWeek[dayIndex % 7].getDate(),
                    currentDate
                  );

                  return (
                    <div
                      key={`day-${dayIndex}`}
                      className="relative border-r border-gray-200 last:border-r-0"
                    >
                      {/* Hour cells */}
                      {Array.from({ length: 24 }, (_, hourIndex) => (
                        <div
                          key={`day-${dayIndex}-hour-${hourIndex}`}
                          onClick={() => handleAddEventWeek(dayIndex, detailedHour as string)}
                          className="h-[64px] border-b border-gray-100 hover:bg-purple-50/30 transition duration-300 cursor-pointer relative"
                        >
                          <div className="absolute bg-purple-500/10 flex items-center justify-center text-sm font-medium text-purple-700 opacity-0 transition left-0 top-0 duration-250 hover:opacity-100 w-full h-full pointer-events-none">
                            + Add Event
                          </div>
                        </div>
                      ))}

                      {/* Events */}
                      <AnimatePresence initial={false}>
                        {dayEvents?.map((event) => {
                          const { height, left, maxWidth, minWidth, top } = computeMinaStyle(event, dayEvents);

                          return (
                            <MotionDiv
                              key={event.id}
                              style={{
                                minHeight: height,
                                height,
                                top: top,
                                left: left,
                                maxWidth: maxWidth,
                                minWidth: minWidth,
                                padding: '0 2px',
                                boxSizing: 'border-box',
                              }}
                              className="absolute transition-all duration-300 z-50 block pointer-events-auto"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              transition={{ duration: 0.2 }}
                            >
                              <EventStyled
                                event={{
                                  ...event,
                                  CustomEventComponent,
                                  minmized: true,
                                }}
                                CustomEventModal={CustomEventModal}
                              />
                            </MotionDiv>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Timeline indicator */}
          {detailedHour && (
            <div
              className="absolute left-[80px] w-[calc(100%-80px)] h-[2px] bg-purple-500/50 rounded-full pointer-events-none z-40"
              style={{ top: `${timelinePosition + 80}px` }}
            >
              <Badge
                variant="outline"
                className="absolute -translate-y-1/2 bg-white border-purple-300 text-purple-700 font-medium z-50 left-[-65px] text-xs shadow-sm"
              >
                {detailedHour}
              </Badge>
            </div>
          )}
        </MotionDiv>
      </AnimatePresence>
    </div>
  );
}