"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { useModal } from "@/providers/modal-context";
import SelectDate from "@/components/schedule/_components/add-event-components/select-date";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EventFormData, eventSchema, Variant, Event } from "@/types/index";
import { useScheduler } from "@/providers/schedular-provider";
import { v4 as uuidv4 } from "uuid"; // Use UUID to generate event IDs

export default function AddEventModal({
  CustomAddEventModal,
}: {
  CustomAddEventModal?: React.FC<{ register: any; errors: any }>;
}) {
  const { setClose, data } = useModal();

  // Modal data is stored in the modal context under the modal id (default = 'default').
  // Only use the 'default' modal's data to avoid accidentally treating the entire
  // context map as the event payload.
  const eventData = (data && (data.default ?? null)) as Event | undefined | null;

  const [selectedColor, setSelectedColor] = useState<string>(
    getEventColor(eventData?.variant || "primary")
  );

  const { handlers } = useScheduler();
  // read recurrence options from scheduler context (if provided)
  const { recurrenceOptions } = useScheduler() as any;
  const [selectedRecurrence, setSelectedRecurrence] = useState<string | null>('none');
  const [colorOpen, setColorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
    setValue,
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      startDate: new Date(),
      endDate: new Date(),
      variant: eventData?.variant || "primary",
      color: ((eventData as any)?.color) || "blue",
    },
  });

  // Reset the form on initialization
  useEffect(() => {
    if (eventData) {
      reset({
        title: eventData.title,
        description: eventData.description || "",
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        variant: eventData.variant || "primary",
        color: ((eventData as any)?.color) || "blue",
      });
      // sync the selected color visual state with incoming event data
      try {
        setSelectedColor(((eventData as any)?.color) || getEventColor(eventData.variant || "primary"));
        // initialize recurrence select from incoming event (if present)
        try { setSelectedRecurrence((eventData as any)?.recurrence?.id ?? 'none'); } catch (e) {}
      } catch (e) {}
    }
  }, [data, reset]);

  const colorOptions = [
    { key: "blue", name: "Blue", swatch: 'bg-blue-600' },
    { key: "red", name: "Red", swatch: 'bg-red-600' },
    { key: "green", name: "Green", swatch: 'bg-green-600' },
    { key: "yellow", name: "Yellow", swatch: 'bg-yellow-500' },
  ];

  function getEventColor(variant: Variant) {
    switch (variant) {
      case "primary":
        return "blue";
      case "danger":
        return "red";
      case "success":
        return "green";
      case "warning":
        return "yellow";
      default:
        return "blue";
    }
  }

  function getEventStatus(color: string) {
    switch (color) {
      case "blue":
        return "primary";
      case "red":
        return "danger";
      case "green":
        return "success";
      case "yellow":
        return "warning";
      default:
        return "default";
    }
  }

  const getButtonVariant = (color: string) => {
    switch (color) {
      case "blue":
        return "default";
      case "red":
        return "destructive";
      case "green":
        return "success";
      case "yellow":
        return "warning";
      default:
        return "default";
    }
  };

  const onSubmit: SubmitHandler<EventFormData> = async (formData) => {
    // assemble event object
    const newEvent: Event = {
      id: eventData?.id ? eventData.id : uuidv4(), // reuse id when editing
      title: formData.title,
      startDate: formData.startDate,
      endDate: formData.endDate,
      variant: formData.variant,
      description: formData.description,
      // include color in the in-memory event shape so callers/pages can persist it
      ...( (formData as any).color ? { color: (formData as any).color } : {} ),
      // include recurrence based on local selection (falls back to form field if set)
      ...((selectedRecurrence && selectedRecurrence !== 'none') ? { recurrence: { id: selectedRecurrence } } : ((formData as any).recurrenceOption ? { recurrence: { id: (formData as any).recurrenceOption } } : {})),
    };

    // Debug: log the event object and edit id (if any)
    try {
      console.debug("[AddEventModal] submitting event:", {
        event: newEvent,
        editingId: eventData?.id,
      });
    } catch (e) {
      // ignore console failures in old browsers
    }

  setSaveError(null);
  setSubmitting(true);
    try {
      // Persist to server directly from the modal to guarantee the event is sent.
      // This avoids cases where delegation paths don't reach the API.
      try {
        const toDateObj = (d:any) => (d instanceof Date ? d : new Date(String(d)));
        const start = toDateObj(newEvent.startDate || new Date());
        const end = toDateObj(newEvent.endDate || new Date(start.getTime() + 60 * 60 * 1000));
        const pad = (n:number) => String(n).padStart(2, '0');
        const localDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
        const time = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
        const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

        const meta:any = {};
        if ((newEvent as any).color) meta.color = (newEvent as any).color;
        if (newEvent.variant) meta.variant = newEvent.variant;
        if (typeof durationMinutes !== 'undefined' && durationMinutes !== null) meta.durationMinutes = Number(durationMinutes);

        const body: any = {
          title: newEvent.title,
          description: newEvent.description && String(newEvent.description).trim() ? String(newEvent.description) : null,
          date: localDate,
          time,
          durationMinutes,
          startDate: start instanceof Date ? start.toISOString() : start,
          endDate: end instanceof Date ? end.toISOString() : end,
        };
        if (Object.keys(meta).length > 0) body.meta = meta;
        const isDev = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');

        if (!eventData?.id) {
          const postBody: any = { ...body };
          if ((newEvent as any).recurrence && (newEvent as any).recurrence.id && (newEvent as any).recurrence.id !== 'none') {
            postBody.repeatOption = (newEvent as any).recurrence.id;
            // Explicitly request materialization by default when creating repeating events from the UI
            postBody.materialize = true;
          }
          if (isDev) postBody.userId = 'smoke_user';
          const resp = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(postBody) });
          if (!resp.ok) {
            let text = '';
            try { text = await resp.text(); } catch (e) { text = String(e); }
            throw new Error('Create failed ' + resp.status + ' ' + text);
          }
          const payload = await resp.json().catch(() => null);
          const serverEvent = payload && payload.event ? payload.event : payload;
          const finalEvent: Event = {
            ...newEvent,
            id: serverEvent?.id ?? newEvent.id,
            startDate: serverEvent?.startDate ?? newEvent.startDate,
            endDate: serverEvent?.endDate ?? newEvent.endDate,
          };
          try { handlers.handleLocalAddEvent?.(finalEvent); } catch (e) {}
        } else {
          const id = eventData.id;
          if ((newEvent as any).recurrence && (newEvent as any).recurrence.id && (newEvent as any).recurrence.id !== 'none') {
            body.repeatOption = (newEvent as any).recurrence.id;
            // When updating an event to be repeating, request materialization by default
            body.materialize = true;
          }
          if (isDev) body.userId = 'smoke_user';
          const resp = await fetch(`/api/events/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (!resp.ok) {
            // If the record no longer exists (404) and the user requested a recurrence,
            // try creating a new repeating event (materialize=true) instead of failing.
            let text = '';
            try { text = await resp.text(); } catch (e) { text = String(e); }
            const status = resp.status;
            if (status === 404 && (newEvent as any).recurrence && (newEvent as any).recurrence.id && (newEvent as any).recurrence.id !== 'none') {
              try {
                const postBody: any = { ...body };
                postBody.repeatOption = (newEvent as any).recurrence.id;
                postBody.materialize = true;
                if (isDev) postBody.userId = 'smoke_user';
                const createResp = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(postBody) });
                if (!createResp.ok) {
                  let ctext = '';
                  try { ctext = await createResp.text(); } catch (e) { ctext = String(e); }
                  throw new Error('Create fallback failed ' + createResp.status + ' ' + ctext);
                }
                const payload = await createResp.json().catch(() => null);
                const serverEvent = payload && payload.event ? payload.event : payload;
                const finalEvent: Event = {
                  ...newEvent,
                  id: serverEvent?.id ?? newEvent.id,
                  startDate: serverEvent?.startDate ?? newEvent.startDate,
                  endDate: serverEvent?.endDate ?? newEvent.endDate,
                };
                try { handlers.handleLocalAddEvent?.(finalEvent); } catch (e) {}
                // Close modal and return early (we already persisted via fallback)
                setSaveError(null);
                setTimeout(() => setClose(), 50);
                setSubmitting(false);
                return;
              } catch (cfErr) {
                // Fall through to throw the original update error if create fallback fails
                console.warn('[AddEventModal] fallback create after missing event failed', cfErr);
                throw new Error('Update failed ' + resp.status + ' ' + text);
              }
            }
            throw new Error('Update failed ' + resp.status + ' ' + text);
          }
          const payload = await resp.json().catch(() => null);
          const serverEvent = payload && payload.event ? payload.event : payload;
          const finalEvent: Event = {
            ...newEvent,
            id,
            startDate: serverEvent?.startDate ?? newEvent.startDate,
            endDate: serverEvent?.endDate ?? newEvent.endDate,
          };
          try { handlers.handleLocalUpdateEvent?.(finalEvent); } catch (e) {}
        }
      } catch (err) {
        // rethrow so outer catch handles it
        throw err;
      }
      setSaveError(null);
      setTimeout(() => setClose(), 50);
    } catch (err) {
      // surface error to the user
      try { setSaveError(err && err.message ? String(err.message) : String(err)); } catch (e) {}
      setSubmitting(false);
      return;
    } finally {
      setSubmitting(false);
    }
  };

  // helper to await handler if it returns a promise
  function awaitMaybe(fn: any, ...args: any[]) {
    try {
      const res = fn(...args);
      if (res && typeof res.then === 'function') return res;
      return Promise.resolve(res);
    } catch (e) {
      // propagate synchronous exceptions as rejected promise so callers can catch
      return Promise.reject(e);
    }
  }

  return (
  <form className="flex flex-col gap-3 p-3" onSubmit={handleSubmit(onSubmit)}>
      {CustomAddEventModal ? (
        <CustomAddEventModal register={register} errors={errors} />
      ) : (
        <>
          <div className="grid gap-1">
            <Label htmlFor="title">Event Name</Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="Enter event name"
              className={cn(errors.title && "border-red-500")}
            />
            {errors.title && (
              <p className="text-sm text-red-500">
                {errors.title.message as string}
              </p>
            )}
          </div>

          <div className="grid gap-1">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Enter event description"
            />
          </div>

          <SelectDate
            data={{
              startDate: eventData?.startDate || new Date(),
              endDate: eventData?.endDate || new Date(),
            }}
            setValue={setValue}
          />

          {/* Place recurrence selector beside color control on a single row for compact layout */}
          <div className="flex items-start gap-4">
            {Array.isArray(recurrenceOptions) && recurrenceOptions.length > 0 && (
              <div className="flex-1 min-w-[220px]">
                <Label htmlFor="recurrence">Repeat</Label>
                <div className="mt-1">
                  <Select
                    value={selectedRecurrence ?? undefined}
                    onValueChange={(val) => {
                      try { setSelectedRecurrence(val); } catch (e) {}
                      try { setValue('recurrenceOption' as any, val); } catch (e) {}
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="One time" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Only include a default 'none' option if recurrenceOptions doesn't already provide it */}
                      {!(Array.isArray(recurrenceOptions) && recurrenceOptions.some((o: any) => String(o.id) === 'none')) && (
                        <SelectItem value="none">One time event</SelectItem>
                      )}
                      {recurrenceOptions.map((opt: any) => (
                        <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="w-48">
              <div className="grid gap-2 relative">
                <Label>Color</Label>
                <div>
                  <div className="inline-block relative">
                    <button type="button" onClick={() => setColorOpen(!colorOpen)} className="inline-flex items-center gap-2" aria-haspopup="menu" aria-expanded={colorOpen}>
                      <span
                        className={`inline-flex items-center justify-center ${colorOptions.find(c => c.key === selectedColor)?.swatch || 'bg-purple-600'} text-white px-3 py-1 rounded-full ring-1 ring-gray-200 shadow-sm text-sm font-medium transition-colors duration-150 ease-out`}
                      >{colorOptions.find((color) => color.key === selectedColor)?.name}</span>
                    </button>
                    {colorOpen && (
                    <div className="absolute mt-1 right-0 bg-white border rounded shadow-md py-1" style={{ minWidth: 140 }}>
                      {colorOptions.map((color) => (
                        <div
                          key={color.key}
                          onClick={() => {
                            setSelectedColor(color.key);
                            setValue("variant", getEventStatus(color.key));
                            setValue("color", color.key);
                            setColorOpen(false);
                          }}
                          className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer ${selectedColor === color.key ? 'bg-gray-50' : ''}`}
                        >
                          <div className={`${color.swatch} w-3.5 h-3.5 rounded-full`} />
                          <div className="flex-1 text-sm">{color.name}</div>
                          {selectedColor === color.key && (
                            <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="none" aria-hidden>
                              <path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 pt-0">
            <div className="h-px bg-gray-100 mb-1" />
            <div className="flex justify-end space-x-3 -mt-0.5">
              <Button variant="outline" type="button" onClick={() => setClose()} className="px-3 py-1.5 text-sm">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="px-3 py-1.5 text-sm">{submitting ? 'Saving…' : 'Save Event'}</Button>
            </div>
            {saveError && (
              <div className="text-sm text-red-600 mt-2">{saveError}</div>
            )}
          </div>

          {/* development helper removed */}
        </>
      )}
    </form>
  );
}

  // Dev helper removed
