import express, { Express, Request, Response, NextFunction } from "express";
import createError from "http-errors";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";

import indexRouter from "./routes/index";
import usersRouter from "./routes/users";
import calendarRouter from "./routes/calendar";
import googleCalendarRouter from "./routes/googleCalendar";
import projectManagementRouter from "./routes/projectManagement";
import genaiRouter from "./routes/genai";

import { isServerReady } from "./lib/readiness";

const app: Express = express();

// Basic Express settings
app.set("json spaces", 2);
app.set("x-powered-by", false);

// Middleware
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Health check for CI

// Readiness endpoint
app.use((req, res, next) => {
  if (!isServerReady()) {
    return res.status(503).json({ error: "Backend not ready. Please retry shortly." });
  }
  next();
});

// Readiness endpoint for CI/CD probes
app.get("/ready", async (req, res) => {
  if (isServerReady()) {
    res.status(200).json({ status: "ready" });
  } else {
    res.status(503).json({ status: "not ready" });
  }
});

// Routes
app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/calendar", calendarRouter);
app.use("/calendar/google", googleCalendarRouter);
app.use("/projects", projectManagementRouter);
app.use("/api/genai", genaiRouter);

// catch 404 and forward to error handler
app.use(function (req: Request, res: Response, next: NextFunction) {
  next(createError(404));
});

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const CalendarError = require("./lib/errors").CalendarError;
  if (err instanceof CalendarError) {
    const status = (err as any).statusCode || 400;
    // Only log errors when not in test environment
    if (process.env.NODE_ENV !== "test") {
      console.error(`${status} - ${err.message}`);
    }
    res.status(status).json({ error: err.message });
  } else {
    // Always log unexpected errors, even in tests
    console.error(err.stack);
    res.status(500).json({ error: "Something broke!" });
  }
});

export default app;
