"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
// Note: framer-motion is imported directly where needed. Avoid using next/dynamic for the whole module
// since it returns a module, not a component, which breaks TypeScript's dynamic typing expectations.
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, CalendarDaysIcon } from "@/components/icons/simple-icons";
// react-icons can be moderately large; import only used icons via dynamic if necessary
const BsCalendarMonth = dynamic(() => import("react-icons/bs").then((m) => m.BsCalendarMonth), { ssr: false });
const BsCalendarWeek = dynamic(() => import("react-icons/bs").then((m) => m.BsCalendarWeek), { ssr: false });

// AddEventModal is loaded lazily inside handleAddEvent to avoid pulling
// heavy form libraries (react-hook-form, zod, etc.) into this module's
// initial build chunk during development which slows compilation.
const DailyView = dynamic(() => import('./day/daily-view'), { ssr: false });
const MonthView = dynamic(() => import('./month/month-view'), { ssr: false });
const WeeklyView = dynamic(() => import('./week/week-view'), { ssr: false });
import { useModal } from "@/providers/modal-context";
import { ClassNames, CustomComponents, Views } from "@/types/index";
import { cn } from "@/lib/utils";
import CustomModal from "@/components/ui/custom-modal";

// Animation settings for Framer Motion (used when Motion is loaded)
const animationConfig = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3, type: "spring", stiffness: 250 },
};

export default function SchedulerViewFilteration({
  views = {
    views: ["day", "week", "month"],
    mobileViews: ["day"],
  },
  stopDayEventSummary = false,
  CustomComponents,
  classNames,
  initialView,
}: {
  views?: Views;
  stopDayEventSummary?: boolean;
  CustomComponents?: CustomComponents;
  classNames?: ClassNames;
  initialView?: string;
}) {
  const { setOpen } = useModal();
  const [activeView, setActiveView] = useState<string>(initialView ?? "day");
  const [clientSide, setClientSide] = useState(false);

  // reduce console noise in dev compilations

  useEffect(() => {
    setClientSide(true);
  }, []);

  const [isMobile, setIsMobile] = useState(
    clientSide ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    if (!clientSide) return;
    setIsMobile(window.innerWidth <= 768);
    function handleResize() {
      if (window && window.innerWidth <= 768) {
        setIsMobile(true);
      } else {
        setIsMobile(false);
      }
    }

    window && window.addEventListener("resize", handleResize);

    return () => window && window.removeEventListener("resize", handleResize);
  }, [clientSide]);

  function handleAddEvent(selectedDay?: number) {
    // Create the modal content with proper data
    const startDate = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      selectedDay ?? new Date().getDate(),
      0,
      0,
      0,
      0
    );

    const endDate = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      selectedDay ?? new Date().getDate(),
      23,
      59,
      59,
      999
    );

    // Create a wrapper component to handle data passing
    const ModalWrapper = () => {
      const title =
        CustomComponents?.CustomEventModal?.CustomAddEventModal?.title ||
        "Add Event";

      return (
        <div>
          <h2 className="text-xl font-semibold mb-4">{title}</h2>
        </div>
      );
    };

    // Open the modal with the content. Import the AddEventModal dynamically
    // at the time the user requests it so dev-time compilation doesn't
    // eagerly include its heavy dependencies.
    (async () => {
      try {
  const mod = await import("../../_modals/add-event-modal");
  // module shape may vary; prefer default export. use `any` to satisfy TS here
  const anyMod: any = mod;
  const AddEventModalLazy = anyMod?.default || anyMod;
        setOpen(
          <CustomModal title="Add Event">
            {/* @ts-ignore dynamic component */}
            <AddEventModalLazy
              CustomAddEventModal={
                CustomComponents?.CustomEventModal?.CustomAddEventModal?.CustomForm
              }
            />
          </CustomModal>
        );
      } catch (e) {
        // fallback: open a simple modal so the UI still responds
        setOpen(
          <CustomModal title="Add Event">
            <div className="p-4">Unable to load add-event form right now.</div>
          </CustomModal>
        );
        console.error("Failed to load AddEventModal dynamically", e);
      }
    })();
  }

  const viewsSelector = isMobile ? views?.mobileViews : views?.views;

  // Set initial active view
  useEffect(() => {
    if (viewsSelector?.length) {
      if (initialView && viewsSelector.includes(initialView)) {
        setActiveView(initialView);
      } else {
        setActiveView(viewsSelector[0]);
      }
    }
  }, [viewsSelector, initialView]);

  // Listen for the shimbed TabsTrigger events
  useEffect(() => {
    function onTabsChange(e: any) {
      if (!e || !e.detail) return;
      if (viewsSelector?.includes(e.detail)) setActiveView(e.detail);
    }
    window.addEventListener('tabs:change', onTabsChange as any);
    return () => window.removeEventListener('tabs:change', onTabsChange as any);
  }, [viewsSelector]);

  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full">
        <div className="dayly-weekly-monthly-selection relative w-full">
          <Tabs
            value={activeView}
            onValueChange={setActiveView}
            className={cn("w-full", classNames?.tabs)}
          >
            <div className="flex justify-between items-center mb-4">
              <TabsList className="grid grid-cols-3">
                {viewsSelector?.includes("day") && (
                  <TabsTrigger value="day">
                    {CustomComponents?.customTabs?.CustomDayTab ? (
                      CustomComponents.customTabs.CustomDayTab
                    ) : (
                      <div className="flex items-center space-x-2">
                        <CalendarDaysIcon size={15} />
                        <span>Day</span>
                      </div>
                    )}
                  </TabsTrigger>
                )}

                {viewsSelector?.includes("week") && (
                  <TabsTrigger value="week">
                    {CustomComponents?.customTabs?.CustomWeekTab ? (
                      CustomComponents.customTabs.CustomWeekTab
                    ) : (
                      <div className="flex items-center space-x-2">
                        <BsCalendarWeek />
                        <span>Week</span>
                      </div>
                    )}
                  </TabsTrigger>
                )}

                {viewsSelector?.includes("month") && (
                  <TabsTrigger value="month">
                    {CustomComponents?.customTabs?.CustomMonthTab ? (
                      CustomComponents.customTabs.CustomMonthTab
                    ) : (
                      <div className="flex items-center space-x-2">
                        <BsCalendarMonth />
                        <span>Month</span>
                      </div>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Add Event Button */}
              {CustomComponents?.customButtons?.CustomAddEventButton ? (
                <div onClick={() => handleAddEvent()}>
                  {CustomComponents?.customButtons.CustomAddEventButton}
                </div>
              ) : (
                <Button
                  onClick={() => handleAddEvent()}
                  className={cn(classNames?.buttons?.addEvent, "text-white")}
                  variant="default"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-white" />
                  Add Event
                </Button>
              )}
            </div>

            {viewsSelector?.includes("day") && (
              <TabsContent value="day">
                {/* Use Motion if available; dynamic import keeps this out of initial bundle */}
                <div>
                  <DailyView
                    stopDayEventSummary={stopDayEventSummary}
                    classNames={classNames?.buttons}
                    prevButton={CustomComponents?.customButtons?.CustomPrevButton}
                    nextButton={CustomComponents?.customButtons?.CustomNextButton}
                    CustomEventComponent={CustomComponents?.CustomEventComponent}
                    CustomEventModal={CustomComponents?.CustomEventModal}
                  />
                </div>
              </TabsContent>
            )}

            {viewsSelector?.includes("week") && (
              <TabsContent value="week">
                <div>
                  <WeeklyView
                    classNames={classNames?.buttons}
                    prevButton={CustomComponents?.customButtons?.CustomPrevButton}
                    nextButton={CustomComponents?.customButtons?.CustomNextButton}
                    CustomEventComponent={CustomComponents?.CustomEventComponent}
                    CustomEventModal={CustomComponents?.CustomEventModal}
                  />
                </div>
              </TabsContent>
            )}

            {viewsSelector?.includes("month") && (
              <TabsContent value="month">
                <div>
                  <MonthView
                    classNames={classNames?.buttons}
                    prevButton={CustomComponents?.customButtons?.CustomPrevButton}
                    nextButton={CustomComponents?.customButtons?.CustomNextButton}
                    CustomEventComponent={CustomComponents?.CustomEventComponent}
                    CustomEventModal={CustomComponents?.CustomEventModal}
                  />
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
