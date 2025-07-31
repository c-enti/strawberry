"use client";

interface CalendarDate {
  year: number;
  month: number;
  date: number;
  isToday: boolean;
  isCurrentMonth: boolean;
}

// LRU Cache implementation for better memory management
class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;
  private usage: Map<K, number>;
  private timestamp: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
    this.usage = new Map();
    this.timestamp = 0;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.usage.set(key, ++this.timestamp);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.capacity) {
      let oldestKey = this.cache.keys().next().value;
      let oldestTime = Infinity;

      for (const [k, time] of this.usage.entries()) {
        if (time < oldestTime) {
          oldestTime = time;
          oldestKey = k;
        }
      }

      this.cache.delete(oldestKey);
      this.usage.delete(oldestKey);
    }

    this.cache.set(key, value);
    this.usage.set(key, ++this.timestamp);
  }

  clear(): void {
    this.cache.clear();
    this.usage.clear();
    this.timestamp = 0;
  }
}

// Shared singleton instance of today's date
const TODAY = new Date();
const TODAY_YEAR = TODAY.getFullYear();
const TODAY_MONTH = TODAY.getMonth();
const TODAY_DATE = TODAY.getDate();

// Cache for month matrices
const monthMatrixCache = new LRUCache<string, CalendarDate[][]>(24); // Cache 2 years worth of months

// Efficient date calculations
const getDaysInMonth = (year: number, month: number): number => {
  // Use lookup table for common cases
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month !== 1) return daysInMonth[month];
  // Only calculate leap years for February
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
};

const getFirstDayOfMonth = (() => {
  // Cache of first day calculations
  const cache = new Map<string, number>();

  return (year: number, month: number): number => {
    const key = `${year}-${month}`;
    if (cache.has(key)) return cache.get(key)!;

    const day = new Date(year, month, 1).getDay();
    cache.set(key, day);
    return day;
  };
})();

// Pre-allocate arrays for better memory efficiency
const EMPTY_WEEK = () => Array(7).fill(null);
const EMPTY_MONTH = () =>
  Array(6)
    .fill(null)
    .map(() => EMPTY_WEEK());

export const getMonthMatrix = (
  year: number,
  month: number
): CalendarDate[][] => {
  const cacheKey = `${year}-${month}`;
  const cached = monthMatrixCache.get(cacheKey);
  if (cached) return cached;

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfMonth(year, month);

  // Calculate adjacent month info
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextMonthYear = month === 11 ? year + 1 : year;

  // Get days from previous month that we need to display
  const daysFromPrevMonth = firstDayOfWeek;
  const daysInPrevMonth = getDaysInMonth(prevMonthYear, prevMonth);

  // Initialize result matrix (6 weeks × 7 days)
  const matrix = EMPTY_MONTH();
  let weekIndex = 0;
  let dayIndex = 0;

  // Fill in days from previous month
  for (let i = 0; i < daysFromPrevMonth; i++) {
    const date = daysInPrevMonth - daysFromPrevMonth + i + 1;
    matrix[0][i] = {
      year: prevMonthYear,
      month: prevMonth,
      date,
      isToday:
        prevMonthYear === TODAY_YEAR &&
        prevMonth === TODAY_MONTH &&
        date === TODAY_DATE,
      isCurrentMonth: false,
    };
    dayIndex++;
  }

  // Fill in days from current month
  for (let date = 1; date <= daysInMonth; date++) {
    if (dayIndex === 7) {
      dayIndex = 0;
      weekIndex++;
    }
    matrix[weekIndex][dayIndex] = {
      year,
      month,
      date,
      isToday:
        year === TODAY_YEAR && month === TODAY_MONTH && date === TODAY_DATE,
      isCurrentMonth: true,
    };
    dayIndex++;
  }

  // Fill in days from next month
  let nextMonthDate = 1;
  while (weekIndex < 6) {
    if (dayIndex === 7) {
      dayIndex = 0;
      weekIndex++;
      if (weekIndex >= 6) break;
    }
    if (matrix[weekIndex][dayIndex] === null) {
      matrix[weekIndex][dayIndex] = {
        year: nextMonthYear,
        month: nextMonth,
        date: nextMonthDate,
        isToday:
          nextMonthYear === TODAY_YEAR &&
          nextMonth === TODAY_MONTH &&
          nextMonthDate === TODAY_DATE,
        isCurrentMonth: false,
      };
      nextMonthDate++;
      dayIndex++;
    }
  }

  monthMatrixCache.set(cacheKey, matrix);
  return matrix;
};

// Cache for year matrices with LRU
const yearMatrixCache = new LRUCache<number, CalendarDate[][][]>(3); // Cache only 3 years at a time

export const getYearMatrix = (year: number): CalendarDate[][][] => {
  const cached = yearMatrixCache.get(year);
  if (cached) return cached;

  const matrix = new Array(12);
  for (let month = 0; month < 12; month++) {
    matrix[month] = getMonthMatrix(year, month);
  }

  yearMatrixCache.set(year, matrix);
  return matrix;
};

export const formatDate = (
  year: number,
  month: number,
  date: number
): string => {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(
    2,
    "0"
  )}`;
};
