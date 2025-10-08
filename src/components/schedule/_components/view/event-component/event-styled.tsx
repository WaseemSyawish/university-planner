"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useModal } from "@/providers/modal-context";
import AddEventModal from "@/components/schedule/_modals/add-event-modal";
import { Event, CustomEventModal } from "@/types";
import { TrashIcon, CalendarIcon, ClockIcon } from "@/components/icons/simple-icons";
import { useScheduler } from "@/providers/schedular-provider";
// lightweight builds avoid framer-motion here; motion not required for event card
import { cn } from "@/lib/utils";
import CustomModal from "@/components/ui/custom-modal";

// Function to format date
const formatDate = (date: Date) => {
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
};

// Function to format time only
const formatTime = (date: Date) => {
  return date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
};

// Color variants based on event type (background/text/border)
const variantColors = {
  primary: {
    bg: "bg-blue-400",
    border: "border-blue-500",
    text: "text-white",
  },
  danger: {
    bg: "bg-red-600",
    border: "border-red-700",
    text: "text-white",
  },
  success: {
    bg: "bg-green-600",
    border: "border-green-700",
    text: "text-white",
  },
  warning: {
    bg: "bg-amber-500",
    border: "border-amber-600",
    text: "text-white",
  },
};

interface EventStyledProps extends Event {
  minmized?: boolean;
  compact?: boolean;
  CustomEventComponent?: React.FC<Event>;
}

export default function EventStyled({
  event,
  onDelete,
  CustomEventModal,
}: {
  event: EventStyledProps;
  CustomEventModal?: CustomEventModal;
  onDelete?: (id: string) => void;
}) {
  const { setOpen } = useModal();
  const { handlers } = useScheduler();

  // Determine if delete button should be shown
  // Hide it for minimized events to save space, show on hover instead
  const shouldShowDeleteButton = !event?.minmized;

  // Handler function
  function handleEditEvent(event: Event) {
    // Open the modal with the content
    setOpen(
      <CustomModal title="Edit Event">
        <AddEventModal
          CustomAddEventModal={
            CustomEventModal?.CustomAddEventModal?.CustomForm
          }
        />
      </CustomModal>,
      async () => {
        return {
          ...event,
        };
      }
    );
  }

  // Get background color class based on variant
  const getBackgroundColor = (variant: string | undefined) => {
    const variantKey = variant as keyof typeof variantColors || "primary";
    const colors = variantColors[variantKey] || variantColors.primary;
    return `${colors.bg} ${colors.text} ${colors.border}`;
  };

  // Determine classes for background and strip. Prefer explicit event.color if provided.
  // Map simple color keys (like 'blue'|'red'|'green'|'yellow') to Tailwind classes
  const colorKeyToBg = (key) => {
    switch (key) {
      case 'blue':
        return { bg: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'red':
        return { bg: 'bg-red-100 text-red-800 border-red-200' };
      case 'green':
        return { bg: 'bg-green-100 text-green-800 border-green-200' };
      case 'yellow':
        return { bg: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
      default:
        return null;
    }
  };

  // Accept multiple color formats: simple keys (blue/red), tailwind classes (bg-blue-600), or hex colors (#1f6feb)
  const isHex = (s) => typeof s === 'string' && /^#([0-9A-F]{3}){1,2}$/i.test(s);
  const isTailwindBg = (s) => typeof s === 'string' && s.indexOf('bg-') === 0;

  let explicitColor = null;
  let bgInlineStyle = null;
  if (event && event.color) {
    const raw = String(event.color);
    if (isHex(raw)) {
      // use inline style for background
      bgInlineStyle = { backgroundColor: raw };
    } else if (isTailwindBg(raw)) {
      // if user persisted a tailwind bg class, use it directly
      explicitColor = { bg: raw };
    } else {
      // try mapping simple keys like 'blue'
      explicitColor = colorKeyToBg(raw);
    }
  }

  // Render the entire card using the accent color (full-color card) instead of a neutral surface + stripe.
  // Prefer explicit persisted color, fall back to variantColors.
  const rawAccent = explicitColor && explicitColor.bg ? explicitColor.bg : variantColors[event?.variant || 'primary']?.bg || variantColors.primary.bg;
  // If the persisted value contains multiple utility tokens (e.g. 'bg-blue-100 text-blue-800'), pick the bg- token.
  const accentBgClass = String(rawAccent || '').split(/\s+/).find(tok => tok.indexOf('bg-') === 0) || rawAccent || variantColors.primary.bg;
  const accentBorderClass = explicitColor && explicitColor.border ? explicitColor.border : (variantColors[event?.variant || 'primary']?.border || variantColors.primary.border);

  // Surface classes: use accent background for whole card and light text for contrast.
  // If using an inline hex bg, we'll set inline style and default to white text.
  const surfaceBgClass = accentBgClass;
  const surfaceTextClass = 'text-white';

  // Debug log to help diagnose color rendering issues
  try {
    // eslint-disable-next-line no-console
    console.debug('[EventStyled] resolved', {
      id: event?.id,
      rawColor: event?.color,
      bgInlineStyle,
      explicitColor,
    });
  } catch (e) {}

  // Behavior split:
  // - compact: used by month view day tiles (very small/compact pill)
  // - minmized (non-compact): used by timetable minimized events (keep larger appearance)
  const isCompact = !!event?.compact;

  const containerClass = cn(
    'w-full z-50 relative cursor-pointer group overflow-hidden transition-shadow duration-200',
    // keep h-full for non-compact (timetable) so it fills its column positioning as before
    !isCompact ? 'h-full' : '',
    // rounded: compact gets small radius, minimized (timetable) gets larger rounded look
    isCompact ? (event?.minmized ? 'rounded-sm' : 'rounded-md') : (event?.minmized ? 'rounded-lg' : 'rounded-xl')
  );

  const bodyPadding = isCompact ? (event?.minmized ? 'px-2 py-1' : 'p-2') : (event?.minmized ? 'px-3 py-1.5' : 'p-3');
  const titleClass = event?.minmized ? 'font-semibold text-[13px] truncate' : 'font-semibold text-base truncate';
  const minimizedMaxWidth = 'max-w-[220px]';
  // body radius: compact view uses small radii; timetable minimized uses pill-like radius
  const bodyRadius = isCompact ? (event?.minmized ? 'rounded-sm' : 'rounded-md') : (event?.minmized ? 'rounded-full' : 'rounded-md');

  return (
    <div key={event?.id} className={containerClass} style={{ lineHeight: 1 }}>
      {/* Delete button - shown by default for non-minimized, or on hover for minimized */}
      <Button
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          handlers.handleDeleteEvent(event?.id);
          onDelete?.(event?.id);
        }}
        variant="destructive"
        size="icon"
        className={cn(
          'absolute z-[100] right-3 top-2 h-7 w-7 p-0 shadow-sm transition-all duration-200',
          event?.minmized ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
        )}
      >
        <TrashIcon size={14} className="text-destructive-foreground" />
      </Button>

      {event.CustomEventComponent ? (
        <div
          onClick={(e: React.MouseEvent<HTMLDivElement>) => {
            e.stopPropagation();
            handleEditEvent({
              id: event?.id,
              title: event?.title,
              startDate: event?.startDate,
              endDate: event?.endDate,
              description: event?.description,
              variant: event?.variant,
            });
          }}
        >
          <event.CustomEventComponent {...event} />
        </div>
      ) : (
        <div
          onClick={(e: React.MouseEvent<HTMLDivElement>) => {
            e.stopPropagation();
            handleEditEvent({
              id: event?.id,
              title: event?.title,
              startDate: event?.startDate,
              endDate: event?.endDate,
              description: event?.description,
              variant: event?.variant,
            });
          }}
          className={cn('w-full flex items-stretch h-full min-h-0', event?.minmized ? '' : 'hover:shadow-lg')}
          style={{ minHeight: 0 }}
        >
          {/* Main card surface (full-color) */}
          <div
            className={cn(`${bodyPadding} min-h-0 ${bodyRadius} ${surfaceBgClass} ${surfaceTextClass}`)}
            style={{ ...(bgInlineStyle || {}), boxShadow: isCompact ? (event?.minmized ? '0 2px 6px rgba(2,6,23,0.04)' : '0 4px 8px rgba(2,6,23,0.06)') : (event?.minmized ? '0 6px 12px rgba(2,6,23,0.04)' : '0 6px 18px rgba(2,6,23,0.06)') }}
          >
            {event?.minmized ? (
              <div className="flex items-center gap-3">
                <div className={cn(titleClass, minimizedMaxWidth)} style={{ maxWidth: 220 }}>{event?.title || 'Untitled Event'}</div>
                <div className="ml-auto text-[11px] text-slate-500 dark:text-slate-300 bg-white/6 dark:bg-white/4 px-2 py-0.5 rounded-full">
                  {formatTime(event?.startDate)}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className={titleClass}>{event?.title || 'Untitled Event'}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-300">
                    {formatTime(event?.startDate)} — {formatTime(event?.endDate)}
                  </div>
                </div>
                {event?.description && <div className="my-1 text-xs text-slate-500 dark:text-slate-300">{event?.description}</div>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
