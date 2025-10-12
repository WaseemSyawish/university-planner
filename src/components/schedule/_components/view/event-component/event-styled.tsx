"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useModal } from "@/providers/modal-context";
import AddEventModal from "@/components/schedule/_modals/add-event-modal";
import { Event, CustomEventModal } from "@/types";
import { TrashIcon, CalendarIcon, ClockIcon } from "@/components/icons/simple-icons";
import { useScheduler } from "@/providers/schedular-provider";
import { cn } from "@/lib/utils";
import CustomModal from "@/components/ui/custom-modal";

// Function to format time only
const formatTime = (date: Date) => {
  return date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
};

// Refined color palette matching the screenshots exactly
const colorKeyToBg = (key, isDark = false) => {
  if (isDark) {
    // Darker, more saturated colors for dark mode
    switch (key) {
      case 'blue':
        return { bg: '#1e3a5f', text: '#93c5fd', border: '#2563eb' };
      case 'red':
        return { bg: '#4c1d24', text: '#fca5a5', border: '#dc2626' };
      case 'green':
        return { bg: '#14532d', text: '#86efac', border: '#16a34a' };
      case 'yellow':
        return { bg: '#451a03', text: '#fcd34d', border: '#d97706' };
      default:
        return null;
    }
  } else {
    // Light mode colors
    switch (key) {
      case 'blue':
        return { bg: '#e0f2fe', text: '#0c4a6e', border: '#bae6fd' };
      case 'red':
        return { bg: '#ffe4e6', text: '#881337', border: '#fecdd3' };
      case 'green':
        return { bg: '#d1fae5', text: '#064e3b', border: '#a7f3d0' };
      case 'yellow':
        return { bg: '#fef3c7', text: '#78350f', border: '#fde68a' };
      default:
        return null;
    }
  }
};

// Helpers: convert hex to rgb, compute luminance, and pick readable text color
const hexToRgb = (hex: string) => {
  if (!hex || typeof hex !== 'string') return null;
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 8) {
    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16),
      a: parseInt(cleaned.slice(6, 8), 16) / 255,
    };
  }
  if (cleaned.length === 6) {
    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16),
      a: 1,
    };
  }
  return null;
};

const luminance = (r: number, g: number, b: number) => {
  const srgb = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
};

const getReadableTextColor = (bg: string | undefined, isDark: boolean) => {
  try {
    if (!bg) return isDark ? '#e2e8f0' : '#0c4a6e';
    
    const maybeHex = typeof bg === 'string' && bg.startsWith('#') ? 
      (bg.length >= 7 ? ('#' + bg.replace('#', '').slice(0, 6)) : bg) : null;
    const bgRgb = hexToRgb(maybeHex || bg);
    
    if (!bgRgb) return isDark ? '#e2e8f0' : '#0c4a6e';
    
    const bgLum = luminance(bgRgb.r, bgRgb.g, bgRgb.b);
    
    // In dark mode, use lighter text
    // In light mode, use darker text
    if (isDark) {
      // For dark mode backgrounds, use light text
      return bgLum < 0.3 ? '#f1f5f9' : '#0f172a';
    } else {
      // For light mode backgrounds, use dark text
      return bgLum > 0.5 ? '#0f172a' : '#f8fafc';
    }
  } catch (e) {
    return isDark ? '#e2e8f0' : '#0c4a6e';
  }
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
  const [isHovered, setIsHovered] = useState(false);

  // Handler function
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

  // Check if color is hex
  const isHex = (s) => typeof s === 'string' && /^#([0-9A-F]{3}){1,2}$/i.test(s);

  // Resolve color value
  const resolvedColorValue = (event?.meta?.color) || event?.color;

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const mq = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
      const check = () => setIsDark(typeof document !== 'undefined' && (document.documentElement.classList.contains('dark') || (mq && mq.matches)));
      check();
      if (mq && mq.addEventListener) mq.addEventListener('change', check);
      else if (mq && mq.addListener) mq.addListener(check as any);
      return () => { if (mq && mq.removeEventListener) mq.removeEventListener('change', check); else if (mq && mq.removeListener) mq.removeListener(check as any); };
    } catch (e) {}
  }, []);

  // Get color scheme based on dark mode
  const getColorScheme = () => {
    if (resolvedColorValue) {
      const raw = String(resolvedColorValue);
      if (isHex(raw)) {
        // For hex colors in dark mode, use darker backgrounds
        if (isDark) {
          return { 
            bg: raw + '30', // more opacity for dark mode
            text: raw,
            border: raw + '60'
          };
        } else {
          return { 
            bg: raw + '20',
            text: raw,
            border: raw + '40'
          };
        }
      } else {
        const mapped = colorKeyToBg(raw, isDark);
        if (mapped) return mapped;
      }
    }
    // Default colors based on mode
    if (isDark) {
      return { bg: '#1e3a5f', text: '#93c5fd', border: '#2563eb' };
    } else {
      return { bg: '#e0f2fe', text: '#0c4a6e', border: '#bae6fd' };
    }
  };

  const colors = getColorScheme();
  const isCompact = !!event?.compact;
  const shouldSpanFull = !event?.collapsed;
  
  const resolvedBg = (typeof colors?.bg === 'string' && colors.bg) ? 
    colors.bg : (isDark ? '#1e293b' : '#ffffff');
  
  const finalTextColor = getReadableTextColor(resolvedBg, isDark);

  return (
    <div
      key={event?.id}
      className="w-full h-full relative cursor-pointer group"
      style={{ 
        gridColumn: shouldSpanFull ? '1 / -1' : 'auto',
        minHeight: 0,
        padding: '2px'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Delete button - appears on hover */}
      <button
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            handlers.handleDeleteEvent(event?.id);
            onDelete?.(event?.id);
          }}
          aria-label="Delete event"
          className="absolute"
          style={{
            right: '8px',
            top: '8px',
            width: '30px',
            height: '30px',
            aspectRatio: '1',
            padding: 0,
            transition: 'transform 0.12s ease, background 0.12s ease, color 0.12s ease, opacity 0.12s ease',
            borderRadius: '50%',
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)',
            background: 'none',
            backgroundImage: 'none',
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(2,6,23,0.06)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isDark ? '0 2px 8px rgba(2,6,23,0.6)' : '0 2px 8px rgba(2,6,23,0.06)',
            overflow: 'visible',
            zIndex: 9999,
            pointerEvents: isHovered ? 'auto' : 'none',
            opacity: isHovered ? 1 : 0,
            color: isDark ? '#f1f5f9' : '#475569' // use currentColor for the SVG
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundImage = 'none';
            e.currentTarget.style.background = isDark ? 'rgba(239,68,68,1)' : 'rgba(220,38,38,1)';
            e.currentTarget.style.backgroundColor = isDark ? 'rgba(239,68,68,1)' : 'rgba(220,38,38,1)';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = isDark ? '0 6px 18px rgba(2,6,23,0.6)' : '0 6px 18px rgba(2,6,23,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundImage = 'none';
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)';
            e.currentTarget.style.color = isDark ? '#f1f5f9' : '#475569';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = isDark ? '0 2px 8px rgba(2,6,23,0.6)' : '0 2px 8px rgba(2,6,23,0.06)';
          }}
        >
          <TrashIcon 
            size={16}
            className=""
            stroke="currentColor"
            {...{ strokeWidth: 1.8 }}
            style={{ display: 'block', opacity: 1 }}
          />
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
          className="w-full h-full"
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

          style={{
            width: '100%',
            height: '100%',
            backgroundColor: resolvedBg,
            borderRadius: '6px',
            border: `1px solid ${colors?.border || (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)')}`,
            padding: event?.minmized ? '8px 12px' : '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            transition: 'all 0.15s ease',
            boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.6)' : '0 1px 3px rgba(0,0,0,0.05)',
            color: finalTextColor
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = isDark ? '0 1px 3px rgba(0,0,0,0.6)' : '0 1px 3px rgba(0,0,0,0.05)';
          }}
        >
          {event?.minmized ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              width: '100%'
            }}>
              <div style={{ 
                fontWeight: 600, 
                fontSize: '13px',
                lineHeight: '1.2',
                color: finalTextColor,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                letterSpacing: '-0.01em'
              }}>
                {event?.title || 'Untitled Event'}
              </div>
              <div style={{ 
                fontSize: '11px',
                fontWeight: 500,
                color: finalTextColor,
                opacity: 0.85,
                whiteSpace: 'nowrap',
                letterSpacing: '0.01em'
              }}>
                {formatTime(event?.startDate)}
              </div>
            </div>
          ) : (
            <>
              <div style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                justifyContent: 'space-between', 
                gap: '8px',
                marginBottom: event?.description ? '6px' : 0
              }}>
                <div style={{ 
                  fontWeight: 600, 
                  fontSize: '14px',
                  lineHeight: '1.3',
                  color: finalTextColor,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  letterSpacing: '-0.01em'
                }}>
                  {event?.title || 'Untitled Event'}
                </div>
                <div style={{ 
                  fontSize: '11px',
                  fontWeight: 500,
                  color: finalTextColor,
                  opacity: 0.85,
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.01em'
                }}>
                  {formatTime(event?.startDate)}
                </div>
              </div>
              {event?.description && (
                <div style={{ 
                  fontSize: '12px',
                  lineHeight: '1.4',
                  color: finalTextColor,
                  opacity: 0.85,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  letterSpacing: '-0.005em'
                }}>
                  {event?.description}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}