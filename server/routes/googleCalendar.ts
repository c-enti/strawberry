import express from "express";
import { CalendarError } from "../lib/errors";
import { googleCalendarService } from "../services/googleCalendar";

const router = express.Router();

// Mock OAuth flow initiation
router.get("/auth", (req, res) => {
  try {
    const authUrl = googleCalendarService.getAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    if (error instanceof CalendarError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res
        .status(500)
        .json({ error: "Internal server error during authentication" });
    }
  }
});

// Mock OAuth callback handling
router.get("/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code || typeof code !== "string") {
      throw new CalendarError("Authorization code is required", 400);
    }
    const token = await googleCalendarService.handleCallback(code);
    res.json({ token });
  } catch (error) {
    if (error instanceof CalendarError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error during callback" });
    }
  }
});

// List calendar events
router.get("/events", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      throw new CalendarError("Access token is required", 401);
    }
    const events = await googleCalendarService.listEvents(token);
    res.json({ events });
  } catch (error) {
    if (error instanceof CalendarError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res
        .status(500)
        .json({ error: "Internal server error while fetching events" });
    }
  }
});

// Import calendar events
router.post("/import", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      throw new CalendarError("Access token is required", 401);
    }
    const { events } = req.body;
    if (!Array.isArray(events)) {
      throw new CalendarError("Events array is required", 400);
    }
    const success = await googleCalendarService.importEvents(token, events);
    res.json({ success });
  } catch (error) {
    if (error instanceof CalendarError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error during import" });
    }
  }
});

export = router;
