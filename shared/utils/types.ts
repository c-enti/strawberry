// TypeScript interfaces for CalendarEvent, Options etc.
export interface CalendarEvent {
  date: string;
  title: string;
}

export interface PDFExportOptions {
  year: number;
  selectedMonths: string[];
  events: CalendarEvent[];
  backgroundUrl?: string;
}
