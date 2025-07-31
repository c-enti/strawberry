import request from "supertest";
import app from "../app";
import { MockGoogleCalendarService } from "../services/googleCalendar";
import { CalendarError } from "../lib/errors";

describe("Google Calendar Integration", () => {
  describe("GET /calendar/google/auth", () => {
    it("should redirect to mock auth URL", async () => {
      const response = await request(app)
        .get("/calendar/google/auth")
        .expect(302);

      expect(response.header.location).toBe(
        "http://localhost:5000/calendar/google/callback?mock=true"
      );
    });

    it("should handle internal server error during auth", async () => {
      // Mock the service to throw a generic error
      jest
        .spyOn(MockGoogleCalendarService.prototype, "getAuthUrl")
        .mockImplementationOnce(() => {
          throw new Error("Internal error");
        });

      const response = await request(app)
        .get("/calendar/google/auth")
        .expect(500);

      expect(response.body).toHaveProperty(
        "error",
        "Internal server error during authentication"
      );
    });

    it("should handle CalendarError during auth", async () => {
      // Mock the service to throw a CalendarError
      jest
        .spyOn(MockGoogleCalendarService.prototype, "getAuthUrl")
        .mockImplementationOnce(() => {
          throw new CalendarError("Custom auth error", 403);
        });

      const response = await request(app)
        .get("/calendar/google/auth")
        .expect(403);

      expect(response.body).toHaveProperty("error", "Custom auth error");
    });
  });

  describe("GET /calendar/google/callback", () => {
    it("should handle valid authorization code", async () => {
      const response = await request(app)
        .get("/calendar/google/callback")
        .query({ code: "valid-code" })
        .expect(200);

      expect(response.body).toHaveProperty("token", "mock-access-token");
    });

    it("should handle invalid authorization code", async () => {
      const response = await request(app)
        .get("/calendar/google/callback")
        .query({ code: "invalid" })
        .expect(401);

      expect(response.body).toHaveProperty(
        "error",
        "Invalid authorization code"
      );
    });

    it("should handle missing authorization code", async () => {
      const response = await request(app)
        .get("/calendar/google/callback")
        .expect(400);

      expect(response.body).toHaveProperty(
        "error",
        "Authorization code is required"
      );
    });

    it("should handle malformed authorization code", async () => {
      const response = await request(app)
        .get("/calendar/google/callback")
        .query({ code: { invalid: "object" } })
        .expect(400);

      expect(response.body).toHaveProperty(
        "error",
        "Authorization code is required"
      );
    });

    it("should handle internal server error during callback", async () => {
      jest
        .spyOn(MockGoogleCalendarService.prototype, "handleCallback")
        .mockImplementationOnce(() => {
          throw new Error("Internal error");
        });

      const response = await request(app)
        .get("/calendar/google/callback")
        .query({ code: "valid-code" })
        .expect(500);

      expect(response.body).toHaveProperty(
        "error",
        "Internal server error during callback"
      );
    });
  });

  describe("GET /calendar/google/events", () => {
    it("should return mock events with valid token", async () => {
      const response = await request(app)
        .get("/calendar/google/events")
        .set("Authorization", "Bearer mock-access-token")
        .expect(200);

      expect(response.body).toHaveProperty("events");
      expect(response.body.events).toHaveLength(2);
      expect(response.body.events[0]).toHaveProperty("summary", "Team Meeting");
    });

    it("should handle invalid token", async () => {
      const response = await request(app)
        .get("/calendar/google/events")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body).toHaveProperty("error", "Invalid access token");
    });

    it("should handle missing token", async () => {
      const response = await request(app)
        .get("/calendar/google/events")
        .expect(401);

      expect(response.body).toHaveProperty("error", "Access token is required");
    });

    it("should handle malformed authorization header", async () => {
      const response = await request(app)
        .get("/calendar/google/events")
        .set("Authorization", "malformed-header")
        .expect(401);

      expect(response.body).toHaveProperty("error", "Access token is required");
    });

    it("should handle internal server error during events fetch", async () => {
      jest
        .spyOn(MockGoogleCalendarService.prototype, "listEvents")
        .mockImplementationOnce(() => {
          throw new Error("Internal error");
        });

      const response = await request(app)
        .get("/calendar/google/events")
        .set("Authorization", "Bearer mock-access-token")
        .expect(500);

      expect(response.body).toHaveProperty(
        "error",
        "Internal server error while fetching events"
      );
    });
  });

  describe("POST /calendar/google/import", () => {
    it("should handle valid import request", async () => {
      const response = await request(app)
        .post("/calendar/google/import")
        .set("Authorization", "Bearer mock-access-token")
        .send({
          events: [
            {
              id: "test-event",
              summary: "Test Event",
              start: { dateTime: "2025-06-10T10:00:00Z" },
              end: { dateTime: "2025-06-10T11:00:00Z" },
            },
          ],
        })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
    });

    it("should handle invalid token during import", async () => {
      const response = await request(app)
        .post("/calendar/google/import")
        .set("Authorization", "Bearer invalid-token")
        .send({ events: [] })
        .expect(401);

      expect(response.body).toHaveProperty("error", "Invalid access token");
    });

    it("should handle missing events array", async () => {
      const response = await request(app)
        .post("/calendar/google/import")
        .set("Authorization", "Bearer mock-access-token")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error", "Events array is required");
    });

    it("should handle malformed events data", async () => {
      const response = await request(app)
        .post("/calendar/google/import")
        .set("Authorization", "Bearer mock-access-token")
        .send({ events: "not-an-array" })
        .expect(400);

      expect(response.body).toHaveProperty("error", "Events array is required");
    });

    it("should handle internal server error during import", async () => {
      jest
        .spyOn(MockGoogleCalendarService.prototype, "importEvents")
        .mockImplementationOnce(() => {
          throw new Error("Internal error");
        });

      const response = await request(app)
        .post("/calendar/google/import")
        .set("Authorization", "Bearer mock-access-token")
        .send({
          events: [
            {
              id: "test-event",
              summary: "Test Event",
              start: { dateTime: "2025-06-10T10:00:00Z" },
              end: { dateTime: "2025-06-10T11:00:00Z" },
            },
          ],
        })
        .expect(500);

      expect(response.body).toHaveProperty(
        "error",
        "Internal server error during import"
      );
    });

    it("should handle CalendarError during import", async () => {
      jest
        .spyOn(MockGoogleCalendarService.prototype, "importEvents")
        .mockImplementationOnce(() => {
          throw new CalendarError("Invalid event format", 400);
        });

      const response = await request(app)
        .post("/calendar/google/import")
        .set("Authorization", "Bearer mock-access-token")
        .send({
          events: [
            {
              id: "test-event",
              summary: "Test Event",
              start: { dateTime: "2025-06-10T10:00:00Z" },
              end: { dateTime: "2025-06-10T11:00:00Z" },
            },
          ],
        })
        .expect(400);

      expect(response.body).toHaveProperty("error", "Invalid event format");
    });
  });
});
