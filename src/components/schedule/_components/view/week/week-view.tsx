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

  const rAFRef = useRef<number | null>(null);
  const lastMouseEventRef = useRef<MouseEvent | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!hoursColumnRef.current) return;
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
          setDetailedHour(`${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`);

          const position = Math.max(0, Math.min(rect.height, Math.round(y)));
          setTimelinePosition(position);
        } finally {
          if (rAFRef.current != null) { cancelAnimationFrame(rAFRef.current); rAFRef.current = null; }
        }
      });
    }
  }, []);

  React.useEffect(() => {
    return () => { if (rAFRef.current != null) { cancelAnimationFrame(rAFRef.current); rAFRef.current = null; } };
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
      width: `${widthPercent}%`,
    };
  }, []);

  return (
    <div className="bg-gray-50/50 dark:bg-slate-900/50 rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
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
                'text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800 hover:border-gray-400 dark:hover:border-slate-500 transition-all duration-200 shadow-sm'
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
                'text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800 hover:border-gray-400 dark:hover:border-slate-500 transition-all duration-200 shadow-sm'
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
          className="relative rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-md overflow-hidden"
        >
          <div className="flex">
            {/* Hours Column */}
            <div className="flex flex-col bg-gray-50 dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700">
              <div className="h-[80px] px-3 py-2 border-b border-gray-200 dark:border-slate-700"></div>
              {hours.map((hour, index) => (
                <div
                  key={`hour-${index}`}
                  className="px-3 py-2 h-[64px] flex items-center text-left text-xs font-medium text-gray-600 dark:text-slate-400"
                >
                  {hour}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="flex-grow">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
                {daysOfWeek.map((day, idx) => {
                  const isToday =
                    new Date().getDate() === day.getDate() &&
                    new Date().getMonth() === currentDate.getMonth() &&
                    new Date().getFullYear() === currentDate.getFullYear();
                  
                  const dayEvents = getters.getEventsForDay(day.getDate(), currentDate);
                  const eventCount = dayEvents?.length || 0;

                  return (
                    <div
                      key={idx}
                      className="relative group h-[80px] flex flex-col items-center justify-center border-r border-gray-200 dark:border-slate-700 last:border-r-0 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="text-xs font-medium text-gray-600 dark:text-slate-400 uppercase tracking-wide">
                        {getters.getDayName(day.getDay())}
                      </div>
                      <div
                        className={cn(
                          "text-2xl font-bold mt-1",
                          isToday
                            ? "text-purple-600 dark:text-purple-400"
                            : "text-gray-900 dark:text-white"
                        )}
                      >
                        {day.getDate()}
                      </div>

                      {/* Event count indicator */}
                      {eventCount > 0 && (
                        <div
                          className="absolute top-1 right-1 cursor-pointer transition-all hover:scale-125"
                          onClick={(e) => {
                            e.stopPropagation();
                            const selectedDay = new Date(
                              currentDate.getFullYear(),
                              currentDate.getMonth(),
                              day.getDate()
                            );
                            
                            setOpen(
                              <CustomModal title={`${getters.getDayName(day.getDay())}, ${selectedDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}>
                                <div className="flex flex-col space-y-4 p-6">
                                  <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                      {eventCount} {eventCount === 1 ? 'Event' : 'Events'}
                                    </h2>
                                    <Button 
                                      onClick={() => {
                                        setOpen(null);
                                        handleAddEventWeek(idx, detailedHour || "12:00 PM");
                                      }}
                                      className="bg-purple-600 hover:bg-purple-700 text-white"
                                    >
                                      + Add Event
                                    </Button>
                                  </div>
                                  
                                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                                    {dayEvents
                                      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                                      .map((event) => {
                                        const startTime = new Date(event.startDate);
                                        const endTime = new Date(event.endDate);
                                        const formatTime = (date: Date) => {
                                          const hours = date.getHours();
                                          const minutes = date.getMinutes();
                                          const ampm = hours >= 12 ? 'PM' : 'AM';
                                          const hour12 = hours % 12 || 12;
                                          return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                                        };

                                        return (
                                          <div
                                            key={event.id}
                                            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer relative"
                                          >
                                            <Badge 
                                              className={cn(
                                                "absolute top-4 right-4",
                                                event.variant === 'primary' && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
                                                event.variant === 'warning' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
                                                event.variant === 'success' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                                                event.variant === 'danger' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                                                event.variant === 'default' && "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
                                              )}
                                            >
                                              {event.variant || 'Event'}
                                            </Badge>
                                            <div className="pr-20">
                                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                                {event.title || 'Untitled Event'}
                                              </h3>
                                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                                                <span className="font-medium">
                                                  {formatTime(startTime)} - {formatTime(endTime)}
                                                </span>
                                              </div>
                                              {event.description && (
                                                <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                                                  {event.description}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              </CustomModal>
                            );
                          }}
                        >
                          <div className="text-[10px] font-medium text-purple-600 dark:text-purple-400 hover:underline">
                            {eventCount} {eventCount === 1 ? 'event' : 'events'}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
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
                      className="relative border-r border-gray-200 dark:border-slate-700 last:border-r-0 bg-white dark:bg-slate-800"
                    >
                      {/* Hour cells */}
                      {Array.from({ length: 24 }, (_, hourIndex) => (
                        <div
                          key={`day-${dayIndex}-hour-${hourIndex}`}
                          onClick={() => handleAddEventWeek(dayIndex, detailedHour as string)}
                          className={cn(
                            "h-[64px] border-b transition duration-200 cursor-pointer relative",
                            "border-gray-100 dark:border-slate-700/50",
                            "hover:bg-purple-50 dark:hover:bg-purple-900/10"
                          )}
                        >
                          <div className="absolute bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center text-sm font-medium text-purple-700 dark:text-purple-300 opacity-0 transition left-0 top-0 duration-250 hover:opacity-100 w-full h-full pointer-events-none">
                            + Add Event
                          </div>
                        </div>
                      ))}

                      {/* Events - FIXED RENDERING */}
                      <div className="absolute inset-0 pointer-events-none">
                        <AnimatePresence initial={false}>
                          {dayEvents?.map((event) => {
                            const style = computeMinaStyle(event, dayEvents);
                            const manyEvents = (dayEvents?.length || 0) > 30;

                            const eventElement = (
                              <div
                                style={{
                                  position: 'absolute',
                                  height: style.height,
                                  top: style.top,
                                  left: style.left,
                                  width: style.width,
                                  zIndex: style.zIndex,
                                  pointerEvents: 'auto',
                                  paddingLeft: '2px',
                                  paddingRight: '2px',
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

                            if (manyEvents) {
                              return <React.Fragment key={event.id}>{eventElement}</React.Fragment>;
                            }

                            return (
                              <MotionDiv
                                key={event.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                style={{ position: 'relative' }}
                              >
                                {eventElement}
                              </MotionDiv>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Timeline indicator */}
          {detailedHour && (
            <div
              className="absolute left-[60px] w-[calc(100%-60px)] h-[2px] bg-purple-500 dark:bg-purple-400 rounded-full pointer-events-none z-40 shadow-sm"
              style={{ top: `${timelinePosition + 80}px` }}
            >
              <Badge
                variant="outline"
                className="absolute -translate-y-1/2 bg-white dark:bg-slate-800 border-purple-400 dark:border-purple-500 text-purple-700 dark:text-purple-300 font-medium z-50 left-[-55px] text-xs shadow-md"
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