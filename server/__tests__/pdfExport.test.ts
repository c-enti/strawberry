import request from "supertest";
import express from "express";
import calendarRouter from "../routes/calendar";
import { cleanupDatabase, createTestCalendar } from "./helpers/db";
import { prisma } from "../lib/prisma";

const app = express();
app.use(express.json());
app.use("/calendar", calendarRouter);

describe("PDF Export API", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  it("GET /calendar/:id/pdf should return PDF for existing calendar", async () => {
    // Create test calendar with no background (most reliable for testing)
    const testCalendar = await createTestCalendar({
      year: 2025,
      selectedMonths: ["January", "February"],
      events: [
        { date: "2025-01-01", title: "New Year" },
        { date: "2025-02-14", title: "Valentine's Day" },
      ],
    });

    const response = await request(app)
      .get(`/calendar/${testCalendar.id}/pdf`)
      .expect("Content-Type", "application/pdf")
      .expect("Content-Disposition", 'attachment; filename="2025-calendar.pdf"')
      .expect(200);

    // Verify response is a PDF (starts with %PDF-)
    const pdfHeader = response.body.slice(0, 5).toString();
    expect(pdfHeader).toBe("%PDF-");
  });

  it("GET /calendar/:id/pdf should handle invalid background URL gracefully", async () => {
    const testCalendar = await createTestCalendar({
      year: 2025,
      selectedMonths: ["January"],
      events: [{ date: "2025-01-01", title: "New Year" }],
      backgroundUrl: "https://invalid-image-url.example.com/nonexistent.jpg",
    });

    const response = await request(app)
      .get(`/calendar/${testCalendar.id}/pdf`)
      .expect("Content-Type", "application/pdf")
      .expect("Content-Disposition", 'attachment; filename="2025-calendar.pdf"')
      .expect(200);

    // Should still return a valid PDF even with invalid background
    const pdfHeader = response.body.slice(0, 5).toString();
    expect(pdfHeader).toBe("%PDF-");
  });

  it("GET /calendar/:id/pdf should return 404 for non-existent calendar", async () => {
    const response = await request(app)
      .get("/calendar/nonexistent-id/pdf")
      .expect("Content-Type", /json/)
      .expect(404);

    expect(response.body).toHaveProperty("message", "Calendar not found");
  });

  it("GET /calendar/:id/pdf should handle database errors", async () => {
    // Mock prisma.calendar.findUnique to throw an error
    jest
      .spyOn(prisma.calendar, "findUnique")
      .mockRejectedValueOnce(new Error("Database connection failed"));

    const response = await request(app)
      .get(`/calendar/some-id/pdf`)
      .expect("Content-Type", /json/)
      .expect(500);

    expect(response.body).toHaveProperty(
      "error",
      "Internal server error while generating PDF"
    );
  });
});
