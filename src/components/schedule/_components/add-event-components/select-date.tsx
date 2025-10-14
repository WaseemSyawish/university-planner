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

  const parseToDate = (v: any) => {
    if (!v) return new Date();
    if (Object.prototype.toString.call(v) === '[object Date]') return v as Date;
    try {
      return new Date(String(v));
    } catch (e) {
      return new Date();
    }
  };

  const [startDate, setStartDate] = useState<Date>(
    data?.startDate ? parseToDate(data.startDate) : new Date()
  );
  
  const [endDate, setEndDate] = useState<Date>(
    // If caller provided an endDate, parse it; otherwise initialize end to the same
    // instant as startDate (do not default to `new Date()` which is 'now' and can
    // cause accidental 1hr durations when users only edit start time).
    data?.endDate ? parseToDate(data.endDate) : new Date((data?.startDate ? parseToDate(data.startDate).getTime() : new Date().getTime()))
  );

  const get12HourFormat = (hour: number) => {
    return hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  };

  const getPeriod = (hour: number) => {
    return hour >= 12 ? "PM" : "AM";
  };

  const get24HourFormat = (hour: number, period: string) => {
    if (period === "AM") {
      return hour === 12 ? 0 : hour;
    } else {
      return hour === 12 ? 12 : hour + 12;
    }
  };

  const [startHour12, setStartHour12] = useState<number>(get12HourFormat(startDate.getHours()));
  const [startMinute, setStartMinute] = useState<number>(startDate.getMinutes());
  const [startPeriod, setStartPeriod] = useState<string>(getPeriod(startDate.getHours()));

  const [endHour12, setEndHour12] = useState<number>(get12HourFormat(endDate.getHours()));
  const [endMinute, setEndMinute] = useState<number>(endDate.getMinutes());
  const [endPeriod, setEndPeriod] = useState<string>(getPeriod(endDate.getHours()));
  // Start with endAuto=false to avoid treating the initial end as an auto-populated
  // value that later flows could overwrite. When the user explicitly changes end
  // we set endAuto=false below; when we intentionally auto-set it (not used
  // currently) we could flip it to true.
  const [endAuto, setEndAuto] = useState<boolean>(false);
  const prevStartRef = React.useRef<Date | null>(startDate);
  
  useEffect(() => {
    if (data?.startDate instanceof Date) {
      setStartDate(data.startDate);
    }
    if (data?.endDate instanceof Date) {
      setEndDate(data.endDate);
    }
  }, [data]);

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
  
  // When startDate changes, do not auto-adjust endDate — preserve user's choice.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.debug('[SelectDate] startDate changed (no auto-adjust)', { startDate: startDate.toISOString(), endDate: endDate.toISOString(), endAuto });
    }
    setValue("startDate", startDate);
    prevStartRef.current = startDate;
  }, [startDate]);

  // Keep form endDate in sync when endDate state changes (e.g., user edits time)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.debug('[SelectDate] endDate changed', { endDate: endDate.toISOString(), endAuto });
    }
    setValue("endDate", endDate);
  }, [endDate, setValue]);

  const hours = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i));
  const minutes = Array.from({ length: 60 }, (_, i) => i);
  const periods = ["AM", "PM"];

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
    <div className="space-y-2">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-4">
        {/* Start Date Picker */}
        <div className="grid gap-1">
          <Label htmlFor="startDate" className="text-sm">Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="startDate"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-9 text-sm px-3",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-300" />
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
        <div className="grid gap-1">
          <Label htmlFor="endDate" className="text-sm">End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="endDate"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-9 text-sm px-3",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-300" />
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
                      setEndAuto(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Start Time (freeform) */}
        <div className="grid gap-2 py-1">
          <Label className="text-sm">Start Time</Label>
          <div className="flex gap-2 items-center">
            <input
              type="time"
              className="h-9 px-3 border rounded-md text-sm"
              value={format(startDate, 'HH:mm')}
              onChange={(e) => {
                const v = e.target.value; // HH:MM
                const parts = v.split(':');
                const hh = Number(parts[0]);
                const mm = Number(parts[1]);
                if (!Number.isFinite(hh) || !Number.isFinite(mm)) return;
                const newDate = setHours(setMinutes(new Date(startDate), mm), hh);
                setStartDate(newDate);
                setStartMinute(mm);
                setStartHour12(get12HourFormat(hh));
                setStartPeriod(getPeriod(hh));
              }}
            />
            <div className="text-xs text-gray-400">{format(startDate, "hh:mm a")}</div>
          </div>
        </div>

        {/* End Time (freeform) */}
  <div className="grid gap-2 py-1">
          <Label className="text-sm">End Time</Label>
          <div className="flex gap-2 items-center">
            <input
              type="time"
              className="h-9 px-3 border rounded-md text-sm"
              value={format(endDate, 'HH:mm')}
              onChange={(e) => {
                const v = e.target.value;
                const parts = v.split(':');
                const hh = Number(parts[0]);
                const mm = Number(parts[1]);
                if (!Number.isFinite(hh) || !Number.isFinite(mm)) return;
                const base = new Date(startDate);
                const newDate = setHours(setMinutes(base, mm), hh);
                setEndDate(newDate);
                setEndMinute(mm);
                setEndHour12(get12HourFormat(hh));
                setEndPeriod(getPeriod(hh));
                setEndAuto(false);
              }}
            />
            <div className="text-xs text-gray-400">{format(endDate, "hh:mm a")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}