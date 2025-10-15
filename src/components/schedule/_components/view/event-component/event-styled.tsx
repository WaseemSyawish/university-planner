"use client";

import React, { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useModal } from "@/providers/modal-context";
import AddEventModal from "@/components/schedule/_modals/add-event-modal";
import { Event, CustomEventModal } from "@/types";
import { TrashIcon, CalendarIcon, ClockIcon } from "@/components/icons/simple-icons";
import { useScheduler } from "@/providers/schedular-provider";
import { cn } from "@/lib/utils";
import CustomModal from "@/components/ui/custom-modal";

const formatTime = (date: Date) => {
  return date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
};

const colorKeyToBg = (key, isDark = false) => {
  if (isDark) {
    switch (key) {
      case 'blue':
        return { bg: '#1e3a5f', border: '#2563eb', text: '#93c5fd' };
      case 'red':
        return { bg: '#4c1d24', border: '#dc2626', text: '#fca5a5' };
      case 'green':
        return { bg: '#14532d', border: '#16a34a', text: '#86efac' };
      case 'yellow':
        return { bg: '#451a03', border: '#d97706', text: '#fcd34d' };
      case 'purple':
        return { bg: '#581c87', border: '#9333ea', text: '#d8b4fe' };
      default:
        return null;
    }
  } else {
    switch (key) {
      case 'blue':
        return { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' };
      case 'red':
        return { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' };
      case 'green':
        return { bg: '#dcfce7', border: '#22c55e', text: '#166534' };
      case 'yellow':
        return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' };
      case 'purple':
        return { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' };
      default:
        return null;
    }
  }
};

const hexToRgb = (hex: string) => {
  if (!hex || typeof hex !== 'string') return null;
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 6) {
    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16),
    };
  }
  return null;
};

interface EventStyledProps extends Event {
  minmized?: boolean;
  compact?: boolean;
  CustomEventComponent?: React.FC<Event>;
  meta?: any;
  collapsed?: boolean;
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
  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  function handleEditEvent(event: Event) {
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

  const isHex = (s) => typeof s === 'string' && /^#([0-9A-F]{3}){1,2}$/i.test(s);
  const resolvedColorValue = (event?.meta?.color) || event?.color;

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const mq = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
      const prefersDark = mq && mq.matches;
      const htmlHasDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      setIsDark(!!(htmlHasDark || prefersDark));
    } catch (e) {}
  }, []);

  // Force delete button styles with !important via CSSOM
  useEffect(() => {
    const btn = deleteBtnRef.current;
    if (!btn) return;
    
    const svg = btn.querySelector('svg');
    
    // Set styles with !important priority - theme-appropriate design
    if (isDark) {
      btn.style.setProperty('background-color', 'rgba(15, 23, 42, 0.9)', 'important');
      btn.style.setProperty('border', '1px solid rgba(71, 85, 105, 0.6)', 'important');
    } else {
      btn.style.setProperty('background-color', 'rgba(255, 255, 255, 0.95)', 'important');
      btn.style.setProperty('border', '1px solid rgba(203, 213, 225, 0.8)', 'important');
    }
    
    btn.style.setProperty('width', '18px', 'important');
    btn.style.setProperty('height', '18px', 'important');
    btn.style.setProperty('border-radius', '3px', 'important');
    btn.style.setProperty('padding', '0', 'important');
    btn.style.setProperty('cursor', 'pointer', 'important');
    btn.style.setProperty('display', 'flex', 'important');
    btn.style.setProperty('align-items', 'center', 'important');
    btn.style.setProperty('justify-content', 'center', 'important');
    btn.style.setProperty('backdrop-filter', 'blur(4px)', 'important');
    
    if (svg) {
      if (isDark) {
        svg.style.setProperty('stroke', '#cbd5e1', 'important');
      } else {
        svg.style.setProperty('stroke', '#64748b', 'important');
      }
      svg.style.setProperty('fill', 'none', 'important');
    }
  }, [isDark]);

  const getColorScheme = () => {
    if (resolvedColorValue) {
      const raw = String(resolvedColorValue);
      if (isHex(raw)) {
        const rgb = hexToRgb(raw);
        if (rgb) {
          if (isDark) {
            // Dark mode: use darker, muted backgrounds
            const darkBg = `rgba(${Math.floor(rgb.r * 0.25)}, ${Math.floor(rgb.g * 0.25)}, ${Math.floor(rgb.b * 0.25)}, 0.9)`;
            const lightText = `rgba(${Math.min(255, rgb.r + 100)}, ${Math.min(255, rgb.g + 100)}, ${Math.min(255, rgb.b + 100)}, 1)`;
            return { 
              bg: darkBg,
              border: raw,
              text: lightText
            };
          } else {
            // Light mode: use lighter, pastel backgrounds
            const lightBg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
            const darkText = `rgba(${Math.floor(rgb.r * 0.6)}, ${Math.floor(rgb.g * 0.6)}, ${Math.floor(rgb.b * 0.6)}, 1)`;
            return { 
              bg: lightBg,
              border: raw,
              text: darkText
            };
          }
        }
      } else {
        const mapped = colorKeyToBg(raw, isDark);
        if (mapped) return mapped;
      }
    }
    // Default colors
    if (isDark) {
      return { bg: '#1e293b', border: '#475569', text: '#e2e8f0' };
    } else {
      return { bg: '#f8fafc', border: '#cbd5e1', text: '#1e293b' };
    }
  };

  const colors = getColorScheme();
  const shouldSpanFull = !event?.collapsed;

  return (
    <div
      key={event?.id}
      className="w-full h-full relative cursor-pointer group"
      style={{ 
        gridColumn: shouldSpanFull ? '1 / -1' : 'auto',
        minHeight: 0,
        padding: '2px'
      }}
    >
      {/* Delete Button - With forced styles via CSSOM */}
      <button
        ref={deleteBtnRef}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          handlers.handleDeleteEvent(event?.id);
          onDelete?.(event?.id);
        }}
        aria-label="Delete event"
        className="absolute z-[100] event-delete-btn opacity-0 group-hover:opacity-100 transition-all duration-200"
        style={{
          right: '5px',
          top: '5px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.setProperty('background-color', '#dc2626', 'important');
          e.currentTarget.style.setProperty('transform', 'scale(1.1)', 'important');
          e.currentTarget.style.setProperty('box-shadow', '0 2px 6px rgba(0, 0, 0, 0.4)', 'important');
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.setProperty('background-color', '#ef4444', 'important');
          e.currentTarget.style.setProperty('transform', 'scale(1)', 'important');
          e.currentTarget.style.setProperty('box-shadow', '0 1px 3px rgba(0, 0, 0, 0.3)', 'important');
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'block', pointerEvents: 'none' }}
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

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
          className="w-full h-full cursor-pointer"
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
          className="w-full h-full event-tile"
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: colors.bg,
            borderRadius: '6px',
            borderLeft: `4px solid ${colors.border}`,
            borderTop: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.5)'}`,
            borderRight: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.5)'}`,
            borderBottom: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.5)'}`,
            padding: event?.minmized ? '8px 10px' : '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            minHeight: 0,
            transition: 'transform 150ms linear, opacity 150ms linear',
            boxShadow: 'none',
          }}
        >
          <div style={{ 
            fontWeight: 600, 
            fontSize: '13px',
            lineHeight: '1.3',
            color: colors.text,
            marginBottom: '2px',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            wordBreak: 'break-word',
          }}>
            {event?.title || 'Untitled Event'}
          </div>
          <div style={{ 
            fontSize: '11px',
            fontWeight: 500,
            color: isDark ? '#94a3b8' : '#64748b',
          }}>
            {formatTime(event?.startDate)}
          </div>
          
          {!event?.minmized && event?.description && (
            <div style={{ 
              fontSize: '12px',
              lineHeight: '1.5',
              color: isDark ? '#94a3b8' : '#64748b',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'normal'
            }}>
              {event?.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}