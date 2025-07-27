"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type CalendarView = "year" | "month" | "week" | "day";

interface CalendarViewContextProps {
  view: CalendarView;
  setView: (view: CalendarView) => void;
}

const CalendarViewContext = createContext<CalendarViewContextProps | undefined>(
  undefined
);

export const useCalendarView = () => {
  const ctx = useContext(CalendarViewContext);
  if (!ctx)
    throw new Error("useCalendarView must be used within CalendarViewProvider");
  return ctx;
};

export const CalendarViewProvider = ({ children }: { children: ReactNode }) => {
  const [view, setView] = useState<CalendarView>("year");
  return (
    <CalendarViewContext.Provider value={{ view, setView }}>
      {children}
    </CalendarViewContext.Provider>
  );
};
