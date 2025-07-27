import { CalendarError } from "../lib/errors";

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
}

export interface GoogleCalendarService {
  getAuthUrl(): string;
  handleCallback(code: string): Promise<string>;
  listEvents(token: string): Promise<GoogleCalendarEvent[]>;
  importEvents(token: string, events: GoogleCalendarEvent[]): Promise<boolean>;
}

// Mock implementation for development and testing
export class MockGoogleCalendarService implements GoogleCalendarService {
  private mockEvents: GoogleCalendarEvent[] = [
    {
      id: "mock-event-1",
      summary: "Team Meeting",
      description: "Weekly sync",
      start: {
        dateTime: "2025-06-10T10:00:00Z",
        timeZone: "UTC",
      },
      end: {
        dateTime: "2025-06-10T11:00:00Z",
        timeZone: "UTC",
      },
    },
    {
      id: "mock-event-2",
      summary: "Project Review",
      description: "Monthly review",
      start: {
        dateTime: "2025-06-15T14:00:00Z",
        timeZone: "UTC",
      },
      end: {
        dateTime: "2025-06-15T15:30:00Z",
        timeZone: "UTC",
      },
    },
  ];

  getAuthUrl(): string {
    return "http://localhost:5000/calendar/google/callback?mock=true";
  }

  async handleCallback(code: string): Promise<string> {
    if (code === "invalid") {
      throw new CalendarError("Invalid authorization code", 401);
    }
    return "mock-access-token";
  }

  async listEvents(token: string): Promise<GoogleCalendarEvent[]> {
    if (token !== "mock-access-token") {
      throw new CalendarError("Invalid access token", 401);
    }
    return this.mockEvents;
  }

  async importEvents(
    token: string,
    events: GoogleCalendarEvent[]
  ): Promise<boolean> {
    if (token !== "mock-access-token") {
      throw new CalendarError("Invalid access token", 401);
    }
    // Simulate successful import
    return true;
  }
}

// Export singleton instance for use across the application
export const googleCalendarService = new MockGoogleCalendarService();
