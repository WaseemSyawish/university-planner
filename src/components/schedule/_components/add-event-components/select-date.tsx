"use client";

import { EventFormData } from "@/types";
import React, { useEffect, useState } from "react";
import { UseFormSetValue } from "react-hook-form";
import { format, setHours, setMinutes, isBefore, addHours } from "date-fns";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  usePopover,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Clock } from "@/components/icons/simple-icons";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SelectDate({
  data,
  setValue,
}: {
  data?: { startDate: Date; endDate: Date };
  setValue: UseFormSetValue<EventFormData>;
}) {

  // debug removed
  const [startDate, setStartDate] = useState<Date>(
    data?.startDate instanceof Date ? data.startDate : new Date()
  );
  
  const [endDate, setEndDate] = useState<Date>(
    data?.endDate instanceof Date ? data.endDate : new Date()
  );

  // Convert 24-hour format to 12-hour format
  const get12HourFormat = (hour: number) => {
    return hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  };

  // Get period (AM/PM) from hour
  const getPeriod = (hour: number) => {
    return hour >= 12 ? "PM" : "AM";
  };

  // Convert 12-hour format to 24-hour format
  const get24HourFormat = (hour: number, period: string) => {
    if (period === "AM") {
      return hour === 12 ? 0 : hour;
    } else {
      return hour === 12 ? 12 : hour + 12;
    }
  };
  // controlled sub-states for time selectors (12-hour components)
  const [startHour12, setStartHour12] = useState<number>(get12HourFormat(startDate.getHours()));
  const [startMinute, setStartMinute] = useState<number>(startDate.getMinutes());
  const [startPeriod, setStartPeriod] = useState<string>(getPeriod(startDate.getHours()));

  const [endHour12, setEndHour12] = useState<number>(get12HourFormat(endDate.getHours()));
  const [endMinute, setEndMinute] = useState<number>(endDate.getMinutes());
  const [endPeriod, setEndPeriod] = useState<string>(getPeriod(endDate.getHours()));
  
  // Update state when data changes
  useEffect(() => {
    if (data?.startDate instanceof Date) {
      setStartDate(data.startDate);
    }
    if (data?.endDate instanceof Date) {
      setEndDate(data.endDate);
    }
  }, [data]);

  // sync controlled time parts when dates change externally
  useEffect(() => {
    setStartHour12(get12HourFormat(startDate.getHours()));
    setStartMinute(startDate.getMinutes());
    setStartPeriod(getPeriod(startDate.getHours()));
  }, [startDate]);

  useEffect(() => {
    setEndHour12(get12HourFormat(endDate.getHours()));
    setEndMinute(endDate.getMinutes());
    setEndPeriod(getPeriod(endDate.getHours()));
  }, [endDate]);
  
  // Update form values when dates change
  useEffect(() => {
    try { console.debug('SelectDate.setValue startDate=', startDate); } catch(e) {}
    setValue("startDate", startDate);
    
    // Ensure end date is not before start date
    if (isBefore(endDate, startDate)) {
      const newEndDate = new Date(startDate);
      newEndDate.setHours(startDate.getHours() + 1);
      setEndDate(newEndDate);
      try { console.debug('SelectDate.adjusted endDate=', newEndDate); } catch(e) {}
      setValue("endDate", newEndDate);
    } else {
      try { console.debug('SelectDate.setValue endDate=', endDate); } catch(e) {}
      setValue("endDate", endDate);
    }
  }, [startDate, endDate, setValue]);

  // Time options for select
  const hours = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i));
  const minutes = Array.from({ length: 60 }, (_, i) => i);
  const periods = ["AM", "PM"];

  // Small wrapper component that closes the surrounding popover when a date is picked
  function CalendarWithClose(props: any) {
    const pop = usePopover();
    return (
      <Calendar
        {...props}
        onSelect={(date: Date) => {
          if (props.onSelect) props.onSelect(date);
          try {
            pop?.setOpen(false);
          } catch (e) {}
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Start Date Picker */}
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="startDate"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarWithClose
                selected={startDate}
                onSelect={(date) => {
                  if (date) {
                    const newDate = new Date(date);
                    newDate.setHours(
                      startDate.getHours(),
                      startDate.getMinutes(),
                      0,
                      0
                    );
                    setStartDate(newDate);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* End Date Picker */}
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="endDate"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarWithClose
                selected={endDate}
                onSelect={(date) => {
                  if (date) {
                    const newDate = new Date(date);
                    newDate.setHours(
                      endDate.getHours(),
                      endDate.getMinutes(),
                      0,
                      0
                    );
                    setEndDate(newDate);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

  <div className="flex flex-col gap-3">
        {/* Start Time */}
  <div className="space-y-1">
          <Label>Start Time</Label>
          <div className="flex space-x-2">
            <Select
              value={String(startHour12).padStart(2, '0')}
              onValueChange={(value) => {
                const hour12 = parseInt(value, 10);
                setStartHour12(hour12);
                const newHour24 = get24HourFormat(hour12, startPeriod);
                const newDate = setHours(startDate, newHour24);
                const newDateWithMinute = setMinutes(newDate, startMinute);
                setStartDate(newDateWithMinute);
              }}
            >
              <SelectTrigger className="w-[100px]">
                <Clock className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Hour" />
              </SelectTrigger>
              <SelectContent className="h-[200px]">
                {hours.map((hour) => (
                  <SelectItem key={hour} value={String(hour).padStart(2, '0')}>
                    {String(hour).padStart(2, '0')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(startMinute).padStart(2, '0')}
              onValueChange={(value) => {
                const minute = parseInt(value, 10);
                setStartMinute(minute);
                const newDate = setMinutes(startDate, minute);
                setStartDate(newDate);
              }}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Minute" />
              </SelectTrigger>
              <SelectContent className="h-[200px]">
                {minutes.map((minute) => (
                  <SelectItem key={minute} value={String(minute).padStart(2, '0')}>
                    {String(minute).padStart(2, '0')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={startPeriod}
              onValueChange={(value) => {
                setStartPeriod(value);
                const newHour24 = get24HourFormat(startHour12, value);
                const newDate = setHours(startDate, newHour24);
                setStartDate(newDate);
              }}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder="AM/PM" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((period) => (
                  <SelectItem key={period} value={period}>
                    {period}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-gray-400">
            Current time: {format(startDate, "hh:mm a")}
          </div>
        </div>

        {/* End Time */}
  <div className="space-y-1">
          <Label>End Time</Label>
          <div className="flex space-x-2">
            <Select
              value={String(endHour12).padStart(2, '0')}
              onValueChange={(value) => {
                const hour12 = parseInt(value, 10);
                setEndHour12(hour12);
                const newHour24 = get24HourFormat(hour12, endPeriod);
                const newDate = setHours(endDate, newHour24);
                const newDateWithMinute = setMinutes(newDate, endMinute);
                setEndDate(newDateWithMinute);
              }}
            >
              <SelectTrigger className="w-[100px]">
                <Clock className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Hour" />
              </SelectTrigger>
              <SelectContent className="h-[200px]">
                {hours.map((hour) => (
                  <SelectItem key={hour} value={String(hour).padStart(2, '0')}>
                    {String(hour).padStart(2, '0')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(endMinute).padStart(2, '0')}
              onValueChange={(value) => {
                const minute = parseInt(value, 10);
                setEndMinute(minute);
                const newDate = setMinutes(endDate, minute);
                setEndDate(newDate);
              }}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Minute" />
              </SelectTrigger>
              <SelectContent className="h-[200px]">
                {minutes.map((minute) => (
                  <SelectItem key={minute} value={String(minute).padStart(2, '0')}>
                    {String(minute).padStart(2, '0')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={endPeriod}
              onValueChange={(value) => {
                setEndPeriod(value);
                const newHour24 = get24HourFormat(endHour12, value);
                const newDate = setHours(endDate, newHour24);
                setEndDate(newDate);
              }}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder="AM/PM" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((period) => (
                  <SelectItem key={period} value={period}>
                    {period}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-gray-400">
            Current time: {format(endDate, "hh:mm a")}
          </div>
        </div>
      </div>
    </div>
  );
}
