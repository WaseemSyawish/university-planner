"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useModal } from "@/providers/modal-context";
import SelectDate from "@/components/schedule/_components/add-event-components/select-date";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EventFormData, eventSchema, Variant, Event } from "@/types/index";
import { useScheduler } from "@/providers/schedular-provider";
import { v4 as uuidv4 } from "uuid";

const COLORS = [
  { key: "blue", name: "Blue", variant: "primary" as Variant, class: "bg-blue-500", hover: "hover:bg-blue-600" },
  { key: "red", name: "Red", variant: "danger" as Variant, class: "bg-red-500", hover: "hover:bg-red-600" },
  { key: "green", name: "Green", variant: "success" as Variant, class: "bg-green-500", hover: "hover:bg-green-600" },
  { key: "yellow", name: "Yellow", variant: "warning" as Variant, class: "bg-yellow-500", hover: "hover:bg-yellow-600" },
  { key: "purple", name: "Purple", variant: "primary" as Variant, class: "bg-purple-500", hover: "hover:bg-purple-600" },
  { key: "pink", name: "Pink", variant: "danger" as Variant, class: "bg-pink-500", hover: "hover:bg-pink-600" },
];

const EVENT_TYPES = [
  { value: "lecture", label: "Lecture", icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )},
  { value: "assignment", label: "Assignment", icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )},
  { value: "deadline", label: "Deadline", icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )},
  { value: "personal", label: "Personal", icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )},
];

const DAYS = [
  { short: "S", full: "Sunday", value: 0 },
  { short: "M", full: "Monday", value: 1 },
  { short: "T", full: "Tuesday", value: 2 },
  { short: "W", full: "Wednesday", value: 3 },
  { short: "T", full: "Thursday", value: 4 },
  { short: "F", full: "Friday", value: 5 },
  { short: "S", full: "Saturday", value: 6 },
];

export default function AddEventModal({
  CustomAddEventModal,
}: {
  CustomAddEventModal?: React.FC<{ register: any; errors: any }>;
}) {
  const { setClose, data } = useModal();
  const eventData = (data?.default ?? null) as Event | null | undefined;
  const { handlers } = useScheduler();

  const [selectedColor, setSelectedColor] = useState<string>(
    (eventData as any)?.color || "blue"
  );
  const [selectedType, setSelectedType] = useState<string>(
    (eventData as any)?.type || "assignment"
  );
  const [colorOpen, setColorOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedByDays, setSelectedByDays] = useState<number[]>([]);
  const [intervalWeeks, setIntervalWeeks] = useState<number>(1);
  const [createTemplate, setCreateTemplate] = useState(false);
  const [materializeCount, setMaterializeCount] = useState<number | null>(null);
  const [materializeUntil, setMaterializeUntil] = useState<string | null>(null);
  const [modalPage, setModalPage] = useState<number>(0);
  const [recurrenceMode, setRecurrenceMode] = useState<'none' | 'count' | 'until'>('none');

  const { register, handleSubmit, reset, formState: { errors }, setValue, getValues } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      startDate: new Date(),
      endDate: new Date(),
      variant: eventData?.variant || "primary",
      color: (eventData as any)?.color || "blue",
      type: (eventData as any)?.type || "assignment",
    },
  });

  const selectDateData = useMemo(() => ({
    startDate: eventData?.startDate || new Date(),
    endDate: eventData?.endDate || new Date(),
  }), [eventData?.startDate, eventData?.endDate]);

  useEffect(() => {
    if (eventData) {
      const color = (eventData as any)?.color || "blue";
      const type = (eventData as any)?.type || "assignment";
      reset({
        title: eventData.title,
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        variant: eventData.variant || "primary",
        color: color,
        type: type,
      });
      setSelectedColor(color);
      setSelectedType(type);
    }
  }, [eventData, reset]);

  const handleColorChange = (colorKey: string) => {
    const color = COLORS.find(c => c.key === colorKey);
    setSelectedColor(colorKey);
    setValue("color", colorKey);
    setValue("variant", color?.variant || "primary");
    setColorOpen(false);
  };

  const handleTypeChange = (typeValue: string) => {
    setSelectedType(typeValue);
    setValue("type", typeValue);
    setTypeOpen(false);
  };

  const toggleDay = (day: number) => {
    setSelectedByDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const onSubmit: SubmitHandler<EventFormData> = async (formData) => {
    setSaveError(null);
    setSubmitting(true);

    try {
      const newEvent: Event = {
        id: eventData?.id || uuidv4(),
        title: formData.title,
        startDate: formData.startDate,
        endDate: formData.endDate,
        variant: formData.variant,
        ...((formData as any).type && { type: (formData as any).type }),
        ...((formData as any).color && { color: (formData as any).color }),
      };

      const toDateObj = (d: any) => d instanceof Date ? d : new Date(String(d));
      const start = toDateObj(newEvent.startDate);
      const end = toDateObj(newEvent.endDate);
      const pad = (n: number) => String(n).padStart(2, "0");
      const localDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
      const time = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
      const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

      const body: any = {
        title: newEvent.title,
        description: newEvent.description?.trim() || null,
        date: localDate,
        time,
        durationMinutes,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        type: selectedType,
        color: selectedColor,
      };

      try {
        body.meta = { endDate: end.toISOString(), durationMinutes };
      } catch (e) {}

      if (selectedByDays.length > 0) {
        body.repeatOption = 'weekly';
        body.byDays = selectedByDays;
        if (intervalWeeks > 1) body.interval = intervalWeeks;
        if (createTemplate) body.isTemplate = true;
        else if (materializeCount && materializeCount > 0) body.materializeCount = materializeCount;
        else if (materializeUntil) body.materializeUntil = materializeUntil;
      }

      const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";
      if (isDev) body.userId = "smoke_user";

      let serverEvent: any;
      
      if (!eventData?.id) {
        const resp = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          let errBody = null;
          try {
            const txt = await resp.text();
            try { errBody = JSON.parse(txt); } catch (e) { errBody = txt; }
          } catch (e) {
            errBody = String(e || 'Failed to read error body');
          }
          let errMessage = `Create failed ${resp.status}`;
          if (errBody) {
            if (typeof errBody === 'string') errMessage = `${errMessage}: ${errBody}`;
            else if (errBody && (errBody.error || errBody.message)) errMessage = `${errBody.error || errBody.message}${errBody.details ? ': ' + errBody.details : ''}`;
            else errMessage = `${errMessage}: ${JSON.stringify(errBody)}`;
          }
          throw new Error(errMessage);
        }
        const payload = await resp.json().catch(() => null);
        serverEvent = payload?.event || payload;
        const finalEvent: Event = {
          ...newEvent,
          id: serverEvent?.id || newEvent.id,
          startDate: serverEvent?.startDate || newEvent.startDate,
          endDate: serverEvent?.endDate || newEvent.endDate,
          ...(serverEvent?.color && { color: serverEvent.color }),
        };
        handlers.handleLocalAddEvent?.(finalEvent);
      } else {
        const resp = await fetch(`/api/events/${encodeURIComponent(eventData.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          let errBody = null;
          try {
            const txt = await resp.text();
            try { errBody = JSON.parse(txt); } catch (e) { errBody = txt; }
          } catch (e) {
            errBody = String(e || 'Failed to read error body');
          }
          let errMessage = `Update failed ${resp.status}`;
          if (errBody) {
            if (typeof errBody === 'string') errMessage = `${errMessage}: ${errBody}`;
            else if (errBody && (errBody.error || errBody.message)) errMessage = `${errBody.error || errBody.message}${errBody.details ? ': ' + errBody.details : ''}`;
            else errMessage = `${errMessage}: ${JSON.stringify(errBody)}`;
          }
          throw new Error(errMessage);
        }
        const payload = await resp.json().catch(() => null);
        serverEvent = payload?.event || payload;
        const finalEvent: Event = {
          ...newEvent,
          id: eventData.id,
          startDate: serverEvent?.startDate || newEvent.startDate,
          endDate: serverEvent?.endDate || newEvent.endDate,
          ...(serverEvent?.color && { color: serverEvent.color }),
        };
        handlers.handleLocalUpdateEvent?.(finalEvent);
      }
      setTimeout(() => setClose(), 50);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Recurrence page - REDESIGNED with compact layout
  if (modalPage === 1) {
    return (
      <div className="w-full max-h-[85vh] bg-white dark:bg-gray-950 overflow-y-auto">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-in {
            animation: slideIn 0.2s ease-out;
          }
          input[type="number"]::-webkit-inner-spin-button,
          input[type="number"]::-webkit-outer-spin-button {
            opacity: 1;
          }
        `}} />
        
        <div className="p-5 max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">Recurrence Pattern</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Set up repeating events</p>
            </div>
            <button
              type="button"
              onClick={() => setModalPage(0)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Repeat Interval */}
            <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
              <Label className="text-xs font-semibold text-gray-900 dark:text-white mb-2 block">Repeat Every</Label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={intervalWeeks}
                  onChange={(e) => setIntervalWeeks(Math.max(1, Math.min(52, parseInt(e.target.value) || 1)))}
                  className="w-20 h-10 px-3 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-center text-base font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">week{intervalWeeks > 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Days Selection */}
            <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
              <Label className="text-xs font-semibold text-gray-900 dark:text-white mb-3 block">Repeat On</Label>
              <div className="grid grid-cols-7 gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      "h-11 rounded-lg font-bold text-sm transition-all duration-200",
                      selectedByDays.includes(day.value)
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50 scale-105"
                        : "bg-white dark:bg-gray-950 text-gray-600 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-300 dark:border-gray-800"
                    )}
                    title={day.full}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
              {selectedByDays.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Select at least one day
                </p>
              )}
            </div>

            {/* End Condition */}
            <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
              <Label className="text-xs font-semibold text-gray-900 dark:text-white mb-3 block">End Repeat</Label>
              
              <div className="space-y-2">
                {/* Never (Template) */}
                <button
                  type="button"
                  onClick={() => {
                    setRecurrenceMode('none');
                    setCreateTemplate(true);
                    setMaterializeCount(null);
                    setMaterializeUntil(null);
                  }}
                  className={cn(
                    "w-full rounded-lg text-left transition-all duration-200 overflow-hidden",
                    recurrenceMode === 'none'
                      ? "bg-gradient-to-br from-purple-500/20 to-pink-500/20 ring-2 ring-purple-500"
                      : "bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                  )}
                >
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        recurrenceMode === 'none' ? "bg-purple-500" : "bg-gray-200 dark:bg-gray-800"
                      )}>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-gray-900 dark:text-white font-semibold text-sm">Never (Template)</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Create reusable pattern</div>
                      </div>
                    </div>
                    {recurrenceMode === 'none' && (
                      <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>

                {/* After X occurrences */}
                <button
                  type="button"
                  onClick={() => {
                    setRecurrenceMode('count');
                    setCreateTemplate(false);
                    setMaterializeUntil(null);
                    if (!materializeCount) setMaterializeCount(10);
                  }}
                  className={cn(
                    "w-full rounded-lg text-left transition-all duration-200 overflow-hidden",
                    recurrenceMode === 'count'
                      ? "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 ring-2 ring-blue-500"
                      : "bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                  )}
                >
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        recurrenceMode === 'count' ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-800"
                      )}>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-gray-900 dark:text-white font-semibold text-sm">After Occurrences</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Repeat specific times</div>
                      </div>
                    </div>
                    {recurrenceMode === 'count' && (
                      <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>

                {recurrenceMode === 'count' && (
                  <div className="pl-3 animate-in">
                    <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={materializeCount || 10}
                        onChange={(e) => setMaterializeCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 10)))}
                        className="w-20 h-9 px-3 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="10"
                      />
                      <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">occurrences</span>
                    </div>
                  </div>
                )}

                {/* Until Date */}
                <button
                  type="button"
                  onClick={() => {
                    setRecurrenceMode('until');
                    setCreateTemplate(false);
                    setMaterializeCount(null);
                  }}
                  className={cn(
                    "w-full rounded-lg text-left transition-all duration-200 overflow-hidden",
                    recurrenceMode === 'until'
                      ? "bg-gradient-to-br from-green-500/20 to-emerald-500/20 ring-2 ring-green-500"
                      : "bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                  )}
                >
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        recurrenceMode === 'until' ? "bg-green-500" : "bg-gray-200 dark:bg-gray-800"
                      )}>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-gray-900 dark:text-white font-semibold text-sm">On Date</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Repeat until specific date</div>
                      </div>
                    </div>
                    {recurrenceMode === 'until' && (
                      <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>

                {recurrenceMode === 'until' && (
                  <div className="pl-3 animate-in">
                    <input
                      type="date"
                      value={materializeUntil || ''}
                      onChange={(e) => setMaterializeUntil(e.target.value)}
                      className="w-full h-9 px-3 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Summary */}
            {selectedByDays.length > 0 && (
              <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-lg p-3 border border-blue-200 dark:border-blue-500/30">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-gray-900 dark:text-white leading-relaxed">
                    Repeats <span className="font-semibold">every {intervalWeeks > 1 ? `${intervalWeeks} weeks` : 'week'}</span> on{' '}
                    <span className="font-semibold text-blue-300">
                      {selectedByDays.map(d => DAYS[d].full).join(', ')}
                    </span>
                    {createTemplate && <span className="text-gray-600 dark:text-gray-400"> • Creates template</span>}
                    {materializeCount && <span className="text-gray-600 dark:text-gray-400"> • {materializeCount} times</span>}
                    {materializeUntil && <span className="text-gray-600 dark:text-gray-400"> • Until {new Date(materializeUntil).toLocaleDateString()}</span>}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <Button
              type="button"
              onClick={() => setModalPage(0)}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-200"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main form - ENHANCED with compact layout
  return (
    <div className="w-full max-h-[85vh] bg-white dark:bg-gray-950 overflow-y-auto">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-in {
          animation: slideIn 0.2s ease-out;
        }
        .dropdown-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .dropdown-scroll::-webkit-scrollbar-track {
          background: #1f2937;
        }
        .dropdown-scroll::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 3px;
        }
        .dropdown-scroll::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          cursor: pointer;
        }
      `}} />
      
      <div className="p-5 max-w-2xl mx-auto">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">
            {eventData?.id ? 'Edit Event' : 'Create Event'}
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-200">
            {eventData?.id ? 'Update event details' : 'Add a new event to your schedule'}
          </p>
        </div>

        <div className="space-y-4">
          {CustomAddEventModal ? (
            <CustomAddEventModal register={register} errors={errors} />
          ) : (
            <>
              {/* Event Name */}
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-400 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  Event Name
                </Label>
                <Input 
                  id="title" 
                  {...register("title")} 
                  placeholder="e.g., Team Meeting, Study Session" 
                  className={cn(
                    "h-10 px-3 rounded-lg border bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-500 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                    "transition-all duration-200",
                    errors.title ? "border-red-500 focus:ring-red-500" : "border-gray-200 dark:border-gray-800"
                  )} 
                />
                {errors.title && (
                  <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.title.message as string}
                  </p>
                )}
              </div>

              {/* Date & Time Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-400 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Date & Time
                </Label>
                <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
                  <SelectDate data={selectDateData} setValue={setValue} />
                </div>
              </div>

              {/* Type and Color Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Type Dropdown */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Type
                  </Label>
                  <div className="relative">
                    <button 
                      type="button" 
                      onClick={() => setTypeOpen(!typeOpen)}
                      className={cn(
                          "w-full h-10 px-3 rounded-lg border text-left text-sm font-medium",
                          "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800",
                          "text-gray-900 dark:text-white",
                          "hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-700",
                          "focus:outline-none focus:ring-2 focus:ring-blue-500",
                          "flex items-center justify-between gap-2",
                          "transition-all duration-200"
                        )}
                    >
                      <span className="flex items-center gap-2">
                        {EVENT_TYPES.find(t => t.value === selectedType)?.icon}
                        <span>{EVENT_TYPES.find(t => t.value === selectedType)?.label}</span>
                      </span>
                      <svg 
                        className={cn("w-4 h-4 text-gray-400 dark:text-slate-200 transition-transform duration-200", typeOpen && "rotate-180")} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {typeOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setTypeOpen(false)}
                        />
            <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-2xl overflow-hidden animate-in dropdown-scroll"
              style={{ maxHeight: '200px' }}>
                          {EVENT_TYPES.map((type) => (
                            <button 
                              key={type.value} 
                              type="button" 
                              onClick={() => handleTypeChange(type.value)}
                              className={cn(
                                "w-full text-left px-3 py-2.5 text-sm font-medium",
                                "text-gray-900 dark:text-white flex items-center gap-2",
                                "hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150",
                                selectedType === type.value && "bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300"
                              )}
                            >
                              {type.icon}
                              <span className="flex-1">{type.label}</span>
                              {selectedType === type.value && (
                                <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Color Selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-400 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    Color
                  </Label>
                  <div className="relative">
                    <button 
                      type="button" 
                      onClick={() => setColorOpen(!colorOpen)}
                      className={cn(
                        "w-full h-10 px-3 rounded-lg text-sm font-semibold text-white",
                        "flex items-center justify-between gap-2",
                        "transition-all duration-200 hover:brightness-110",
                        "shadow-lg",
                        COLORS.find(c => c.key === selectedColor)?.class
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className={cn("w-4 h-4 rounded border-2 border-white/30", COLORS.find(c => c.key === selectedColor)?.class)} />
                        {COLORS.find(c => c.key === selectedColor)?.name}
                      </span>
                      <svg 
                        className={cn("w-4 h-4 transition-transform duration-200", colorOpen && "rotate-180")} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {colorOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setColorOpen(false)}
                        />
                        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-2xl overflow-hidden animate-in">
                          {COLORS.map((color) => (
                            <button 
                              key={color.key} 
                              type="button" 
                              onClick={() => handleColorChange(color.key)}
                              className={cn(
                                "w-full text-left px-3 py-2.5 text-sm font-semibold",
                                "text-gray-900 dark:text-white flex items-center gap-2.5",
                                "transition-all duration-150",
                                color.class,
                                "hover:brightness-110",
                                selectedColor === color.key && "ring-2 ring-inset ring-blue-500/30 dark:ring-white/30"
                              )}
                            >
                              <span className={cn("w-4 h-4 rounded border-2 border-white/30", color.class)} />
                              <span className="flex-1">{color.name}</span>
                              {selectedColor === color.key && (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Recurrence Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-gray-400 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Recurrence
                  </Label>
                  <button 
                    type="button" 
                    onClick={() => setModalPage(1)}
                    className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5",
                        selectedByDays.length > 0
                          ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-600 hover:shadow-blue-500/50"
                          : "text-gray-500 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"
                      )}
                  >
                    {selectedByDays.length > 0 ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Pattern
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Pattern
                      </>
                    )}
                  </button>
                </div>
                {selectedByDays.length > 0 && (
                  <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-lg p-3 border border-blue-200/30 dark:border-blue-500/30 animate-in">
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-900 dark:text-white leading-relaxed">
                          Repeats <span className="font-semibold">every {intervalWeeks > 1 ? `${intervalWeeks} weeks` : 'week'}</span> on{' '}
                          <span className="font-semibold text-blue-300">
                            {selectedByDays.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">
                          {createTemplate && '• Template mode'}
                          {materializeCount && `• ${materializeCount} occurrences`}
                          {materializeUntil && `• Until ${new Date(materializeUntil).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {saveError && (
                <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30 animate-in">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-red-300 font-semibold">Error</p>
                      <p className="text-xs text-red-200 mt-0.5">{saveError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={() => setClose()}
                  className="p-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200"
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  disabled={submitting}
                  onClick={handleSubmit(onSubmit)}
                  className={cn(
                    "px-5 py-2 text-sm font-bold text-white rounded-lg transition-all duration-200",
                    "bg-blue-500 hover:bg-blue-600",
                    "shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
                    submitting && "animate-pulse"
                  )}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {eventData?.id ? 'Update Event' : 'Create Event'}
                    </span>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}