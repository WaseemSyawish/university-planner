"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Calendar, Clock, Copy, Sparkles, ChevronRight } from "lucide-react";

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface RecurrenceData {
  byDays: number[];
  interval: number;
  isTemplate: boolean;
  materializeCount: number | null;
  materializeUntil: string | null;
  startDate: string;
}

interface RecurrenceModalProps {
  initial?: Partial<RecurrenceData>;
  onSave: (data: RecurrenceData) => void;
  onBack?: () => void;
  onCancel?: () => void;
  inline?: boolean;
}

export default function RecurrenceModal({
  initial = {},
  onSave,
  onBack,
  onCancel,
  inline = false,
}: RecurrenceModalProps) {
  const [selectedByDays, setSelectedByDays] = useState<number[]>(initial.byDays || []);
  const [intervalWeeks, setIntervalWeeks] = useState<number>(initial.interval || 1);
  const [saveAsTemplate, setSaveAsTemplate] = useState<boolean>(initial.isTemplate || false);
  const [materializeCount, setMaterializeCount] = useState<number | null>(initial.materializeCount || null);
  const [materializeUntil, setMaterializeUntil] = useState<string | null>(initial.materializeUntil || null);
  const [startDateIso] = useState<string>(initial.startDate || new Date().toISOString());
  const [page, setPage] = useState<number>(0);

  const computeOccurrences = (
    startDateStr: string,
    byDaysArr: number[],
    interval: number = 1,
    maxCount: number = 40,
    untilIso: string | null = null
  ) => {
    const out: Date[] = [];
    const start = new Date(startDateStr);
    const intervalWeeks = Math.max(1, Number(interval) || 1);
    const byDays = byDaysArr.length > 0 
      ? byDaysArr.filter(d => Number.isFinite(d) && d >= 0 && d <= 6) 
      : null;

    let cursor = new Date(start);
    let count = 0;
    const pushIf = (d: Date) => {
      if (count < maxCount) {
        out.push(new Date(d));
        count += 1;
      }
    };

    if (byDays && byDays.length > 0) {
      const startTime = start.getTime();
      let safeGuard = 0;
      
      while (count < maxCount && safeGuard < 10000) {
        const daysSinceStart = Math.floor((cursor.getTime() - startTime) / (86400000));
        const weekIndex = Math.floor(daysSinceStart / 7);
        const weekday = cursor.getDay();
        
        if (byDays.includes(weekday) && (weekIndex % intervalWeeks) === 0) {
          pushIf(new Date(cursor));
        }
        
        cursor.setDate(cursor.getDate() + 1);
        safeGuard += 1;
        
        if (untilIso && cursor.getTime() > new Date(untilIso).getTime()) break;
      }
      return out;
    }

    let safeGuard = 0;
    while (count < maxCount && safeGuard < 10000) {
      pushIf(new Date(cursor));
      cursor.setDate(cursor.getDate() + 7 * intervalWeeks);
      safeGuard += 1;
      
      if (untilIso && cursor.getTime() > new Date(untilIso).getTime()) break;
    }
    
    return out;
  };

  const previewDates = useMemo(() => {
    return computeOccurrences(startDateIso, selectedByDays, intervalWeeks, 6, materializeUntil);
  }, [startDateIso, selectedByDays, intervalWeeks, materializeUntil]);

  const toggleWeekday = (idx: number) => {
    setSelectedByDays(prev => 
      prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
    );
  };

  const handleSave = () => {
    onSave({
      byDays: selectedByDays,
      interval: intervalWeeks,
      isTemplate: saveAsTemplate,
      materializeCount,
      materializeUntil,
      startDate: startDateIso
    });
  };

  const handleBackClick = () => {
    if (page > 0) {
      setPage(p => p - 1);
    } else if (onBack) {
      onBack();
    }
  };

  const renderPage1 = () => (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          Weekdays
        </Label>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((day, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleWeekday(idx)}
              className={cn(
                'h-9 rounded-md border font-medium text-xs transition-all',
                selectedByDays.includes(idx)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              )}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Interval
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Every</span>
          <input
            type="number"
            min={1}
            max={52}
            value={intervalWeeks}
            onChange={(e) => setIntervalWeeks(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 h-9 px-2 text-center text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-600">week{intervalWeeks !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );

  const renderPage2 = () => (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 block">Mode</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSaveAsTemplate(true)}
            className={cn(
              'relative px-3 py-2 rounded-lg border-2 transition-all text-left text-sm',
              saveAsTemplate
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <div className="flex items-center gap-2">
              <Sparkles className={cn('w-4 h-4', saveAsTemplate ? 'text-indigo-600' : 'text-gray-400')} />
              <span className="font-medium">Template</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSaveAsTemplate(false)}
            className={cn(
              'relative px-3 py-2 rounded-lg border-2 transition-all text-left text-sm',
              !saveAsTemplate
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <div className="flex items-center gap-2">
              <Copy className={cn('w-4 h-4', !saveAsTemplate ? 'text-indigo-600' : 'text-gray-400')} />
              <span className="font-medium">Materialize</span>
            </div>
          </button>
        </div>
      </div>

      {!saveAsTemplate && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-600 mb-1.5 block">Count</Label>
            <input
              type="number"
              min={1}
              placeholder="10"
              value={materializeCount ?? ''}
              onChange={(e) => setMaterializeCount(e.target.value ? Number(e.target.value) : null)}
              className="w-full h-9 px-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1.5 block">Until</Label>
            <input
              type="date"
              value={materializeUntil ?? ''}
              onChange={(e) => setMaterializeUntil(e.target.value || null)}
              className="w-full h-9 px-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}

      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 block">Preview</Label>
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          <div className="max-h-32 overflow-y-auto">
            {previewDates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="w-6 h-6 text-gray-300 mb-1" />
                <p className="text-xs text-gray-400">No preview</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {previewDates.map((d, i) => (
                  <div 
                    key={i} 
                    className="px-3 py-1.5 bg-white text-xs text-gray-700"
                  >
                    {d.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      weekday: 'short'
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => (
    <>
      <div className="px-5 py-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">
          {page === 0 ? 'Recurrence Pattern' : 'Generation Settings'}
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {page === 0 ? 'Step 1 of 2' : 'Step 2 of 2'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {page === 0 ? renderPage1() : renderPage2()}
      </div>

      <div className="px-5 py-3 border-t bg-gray-50 flex justify-between items-center">
        <Button 
          variant="ghost" 
          onClick={handleBackClick}
          size="sm"
          className="h-9"
        >
          Back
        </Button>

        <div className="flex gap-2">
          {onCancel && (
            <Button 
              variant="outline" 
              onClick={onCancel}
              size="sm"
              className="h-9"
            >
              Cancel
            </Button>
          )}
          {page === 0 ? (
            <Button 
              onClick={() => setPage(1)}
              size="sm"
              className="h-9 bg-indigo-600 hover:bg-indigo-700"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button 
              onClick={handleSave}
              size="sm"
              className="h-9 bg-indigo-600 hover:bg-indigo-700"
            >
              Save
            </Button>
          )}
        </div>
      </div>
    </>
  );

  if (inline) {
    return (
      <div className="w-full flex flex-col border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden max-h-[500px]">
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 p-4">
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md h-auto max-h-[600px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {renderContent()}
      </div>
    </div>
  );
}