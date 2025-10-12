"use client";

import React, { useEffect, useState, useMemo } from "react";
import { CSSTransition } from 'react-transition-group';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useModal } from "@/providers/modal-context";
import RecurrenceModal from '@/components/schedule/_modals/recurrence-modal';
import SelectDate from "@/components/schedule/_components/add-event-components/select-date";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EventFormData, eventSchema, Variant, Event } from "@/types/index";
import { useScheduler } from "@/providers/schedular-provider";
import { v4 as uuidv4 } from "uuid";

const COLORS = [
  { key: "blue", name: "Blue", variant: "primary" as Variant, class: "bg-blue-600" },
  { key: "red", name: "Red", variant: "danger" as Variant, class: "bg-red-600" },
  { key: "green", name: "Green", variant: "success" as Variant, class: "bg-green-600" },
  { key: "yellow", name: "Yellow", variant: "warning" as Variant, class: "bg-yellow-500" },
];

export default function AddEventModal({
  CustomAddEventModal,
}: {
  CustomAddEventModal?: React.FC<{ register: any; errors: any }>;
}) {
  const { setClose, data, setOpen } = useModal();
  const eventData = (data?.default ?? null) as Event | null | undefined;
  const { handlers } = useScheduler();

  const [selectedColor, setSelectedColor] = useState<string>(
    (eventData as any)?.color || "blue"
  );
  const [colorOpen, setColorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // recurrence UI state
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [selectedByDays, setSelectedByDays] = useState<number[]>([]); // 0..6
  const [intervalWeeks, setIntervalWeeks] = useState<number>(1);
  const [createTemplate, setCreateTemplate] = useState(false);
  const [materializeCount, setMaterializeCount] = useState<number | null>(null);
  const [materializeUntil, setMaterializeUntil] = useState<string | null>(null);

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

  const [showInlineRecurrence, setShowInlineRecurrence] = useState(false);
  const [modalPage, setModalPage] = useState<number>(0); // 0 = main form, 1 = recurrence page

  // Memoize SelectDate data so the hook is called unconditionally here
  const selectDateData = useMemo(() => ({
    startDate: eventData?.startDate || new Date(),
    endDate: eventData?.endDate || new Date(),
  }), [eventData?.startDate, eventData?.endDate]);

  // Only reset the form when the actual eventData object changes
  // Avoid depending on the whole `data` map which may change identity on unrelated updates
  useEffect(() => {
    if (eventData) {
      const color = (eventData as any)?.color || "blue";
      reset({
        title: eventData.title,
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        variant: eventData.variant || "primary",
        color: color,
        type: (eventData as any)?.type || "assignment",
      });
      setSelectedColor(color);
    }
  }, [eventData, reset]);

  const handleColorChange = (colorKey: string) => {
    const color = COLORS.find(c => c.key === colorKey);
    setSelectedColor(colorKey);
    setValue("color", colorKey);
    setValue("variant", color?.variant || "primary");
    setColorOpen(false);
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

      // Debug: print payload before sending (both ISO and local-friendly)
      if (typeof window !== 'undefined') {
        try {
          const s = new Date(newEvent.startDate);
          const e = new Date(newEvent.endDate);
          console.log('[AddEventModal] Submitting event:', {
            startDateISO: s.toISOString(),
            startLocal: s.toString(),
            endDateISO: e.toISOString(),
            endLocal: e.toString(),
            repeatEnabled,
            selectedByDays,
            intervalWeeks,
            createTemplate,
            materializeCount,
            materializeUntil,
          });
        } catch (err) {
          console.log('[AddEventModal] Submitting event (raw):', { startDate: newEvent.startDate, endDate: newEvent.endDate });
        }
      }

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
        ...((formData as any).type && { type: (formData as any).type }),
        ...(selectedColor && { color: selectedColor }),
      };

      // Attach a meta object so servers that support metadata can persist the
      // exact end time and duration even if the DB schema doesn't have
      // dedicated columns. This is non-destructive and backward-compatible.
      try {
        body.meta = { endDate: end.toISOString(), durationMinutes };
      } catch (e) {}

      // Recurrence fields (optional)
      if (repeatEnabled) {
        body.repeatOption = 'weekly';
        if (selectedByDays && Array.isArray(selectedByDays) && selectedByDays.length > 0) body.byDays = selectedByDays;
        if (intervalWeeks && Number(intervalWeeks) > 1) body.interval = Number(intervalWeeks);
        // If user chose to save as template, set isTemplate; otherwise, if materializeCount provided, set materializeCount
        if (createTemplate) body.isTemplate = true;
        else if (materializeCount && Number(materializeCount) > 0) body.materializeCount = Number(materializeCount);
        else if (materializeUntil) body.materializeUntil = String(materializeUntil);
      }

      const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";
      if (isDev) body.userId = "smoke_user";

      let serverEvent: any;
      
      if (!eventData?.id) {
        // Log outgoing body for debugging
        try { console.info('[AddEventModal] POST body:', JSON.stringify(body, null, 2)); } catch (e) {}
        const resp = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          // Read the response body once (avoid double-read errors), then try to parse JSON
          let errBody = null;
          try {
            const txt = await resp.text();
            try { errBody = JSON.parse(txt); } catch (e) { errBody = txt; }
          } catch (e) {
            errBody = String(e || 'Failed to read error body');
          }
          console.error('[AddEventModal] server error response:', resp.status, errBody);
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
          // Preserve client-provided endDate first. If none, fall back to server-provided
          // endDate, then to server durationMinutes when only a duration was stored.
          endDate: serverEvent?.endDate || newEvent.endDate || (serverEvent && serverEvent.durationMinutes && (serverEvent.startDate || newEvent.startDate) ? new Date(new Date(serverEvent.startDate || newEvent.startDate).getTime() + Number(serverEvent.durationMinutes) * 60000).toISOString() : newEvent.endDate),
          ...(serverEvent?.color && { color: serverEvent.color }),
        };
        handlers.handleLocalAddEvent?.(finalEvent);
        // Persist a local backup so that if the DB didn't store endDate we can
        // still show the user's saved end time locally after a refresh.
        try {
          if (typeof window !== 'undefined' && finalEvent && finalEvent.id) {
            localStorage.setItem(`saved_event_${finalEvent.id}`, JSON.stringify({ endDate: finalEvent.endDate, durationMinutes }));
          }
        } catch (e) {}
      } else {
        try { console.info('[AddEventModal] PATCH body:', JSON.stringify(body, null, 2)); } catch (e) {}
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
          console.error('[AddEventModal] server error response (PATCH):', resp.status, errBody);
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
          // Preserve client-provided endDate if present; otherwise prefer server endDate
          // and finally compute from server durationMinutes if that's all we have.
          endDate: serverEvent?.endDate || newEvent.endDate || (serverEvent && serverEvent.durationMinutes && (serverEvent.startDate || newEvent.startDate) ? new Date(new Date(serverEvent.startDate || newEvent.startDate).getTime() + Number(serverEvent.durationMinutes) * 60000).toISOString() : newEvent.endDate),
          ...(serverEvent?.color && { color: serverEvent.color }),
        };
        handlers.handleLocalUpdateEvent?.(finalEvent);
        try {
          if (typeof window !== 'undefined' && finalEvent && finalEvent.id) {
            localStorage.setItem(`saved_event_${finalEvent.id}`, JSON.stringify({ endDate: finalEvent.endDate, durationMinutes }));
          }
        } catch (e) {}
      }
      setTimeout(() => setClose(), 50);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // If user navigated to recurrence page, show recurrence UI as the whole modal content
  // Only render one page at a time
  if (modalPage === 1) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <RecurrenceModal
          inline
          initial={{ byDays: selectedByDays, interval: intervalWeeks, isTemplate: createTemplate, materializeCount, materializeUntil, startDate: (function(){ const v = getValues('startDate'); return v instanceof Date ? v.toISOString() : (v ? String(v) : new Date().toISOString()); })() }}
          onSave={(rdata: any) => {
            setSelectedByDays(rdata.byDays || []);
            setIntervalWeeks(rdata.interval || 1);
            setCreateTemplate(!!rdata.isTemplate);
            setMaterializeCount(rdata.materializeCount || null);
            setMaterializeUntil(rdata.materializeUntil || null);
            setRepeatEnabled(true);
            setModalPage(0);
          }}
          onBack={() => setModalPage(0)}
          onCancel={() => setModalPage(0)}
        />
      </div>
    );
  }

  // Main form page
  return (
    <form className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200" onSubmit={handleSubmit(onSubmit)}>
      {CustomAddEventModal ? (
        <CustomAddEventModal register={register} errors={errors} />
      ) : (
        <>
          <div className="grid gap-1">
            <Label htmlFor="title" className="text-sm dark:text-slate-200">Event Name</Label>
            <Input id="title" {...register("title")} placeholder="Enter event name" className={cn("h-9 bg-white dark:bg-slate-800", errors.title && "border-red-500")} />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message as string}</p>}
          </div>

          {/* Description removed to conserve space */}

          <div className="grid gap-1">
            {/**
             * Pass the memoized data we created above. Calling hooks like
             * useMemo inside JSX conditionally caused the hooks mismatch error.
             */}
            <SelectDate data={selectDateData} setValue={setValue} />
          </div>

          {/* Recurrence: open a dedicated modal to configure recurrence */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm dark:text-slate-200">Repeat</Label>
              <div>
                <button type="button" onClick={() => {
                  // switch the modal to the recurrence page
                  setModalPage(1);
                }} className="h-9 px-3 rounded-md border text-sm">Configure recurrence</button>
              </div>
            </div>
            {/* show a small summary line when recurrence is configured */}
            {selectedByDays && selectedByDays.length > 0 && (
              <div className="text-xs text-gray-500 dark:text-slate-300">Repeats weekly on: {selectedByDays.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="type" className="text-sm dark:text-slate-200">Type</Label>
              <select id="type" {...register("type")} className="h-9 px-2 border rounded-md text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200">
                <option value="lecture">Lecture</option>
                <option value="assignment">Assignment</option>
                <option value="deadline">Deadline</option>
                <option value="personal">Personal</option>
              </select>
            </div>

            <div className="grid gap-1">
              <Label className="text-sm">Color</Label>
              <div className="relative">
                <button type="button" onClick={() => setColorOpen(!colorOpen)} className={cn("h-9 w-full text-white px-3 rounded-md text-sm font-medium", COLORS.find(c => c.key === selectedColor)?.class)}>
                  {COLORS.find(c => c.key === selectedColor)?.name}
                </button>
                {colorOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border rounded-md shadow-lg py-0.5">
                    {COLORS.map((color) => (
                      <button key={color.key} type="button" onClick={() => handleColorChange(color.key)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-slate-700">
                        {color.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {saveError && <div className="p-2 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded text-xs text-red-600 dark:text-red-300">{saveError}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setClose()} className="h-9">Cancel</Button>
            <Button type="submit" disabled={submitting} className="h-9">{submitting ? "Saving..." : "Save Event"}</Button>
          </div>
        </>
      )}
    </form>
  );
}