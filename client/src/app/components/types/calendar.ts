export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  description?: string;
  category?: string;
  color?: string;
}

export interface Holiday {
  date: string;
  name: string;
  type?: "national" | "religious" | "observance";
}

export interface Theme {
  name: string;
  background: string;
  primary: string;
  accent: string;
  text?: string;
  surface?: string;
  border?: string;
}

export interface CalendarDay {
  date: Date;
  events: CalendarEvent[];
  holidays: Holiday[];
  isCurrentMonth: boolean;
  isToday: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number; // 0-11
  weeks: CalendarDay[][];
}

export interface CalendarYear {
  year: number;
  months: CalendarMonth[];
}
