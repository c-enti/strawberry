"use client";

import React, { useMemo, memo, useCallback, useState } from "react";
import { CalendarEvent, Holiday, Theme } from "../types/calendar";
import { getYearMatrix, formatDate } from "../utils/calendarUtils";
import { useTheme } from "../contexts/ThemeContext";
import styles from "./YearView.module.css";

interface YearViewProps {
  year: number;
  events: CalendarEvent[];
  holidays: Holiday[];
  theme: Theme;
  onDayClick?: (date: Date) => void;
}

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface DayCellProps {
  calDate: {
    year: number;
    month: number;
    date: number;
    isToday: boolean;
    isCurrentMonth: boolean;
  };
  events: CalendarEvent[];
  holidays: Holiday[];
  onDayClick?: (date: Date) => void;
  isSelected?: boolean;
  onClick: (date: Date) => void;
}

const DayCell = memo<DayCellProps>(
  ({ calDate, events, holidays, onDayClick, isSelected, onClick }) => {
    const dateStr = useMemo(
      () => formatDate(calDate.year, calDate.month, calDate.date),
      [calDate]
    );

    const { dateEvents, dateHolidays } = useMemo(
      () => ({
        dateEvents: events.filter((event) => event.date === dateStr),
        dateHolidays: holidays.filter((holiday) => holiday.date === dateStr),
      }),
      [events, holidays, dateStr]
    );

    const hasEvents = dateEvents.length > 0;
    const hasHolidays = dateHolidays.length > 0;

    const dayClasses = useMemo(
      () =>
        [
          styles.day,
          calDate.isToday ? styles.today : "",
          calDate.isCurrentMonth ? styles.currentMonth : styles.otherMonth,
          hasEvents ? styles.hasEvents : "",
          hasHolidays ? styles.hasHolidays : "",
          isSelected ? styles.selected : "",
        ]
          .filter(Boolean)
          .join(" "),
      [
        calDate.isToday,
        calDate.isCurrentMonth,
        hasEvents,
        hasHolidays,
        isSelected,
      ]
    );

    const date = useMemo(
      () => new Date(calDate.year, calDate.month, calDate.date),
      [calDate]
    );

    const tooltipContent = useMemo(
      () =>
        [
          date.toLocaleDateString(),
          hasEvents
            ? `Events: ${dateEvents.map((e) => e.title).join(", ")}`
            : "",
          hasHolidays
            ? `Holidays: ${dateHolidays.map((h) => h.name).join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      [date, hasEvents, dateEvents, hasHolidays, dateHolidays]
    );

    const handleClick = useCallback(() => {
      onClick(date);
      onDayClick?.(date);
    }, [onClick, onDayClick, date]);

    return (
      <div
        className={dayClasses}
        onClick={handleClick}
        title={tooltipContent}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleClick();
          }
        }}
      >
        <span className={styles.dayNumber}>{calDate.date}</span>
        {(hasEvents || hasHolidays) && (
          <div className={styles.indicators}>
            {hasEvents && <div className={styles.eventIndicator} />}
            {hasHolidays && <div className={styles.holidayIndicator} />}
          </div>
        )}
      </div>
    );
  }
);

DayCell.displayName = "DayCell";

const MonthGrid = memo(
  ({
    month,
    monthIndex,
    events,
    holidays,
    onDayClick,
    selectedDate,
    onDateClick,
  }: {
    month: ReturnType<typeof getYearMatrix>[0];
    monthIndex: number;
    events: CalendarEvent[];
    holidays: Holiday[];
    onDayClick?: (date: Date) => void;
    selectedDate: Date | null;
    onDateClick: (date: Date) => void;
  }) => (
    <div className={styles.month}>
      <h3 className={styles.monthTitle}>{months[monthIndex]}</h3>
      <div className={styles.weekdays}>
        {weekdays.map((day) => (
          <div key={day} className={styles.weekday}>
            {day}
          </div>
        ))}
      </div>
      <div className={styles.days}>
        {month.flat().map((calDate, dateIndex) => (
          <DayCell
            key={dateIndex}
            calDate={calDate}
            events={events}
            holidays={holidays}
            onDayClick={onDayClick}
            onClick={onDateClick}
            isSelected={
              selectedDate?.getTime() ===
              new Date(calDate.year, calDate.month, calDate.date).getTime()
            }
          />
        ))}
      </div>
    </div>
  )
);

MonthGrid.displayName = "MonthGrid";

export const YearView = memo<Omit<YearViewProps, "theme">>(
  ({ year, events, holidays, onDayClick }) => {
    const { currentTheme: theme } = useTheme();
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const handleDateClick = useCallback(
      (date: Date) => {
        console.log("Day clicked:", date);
        setSelectedDate((prevDate) =>
          prevDate?.getTime() === date.getTime() ? null : date
        );
        onDayClick?.(date);
      },
      [onDayClick]
    );

    const calendarMatrix = useMemo(() => getYearMatrix(year), [year]);

    const themeStyles = useMemo(
      () => ({
        backgroundColor: theme.background,
        color: theme.text || "#000",
        ["--calendar-primary" as string]: theme.primary,
        ["--calendar-accent" as string]: theme.accent,
        ["--calendar-surface" as string]: theme.surface || "#fff",
        ["--calendar-border" as string]: theme.border || "#ddd",
      }),
      [theme]
    );

    return (
      <div
        className={styles.yearView}
        style={themeStyles as React.CSSProperties}
      >
        <div className={styles.yearGrid}>
          {calendarMatrix.map((month, monthIndex) => (
            <MonthGrid
              key={monthIndex}
              month={month}
              monthIndex={monthIndex}
              events={events}
              holidays={holidays}
              onDayClick={onDayClick}
              selectedDate={selectedDate}
              onDateClick={handleDateClick}
            />
          ))}
        </div>
      </div>
    );
  }
);

YearView.displayName = "YearView";

export default YearView;
