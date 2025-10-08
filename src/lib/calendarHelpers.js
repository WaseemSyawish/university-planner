const {
  addDays,
  endOfMonth,
  startOfMonth,
  startOfDay,
  eachDayOfInterval,
  parseISO,
  isSameDay,
  format,
  differenceInDays,
} = require('date-fns');

exports.getCalendarCells = function getCalendarCells(selectedDate) {
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  const daysInMonth = endOfMonth(selectedDate).getDate();
  const firstDayOfMonth = startOfMonth(selectedDate).getDay();
  const daysInPrevMonth = endOfMonth(new Date(year, month - 1)).getDate();
  const totalDays = firstDayOfMonth + daysInMonth;

  const prevMonthCells = Array.from({ length: firstDayOfMonth }, (_, i) => ({
    day: daysInPrevMonth - firstDayOfMonth + i + 1,
    currentMonth: false,
    date: new Date(year, month - 1, daysInPrevMonth - firstDayOfMonth + i + 1),
  }));

  const currentMonthCells = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    currentMonth: true,
    date: new Date(year, month, i + 1),
  }));

  const nextMonthCells = Array.from({ length: (7 - (totalDays % 7)) % 7 }, (_, i) => ({
    day: i + 1,
    currentMonth: false,
    date: new Date(year, month + 1, i + 1),
  }));

  return [...prevMonthCells, ...currentMonthCells, ...nextMonthCells];
};

exports.calculateMonthEventPositions = function calculateMonthEventPositions(
  multiDayEvents,
  singleDayEvents,
  selectedDate,
) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  const eventPositions = {};
  const occupiedPositions = {};

  eachDayOfInterval({ start: monthStart, end: monthEnd }).forEach((day) => {
    occupiedPositions[day.toISOString()] = [false, false, false];
  });

  const sortedEvents = [
    ...multiDayEvents.sort((a, b) => {
      const aDuration = differenceInDays(parseISO(a.endDate), parseISO(a.startDate));
      const bDuration = differenceInDays(parseISO(b.endDate), parseISO(b.startDate));
      return (
        bDuration - aDuration ||
        parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
      );
    }),
    ...singleDayEvents.sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()),
  ];

  sortedEvents.forEach((event) => {
    const eventStart = parseISO(event.startDate);
    const eventEnd = parseISO(event.endDate);
    const eventDays = eachDayOfInterval({
      start: eventStart < monthStart ? monthStart : eventStart,
      end: eventEnd > monthEnd ? monthEnd : eventEnd,
    });

    let position = -1;

    for (let i = 0; i < 3; i++) {
      if (
        eventDays.every((day) => {
          const dayPositions = occupiedPositions[startOfDay(day).toISOString()];
          return dayPositions && !dayPositions[i];
        })
      ) {
        position = i;
        break;
      }
    }

    if (position !== -1) {
      eventDays.forEach((day) => {
        const dayKey = startOfDay(day).toISOString();
        occupiedPositions[dayKey][position] = true;
      });
      eventPositions[event.id] = position;
    }
  });

  return eventPositions;
};

exports.getMonthCellEvents = function getMonthCellEvents(date, events, eventPositions) {
  const dayStart = startOfDay(date);
  const eventsForDate = events.filter((event) => {
    const eventStart = parseISO(event.startDate);
    const eventEnd = parseISO(event.endDate);
    return (
      (dayStart >= eventStart && dayStart <= eventEnd) ||
      isSameDay(dayStart, eventStart) ||
      isSameDay(dayStart, eventEnd)
    );
  });

  return eventsForDate
    .map((event) => ({
      ...event,
      position: eventPositions[event.id] ?? -1,
      isMultiDay: event.startDate !== event.endDate,
    }))
    .sort((a, b) => {
      if (a.isMultiDay && !b.isMultiDay) return -1;
      if (!a.isMultiDay && b.isMultiDay) return 1;
      return a.position - b.position;
    });
};

exports.formatTime = function formatTime(dateOrString) {
  const parsed = typeof dateOrString === 'string' ? parseISO(dateOrString) : dateOrString;
  try {
    return format(parsed, 'h:mm a');
  } catch (e) {
    return '';
  }
};

exports.getColorClass = function getColorClass(color) {
  const map = {
    red: 'bg-red-100 border-red-300 text-red-700',
    yellow: 'bg-yellow-100 border-yellow-300 text-yellow-700',
    green: 'bg-green-100 border-green-300 text-green-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-800',
    orange: 'bg-orange-100 border-orange-300 text-orange-700',
    purple: 'bg-purple-100 border-purple-300 text-purple-700',
  };
  return map[color] || 'bg-slate-100 border-slate-300 text-slate-700';
};
