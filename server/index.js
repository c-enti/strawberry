// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

// Basic Express server setup
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const puppeteer = require("puppeteer-core");
const db = require("./db");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const app = express();
const PORT = process.env.PORT || 3000;

// --- Main Server Initialization Sequence ---
async function startServer(options = {}) {
  try {
    // 1. Initialize database first
    await db.initialize();
    serviceState.db.ready = true;
    serviceState.db.startupPhase = "ready";
    console.log("Database initialized successfully");

    // 1.b Initialize jobs DB for background export queue (optional)
    try {
      if (jobsModule && jobsModule.openJobsDb) {
        const jobsDbPath =
          process.env.JOBS_DB || path.join(process.cwd(), "data", "jobs.db");
        // Open and keep a handle to reuse across requests/workers
        module.exports._jobsDb = await jobsModule.openJobsDb(jobsDbPath);
        console.log("Jobs DB opened at", jobsDbPath);

        // Start periodic recovery pass to requeue stale jobs
        const recoveryInterval =
          parseInt(process.env.JOBS_RECOVERY_INTERVAL_MS) || 5 * 60 * 1000; // default 5m
        module.exports._jobsRecoveryTimer = setInterval(async () => {
          try {
            const requeued = await jobsModule.requeueStaleJobs(
              module.exports._jobsDb,
              parseInt(process.env.JOBS_STALE_MS) || 10 * 60 * 1000
            );
            if (requeued && requeued > 0)
              console.log(`Requeued ${requeued} stale jobs`);
          } catch (e) {
            console.warn(
              "requeueStaleJobs failed",
              e && e.message ? e.message : e
            );
          }
        }, recoveryInterval);
      }
    } catch (e) {
      console.warn(
        "Failed to initialize jobs DB or recovery timer:",
        e && e.message ? e.message : e
      );
    }

    // 2. Then initialize Puppeteer
    await startPuppeteer();

    // 3. Start the server only after all dependencies are ready
    // Decide whether to call app.listen: by default true, but tests should
    // avoid binding to the network to prevent EADDRINUSE when multiple
    // test workers import/start the server. The caller can override via
    // options.listen = true/false. We also auto-disable listening when
    // running under a test runner (NODE_ENV === 'test' or Vitest worker).
    const callerRequestedListen =
      options.listen !== undefined ? options.listen : true;
    const runningInTest =
      process.env.NODE_ENV === "test" || !!process.env.VITEST_WORKER_ID;
    const shouldListen = callerRequestedListen && !runningInTest;

    if (shouldListen) {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server listening on port ${PORT}`);
      });
    } else {
      console.log(
        `startServer: Skipping app.listen (shouldListen=${shouldListen}, NODE_ENV=${process.env.NODE_ENV})`
      );
      // If running in tests, reduce startup grace to allow health checks to
      // consider services ready immediately. This prevents test suites from
      // failing due to the initial grace period.
      if (runningInTest) {
        serviceState.startupTime = Date.now() - STARTUP_GRACE_PERIOD_MS - 1000;
      }
    }
  } catch (err) {
    console.error("Failed to start the server:", err);
    process.exit(1); // Exit if critical services fail to start
  }
}

// Start the application only when running this file directly.
if (require.main === module) {
  startServer();
}

// Export the Express app for programmatic use in tests
module.exports = app;
// Also expose startServer so tests can programmatically initialize DB/Puppeteer
module.exports.startServer = startServer;
// Export a wrapper for previewTemplate so the module can be imported before
// the previewTemplate binding is created during module evaluation in tests.
module.exports.previewTemplate = (content) => {
  // previewTemplate will be defined later in this module; evaluate at call time
  return typeof previewTemplate === "function" ? previewTemplate(content) : "";
};
// Expose browserInstance for graceful shutdown in tests/scripts (may be undefined)
Object.defineProperty(module.exports, "browser", {
  enumerable: true,
  get: () => browserInstance,
});

// Graceful startup configuration
const STARTUP_GRACE_PERIOD_MS = 30000; // 30 seconds grace period
const RETRY_DELAY_MS = 5000; // 5 seconds between retries

// Global service state management
const serviceState = {
  startupTime: Date.now(),
  puppeteer: {
    ready: false,
    transitioning: false,
    lastError: null,
    startupPhase: "initializing", // 'initializing' | 'connecting' | 'ready' | 'failed'
    retryCount: 0,
    lastRetryTime: null,
    successfulHealthChecks: 0,
  },
  db: {
    ready: false,
    lastError: null,
    startupPhase: "initializing",
  },
};

// Puppeteer global browser instance
let browserInstance;
const MAX_PUPPETEER_RESTARTS = 5;

async function startPuppeteer() {
  try {
    serviceState.puppeteer.transitioning = true;
    serviceState.puppeteer.startupPhase = "initializing";
    console.log(
      `[Puppeteer] Initialization attempt ${
        serviceState.puppeteer.retryCount + 1
      }/${MAX_PUPPETEER_RESTARTS}`
    );

    // Resolve Chrome executable path: prefer CHROME_PATH env var, then common system locations
    const preferredChrome = process.env.CHROME_PATH || process.env.CHROME_BIN;
    const possiblePaths = [
      preferredChrome,
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ].filter(Boolean);

    let executablePath;
    for (const p of possiblePaths) {
      try {
        if (p && fs.existsSync(p)) {
          executablePath = p;
          break;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!executablePath) {
      console.warn(
        `[Puppeteer] No system Chrome found in ${JSON.stringify(
          possiblePaths
        )}; falling back to Puppeteer's bundled Chromium if available.`
      );
    } else {
      console.log(`[Puppeteer] Using Chrome executable at: ${executablePath}`);
    }

    // Respect PUPPETEER_SKIP_CHROMIUM_DOWNLOAD during image build/install
    if (process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD === "true") {
      console.log(
        "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true - will not download bundled Chromium on install."
      );
    }

    browserInstance = await puppeteer.launch({
      ...(executablePath ? { executablePath } : {}),
      args: [
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
      ],
      timeout: 30000,
      ignoreHTTPSErrors: true,
      headless: "new", // use newer headless mode when supported
      defaultViewport: { width: 1280, height: 720 }, // Set default viewport
    });

    // Advanced browser health checks
    const testPage = await browserInstance.newPage();
    await testPage.goto("data:text/html,<h1>Health Check</h1>");
    if (testPage.isClosed()) {
      throw new Error("Health check page closed unexpectedly");
    }
    await testPage.close();

    // Update state variables post-success
    Object.assign(serviceState.puppeteer, {
      ready: true,
      transitioning: false,
      lastError: null,
      startupPhase: "ready",
      successfulHealthChecks: 0,
    });

    console.log("[Puppeteer] Initialization successful");

    // Enhanced disconnect handler with delay
    browserInstance.on("disconnected", async () => {
      console.error("[Puppeteer] Browser disconnected");
      Object.assign(serviceState.puppeteer, {
        ready: false,
        transitioning: true,
        startupPhase: "reconnecting",
        lastError: "Browser disconnected",
      });
      await delay(5000); // Add a delay before retry
      await attemptPuppeteerRestart();
    });
  } catch (err) {
    handlePuppeteerError(err);
  } finally {
    // Always cleanup residual state
    if (!serviceState.puppeteer.ready) {
      console.error("[Puppeteer] Cleanup incomplete state");
    }
  }
}

// Helper function for retry delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function handlePuppeteerError(err) {
  serviceState.puppeteer.ready = false;
  serviceState.puppeteer.transitioning = false;
  serviceState.puppeteer.lastError = err.message;
  serviceState.puppeteer.retryCount++;

  if (serviceState.puppeteer.retryCount < MAX_PUPPETEER_RESTARTS) {
    serviceState.puppeteer.startupPhase = "connecting";
    serviceState.puppeteer.lastRetryTime = Date.now();
    console.log(`[Puppeteer] Retrying in ${RETRY_DELAY_MS}ms...`);
    setTimeout(startPuppeteer, RETRY_DELAY_MS);
  } else {
    serviceState.puppeteer.startupPhase = "failed";
    console.error("[Puppeteer] Max retry attempts reached");
  }
}

function attemptPuppeteerRestart() {
  if (serviceState.puppeteer.retryCount < MAX_PUPPETEER_RESTARTS) {
    console.log("[Puppeteer] Attempting to restart Puppeteer...");
    startPuppeteer();
  } else {
    console.error(
      "Max Puppeteer restart attempts reached. Manual intervention required."
    );
  }
}

// Trust proxy for rate limiting
app.set("trust proxy", 1);

// Middleware
app.use(express.json());
app.use(morgan("dev"));
app.use(cors());
// Apply rate limiting, but allow a dev-only bypass via DISABLE_RATE_LIMIT=1
if (process.env.DISABLE_RATE_LIMIT === "1") {
  console.log("Rate limit disabled via DISABLE_RATE_LIMIT=1");
} else {
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
}

// Ensure logs directory exists
const logsDir = path.resolve(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir);
  } catch (e) {
    console.warn("Failed to create logs directory:", e.message);
  }
}

// Request ID middleware - help trace requests through proxies
app.use((req, res, next) => {
  try {
    req.id = uuidv4();
    res.setHeader("X-Request-Id", req.id);
    // Allow these headers to be visible to browser clients
    const existing = res.getHeader("Access-Control-Expose-Headers");
    const expose = existing
      ? `${existing},X-Request-Id,X-Backend-Error`
      : "X-Request-Id,X-Backend-Error";
    res.setHeader("Access-Control-Expose-Headers", expose);
  } catch (e) {
    // Don't block requests if UUID generation fails
  }
  next();
});

// Helper to check if we're still in grace period
function isInGracePeriod() {
  return Date.now() - serviceState.startupTime < STARTUP_GRACE_PERIOD_MS;
}

// Startup Readiness Probe Middleware
app.use((req, res, next) => {
  // Allow health check and root route to bypass readiness check
  if (req.path === "/health" || req.path === "/") {
    return next();
  }

  const timestamp = new Date().toISOString();

  // Check if service is transitioning
  if (serviceState.puppeteer.transitioning) {
    return res.status(503).json({
      status: "error",
      reason: "Service transitioning: Puppeteer is restarting",
      timestamp,
      details: {
        puppeteerError: serviceState.puppeteer.lastError,
      },
    });
  }

  // Check if service is ready
  if (!serviceState.puppeteer.ready || !browserInstance) {
    return res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Service not ready",
      puppeteer: serviceState.puppeteer.transitioning
        ? "initializing"
        : "failed",
    });
  }

  // If we reach here, services are ready
  next();
});

// Health endpoint
// Checks both SQLite3 and Puppeteer status
app.get("/health", async (req, res) => {
  try {
    const now = Date.now();
    const grace = isInGracePeriod();
    // Check Puppeteer readiness
    const puppeteerReady = serviceState.puppeteer.ready && browserInstance;
    // Check DB readiness
    const dbReady = serviceState.db.ready;

    // Run deeper health checks if not in grace period
    let puppeteerStatus = { ok: puppeteerReady, error: null };
    let dbStatus = { ok: dbReady, error: null };
    if (!grace) {
      [puppeteerStatus, dbStatus] = await Promise.all([
        checkPuppeteerHealth().catch((err) => ({
          ok: false,
          error: err.message,
        })),
        checkDatabaseHealth().catch((err) => ({
          ok: false,
          error: err.message,
        })),
      ]);
    }

    // Compose detailed health object
    const health = {
      status: grace
        ? "initializing"
        : puppeteerStatus.ok && dbStatus.ok
        ? "ok"
        : "error",
      timestamp: new Date().toISOString(),
      uptime: now - serviceState.startupTime,
      gracePeriod: grace,
      services: {
        puppeteer: {
          status: puppeteerStatus.ok ? "ok" : "error",
          phase: serviceState.puppeteer.startupPhase,
          error: puppeteerStatus.error || serviceState.puppeteer.lastError,
          healthChecks: serviceState.puppeteer.successfulHealthChecks,
          ready: serviceState.puppeteer.ready,
          transitioning: serviceState.puppeteer.transitioning,
          retryCount: serviceState.puppeteer.retryCount,
        },
        db: {
          status: dbStatus.ok ? "ok" : "error",
          error: dbStatus.error || serviceState.db.lastError,
          phase: serviceState.db.startupPhase,
          ready: serviceState.db.ready,
        },
      },
    };

    // Log health check details for diagnostics
    if (health.status !== "ok") {
      console.warn("[Health] Not ready:", JSON.stringify(health, null, 2));
    }

    if (health.status === "ok") {
      serviceState.puppeteer.successfulHealthChecks++;
      serviceState.db.ready = true;
      serviceState.db.lastError = null;
      return res.status(200).json(health);
    }

    // If not ready, return 503 with details
    res.status(503).json(health);
  } catch (error) {
    console.error("[Health Check Error]", error);
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        puppeteer: {
          status: "error",
          phase: serviceState.puppeteer.startupPhase,
          error: error.message,
        },
        db: {
          status: "error",
          phase: serviceState.db.startupPhase,
          error: error.message,
        },
      },
    });
  }
});

// Default route
app.get("/", (req, res) => {
  res.send("Hello, world! Your Express server is running.");
});

// Test error route
app.get("/test-error", (req, res, next) => {
  const err = new Error("Simulated error for testing");
  err.status = 418;
  next(err);
});

// Centralized error handler
app.use((err, req, res, next) => {
  // Log error details
  const timestamp = new Date().toISOString();
  const requestId = req && req.id ? req.id : "-";
  console.error("--- Error Handler ---");
  console.error("Time:", timestamp);
  console.error("RequestId:", requestId);
  console.error("Method:", req.method);
  console.error("URL:", req.originalUrl);
  console.error("Body:", req.body);
  console.error("Error Stack:", err.stack);

  // Append a compact structured error line to server-logs/errors.log for quick lookups
  try {
    const logLine = JSON.stringify({
      t: timestamp,
      id: requestId,
      method: req.method,
      url: req.originalUrl,
      status: err.status || 500,
      message: err.message,
      stack: err.stack ? err.stack.split("\n")[0] : null,
    });
    fs.appendFileSync(path.join(logsDir, "errors.log"), logLine + "\n");
  } catch (e) {
    console.warn("Failed to write error log:", e.message);
  }

  // Surface a short error header to aid proxied requests / reverse-proxies
  try {
    res.setHeader(
      "X-Backend-Error",
      err.message ? String(err.message).slice(0, 200) : "error"
    );
    res.setHeader("X-Request-Id", requestId);
  } catch (e) {}

  // Differentiate error response by environment
  const isDev = process.env.NODE_ENV !== "production";
  const payload = {
    error: isDev ? err.message : "Internal Server Error",
    requestId,
    ...(isDev && { stack: err.stack }),
  };
  res.status(err.status || 500).json(payload);
});

const crud = require("./crud");

// Ebook renderer helper
const { renderBookToPDF } = require("./ebook");
const { generateBackgroundForPoem } = require("./imageGenerator.cjs");

// --- PROMPT PROCESSING ENDPOINT ---
const { MockAIService } = require("./aiService");
const aiService = new MockAIService();

app.post("/prompt", async (req, res, next) => {
  const { prompt } = req.body;

  // Input validation with structured error
  if (typeof prompt !== "string" || !prompt.trim()) {
    return sendValidationError(
      res,
      "Prompt is required and must be a non-empty string",
      {
        provided: typeof prompt,
        required: "non-empty string",
      }
    );
  }

  try {
    // Use AI service abstraction with new content format
    const aiResponse = await aiService.generateContent(prompt);
    // Use Promise-style CRUD for clarity
    const dbResult = await crud.createPrompt(prompt);
    const aiResult = await crud.createAIResult(dbResult.id, aiResponse.content);

    res.status(201).json({
      success: true,
      data: {
        ...aiResponse,
        promptId: dbResult.id,
        resultId: aiResult.id,
      },
    });
  } catch (err) {
    // Enhanced AI service error handling
    err.status = err.status || 500;
    err.message = `AI Service Error: ${err.message}`;
    next(err);
  }
});

// --- PREVIEW ENDPOINT ---
// Import error handling utilities
const { sendValidationError } = require("./utils/errorHandler");

const previewTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    .preview { max-width: 800px; margin: 2rem auto; font-family: system-ui; }
    .preview h1 { color: #2c3e50; }
    .preview .content { line-height: 1.6; }
  </style>
</head>
<body>
  <div class="preview">
    <h1>${content.title}</h1>
    <div class="content">${content.body}</div>
  </div>
</body>
</html>
`;

app.get("/preview", (req, res) => {
  const { content } = req.query;

  // Validate required parameter
  if (!content) {
    return sendValidationError(res, "Content parameter is required");
  }

  try {
    let contentObj = JSON.parse(content);

    // Support legacy envelope: { content: { title, body } }
    if (contentObj && typeof contentObj === "object" && contentObj.content) {
      contentObj = contentObj.content;
    }

    // Validate content structure
    if (!contentObj || !contentObj.title || !contentObj.body) {
      return sendValidationError(res, "Content must include title and body", {
        provided:
          contentObj && typeof contentObj === "object"
            ? Object.keys(contentObj)
            : typeof contentObj,
      });
    }

    res.send(previewTemplate(contentObj));
  } catch (err) {
    sendValidationError(res, "Invalid content format", { error: err.message });
  }
});

// Backwards-compatible API route to accept JSON body for preview requests
app.post("/api/preview", (req, res) => {
  const content = req.body && (req.body.content || req.body);

  // Validate required parameter
  if (!content) {
    return sendValidationError(res, "Content parameter is required", {
      provided: typeof req.body,
      required: "object with content or direct content",
    });
  }

  try {
    const contentObj =
      typeof content === "string" ? JSON.parse(content) : content;

    // Validate content structure
    if (!contentObj.title || !contentObj.body) {
      return sendValidationError(res, "Content must include title and body", {
        provided: Object.keys(contentObj),
      });
    }

    res.json({ preview: previewTemplate(contentObj), metadata: {} });
  } catch (err) {
    sendValidationError(res, "Invalid content format", { error: err.message });
  }
});

// --- OVERRIDE ENDPOINT ---
app.post("/override", (req, res) => {
  const { content, changes } = req.body;

  // Enhanced input validation
  if (!content) {
    return sendValidationError(res, "Content is required", {
      provided: typeof content,
      required: "object",
    });
  }

  if (!changes) {
    return sendValidationError(res, "Changes are required", {
      provided: typeof changes,
      required: "object",
    });
  }

  if (typeof content !== "object" || content === null) {
    return sendValidationError(res, "Content must be an object", {
      provided: content === null ? "null" : typeof content,
      required: "object",
    });
  }

  try {
    const updated = { ...content, ...changes };
    res.status(200).json({
      success: true,
      data: {
        content: updated,
      },
    });
  } catch (err) {
    sendValidationError(res, "Failed to update content", {
      error: err.message,
    });
  }
});

// --- PDF EXPORT ENDPOINT ---
// Backwards-compatible export endpoint: accept GET with query or POST with JSON body
app.post("/api/export", async (req, res, next) => {
  const fs = require("fs");
  const path = require("path");
  const {
    sendValidationError,
    sendProcessingError,
    sendServiceUnavailableError,
  } = require("./utils/errorHandler");

  const { title, body } = req.body || {};
  if (!title || !body) {
    return sendValidationError(res, "Content must include title and body", {
      provided: Object.keys(req.body || {}),
      required: ["title", "body"],
    });
  }

  // Use the same synchronous fallback logic as the GET /export route
  let page;
  try {
    if (!serviceState.puppeteer.ready || !browserInstance) {
      return sendServiceUnavailableError(
        res,
        "PDF generation service not ready",
        {
          code: "SERVICE_UNAVAILABLE",
        }
      );
    }

    page = await browserInstance.newPage();
    if (!page) throw new Error("Failed to create browser page");

    const contentObj = { title, body };
    await page.setContent(previewTemplate(contentObj));

    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });

    // Successful binary response; keep binary behaviour for clients
    res.setHeader("Content-Disposition", `inline; filename=export.pdf`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", pdfBuffer.length);
    res.end(pdfBuffer);
    return;
  } catch (err) {
    console.error("Export generation error", err);
    // Use standardized processing error payload
    return sendProcessingError(res, `PDF Generation Failed: ${err.message}`, {
      code: "PDF_GENERATION_ERROR",
    });
  } finally {
    if (page) await page.close();
  }
});

// Backwards-compatible POST /export for legacy clients that post to /export
app.post("/export", async (req, res, next) => {
  const {
    sendValidationError,
    sendProcessingError,
    sendServiceUnavailableError,
  } = require("./utils/errorHandler");

  const { title, body } = req.body || {};
  if (!title || !body) {
    return sendValidationError(res, "Content must include title and body", {
      provided: Object.keys(req.body || {}),
      required: ["title", "body"],
    });
  }

  let page;
  try {
    if (!serviceState.puppeteer.ready || !browserInstance) {
      return sendServiceUnavailableError(
        res,
        "PDF generation service not ready",
        {
          code: "SERVICE_UNAVAILABLE",
        }
      );
    }

    page = await browserInstance.newPage();
    if (!page) throw new Error("Failed to create browser page");

    const contentObj = { title, body };
    await page.setContent(previewTemplate(contentObj));

    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });

    res.setHeader("Content-Disposition", `inline; filename=export.pdf`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", pdfBuffer.length);
    res.end(pdfBuffer);
    return;
  } catch (err) {
    console.error("Export generation error", err);
    return sendProcessingError(res, `PDF Generation Failed: ${err.message}`, {
      code: "PDF_GENERATION_ERROR",
    });
  } finally {
    if (page) await page.close();
  }
});

// Maintain existing GET /export behaviour for legacy clients (keeps file save path)
app.get("/export", async (req, res) => {
  // Backwards-compatible GET /export that accepts ?content=<json>
  // Harmonized to use the standardized error response helpers and
  // to return binary PDF with proper headers.
  const { content } = req.query;
  const {
    sendValidationError,
    sendProcessingError,
    sendServiceUnavailableError,
  } = require("./utils/errorHandler");

  if (!content) {
    return sendValidationError(res, "Content parameter is required");
  }

  let page;
  try {
    const contentObj = JSON.parse(content);

    if (!serviceState.puppeteer.ready || !browserInstance) {
      return sendServiceUnavailableError(
        res,
        "PDF generation service not ready",
        { code: "SERVICE_UNAVAILABLE" }
      );
    }

    page = await browserInstance.newPage();
    if (!page) throw new Error("Failed to create browser page");

    await page.setContent(previewTemplate(contentObj));
    const pdf = await page.pdf({ format: "A4", printBackground: true });

    // Set headers to match POST export endpoints
    res.setHeader("Content-Disposition", `inline; filename=export.pdf`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
    return;
  } catch (err) {
    console.error("Export generation error (GET /export)", err);
    return sendProcessingError(res, `PDF Generation Failed: ${err.message}`, {
      code: "PDF_GENERATION_ERROR",
    });
  } finally {
    if (page) await page.close();
  }
});

// --- PROMPTS CRUD API ---
app.post("/api/prompts", (req, res, next) => {
  const { prompt } = req.body;

  // Input validation with structured error
  if (typeof prompt !== "string" || !prompt.trim()) {
    return sendValidationError(
      res,
      "Prompt is required and must be a non-empty string",
      {
        provided: typeof prompt,
        required: "non-empty string",
        received: prompt,
      }
    );
  }

  (async () => {
    try {
      const result = await crud.createPrompt(prompt);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT") {
        err.status = 409;
        err.message = "Duplicate prompt not allowed";
      } else {
        err.status = 500;
        err.message = "Failed to create prompt";
      }
      next(err);
    }
  })();
});

app.get("/api/prompts", (req, res, next) => {
  // Parse pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Validate pagination parameters
  if (page < 1 || limit < 1) {
    return sendValidationError(res, "Invalid pagination parameters", {
      provided: { page, limit },
      required: "positive integers",
      details: "Page and limit must be greater than 0",
    });
  }

  // Calculate offset
  const offset = (page - 1) * limit;

  (async () => {
    try {
      const rows = await crud.getPrompts();
      if (!rows || rows.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, pages: 0 },
        });
      }
      const total = rows.length;
      const pages = Math.ceil(total / limit);
      const paginatedRows = rows.slice(offset, offset + limit);
      res.status(200).json({
        success: true,
        data: paginatedRows,
        pagination: { page, limit, total, pages },
      });
    } catch (err) {
      err.status = 500;
      err.message = "Failed to retrieve prompts";
      next(err);
    }
  })();
});

app.get("/api/prompts/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid prompt ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "Prompt ID must be a positive integer",
    });
  }

  (async () => {
    try {
      const row = await crud.getPromptById(id);
      if (!row) {
        return res.status(404).json({
          success: false,
          error: {
            message: "Prompt not found",
            code: "RESOURCE_NOT_FOUND",
            status: 404,
            details: { id },
          },
        });
      }
      res.status(200).json({ success: true, data: row });
    } catch (err) {
      err.status = 500;
      err.message = "Failed to retrieve prompt";
      next(err);
    }
  })();
});

app.put("/api/prompts/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid prompt ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "Prompt ID must be a positive integer",
    });
  }

  // Validate prompt in request body
  const { prompt } = req.body;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return sendValidationError(
      res,
      "Prompt is required and must be a non-empty string",
      {
        provided: typeof prompt,
        required: "non-empty string",
        received: prompt,
      }
    );
  }

  (async () => {
    try {
      const result = await crud.updatePrompt(id, prompt);
      if (!result || result.changes === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: "Prompt not found",
            code: "RESOURCE_NOT_FOUND",
            status: 404,
            details: { id },
          },
        });
      }
      res.status(200).json({
        success: true,
        data: { id, prompt, updated_at: new Date().toISOString() },
        changes: result.changes,
      });
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT") {
        err.status = 409;
        err.message = "Duplicate prompt not allowed";
      } else {
        err.status = 500;
        err.message = "Failed to update prompt";
      }
      next(err);
    }
  })();
});

app.delete("/api/prompts/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid prompt ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "Prompt ID must be a positive integer",
    });
  }

  (async () => {
    try {
      const result = await crud.deletePrompt(id);
      if (!result || result.changes === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: "Prompt not found",
            code: "RESOURCE_NOT_FOUND",
            status: 404,
            details: { id },
          },
        });
      }
      res.status(200).json({
        success: true,
        data: {
          message: "Prompt deleted successfully",
          id,
          deleted_at: new Date().toISOString(),
        },
        changes: result.changes,
      });
    } catch (err) {
      if (err.code === "SQLITE_FOREIGN_KEY") {
        err.status = 409;
        err.message = "Cannot delete prompt: It is referenced by other records";
      } else {
        err.status = 500;
        err.message = "Failed to delete prompt";
      }
      next(err);
    }
  })();
});

// --- AI_RESULTS CRUD API ---
app.post("/api/ai_results", (req, res, next) => {
  const { prompt_id, result } = req.body;

  // Validate prompt_id
  if (!Number.isInteger(prompt_id) || prompt_id < 1) {
    return sendValidationError(res, "prompt_id must be a positive integer", {
      provided: typeof prompt_id === "number" ? prompt_id : typeof prompt_id,
      required: "positive integer",
      details: "prompt_id must be a valid prompt reference",
    });
  }

  // Validate result object
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return sendValidationError(res, "result must be a valid object", {
      provided: Array.isArray(result) ? "array" : typeof result,
      required: "object",
      details: "result must contain the AI generation output",
    });
  }

  // Validate required result properties
  const requiredProps = ["content", "metadata"];
  const missingProps = requiredProps.filter((prop) => !(prop in result));
  if (missingProps.length > 0) {
    return sendValidationError(res, "Missing required properties in result", {
      missing: missingProps,
      required: requiredProps,
      provided: Object.keys(result),
    });
  }

  (async () => {
    try {
      const resultObj = await crud.createAIResult(prompt_id, result);
      res.status(201).json({
        success: true,
        data: { ...resultObj, created_at: new Date().toISOString() },
      });
    } catch (err) {
      if (err.code === "SQLITE_FOREIGN_KEY") {
        err.status = 404;
        err.message = "Referenced prompt not found";
      } else if (err.code === "SQLITE_CONSTRAINT") {
        err.status = 409;
        err.message = "Duplicate AI result not allowed";
      } else {
        err.status = 500;
        err.message = "Failed to create AI result";
      }
      next(err);
    }
  })();
});

app.get("/api/ai_results", (req, res, next) => {
  // Parse and validate pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const prompt_id = req.query.prompt_id ? parseInt(req.query.prompt_id) : null;

  // Validate pagination parameters
  if (page < 1 || limit < 1) {
    return sendValidationError(res, "Invalid pagination parameters", {
      provided: { page, limit },
      required: "positive integers",
      details: "Page and limit must be greater than 0",
    });
  }

  // Validate prompt_id if provided
  if (prompt_id !== null && (isNaN(prompt_id) || prompt_id < 1)) {
    return sendValidationError(res, "Invalid prompt_id filter", {
      provided: req.query.prompt_id,
      required: "positive integer",
      details: "prompt_id must be a positive integer",
    });
  }

  // Calculate offset
  const offset = (page - 1) * limit;

  (async () => {
    try {
      const rows = await crud.getAIResults();
      let filteredRows = rows;
      if (prompt_id)
        filteredRows = rows.filter((row) => row.prompt_id === prompt_id);
      if (!filteredRows || filteredRows.length === 0)
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, pages: 0 },
        });
      const total = filteredRows.length;
      const pages = Math.ceil(total / limit);
      const paginatedRows = filteredRows.slice(offset, offset + limit);
      res.status(200).json({
        success: true,
        data: paginatedRows,
        pagination: {
          page,
          limit,
          total,
          pages,
          prompt_id: prompt_id || undefined,
        },
      });
    } catch (err) {
      err.status = 500;
      err.message = "Failed to retrieve AI results";
      next(err);
    }
  })();
});

app.get("/api/ai_results/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid AI result ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "AI result ID must be a positive integer",
    });
  }

  (async () => {
    try {
      const row = await crud.getAIResultById(id);
      if (!row)
        return res.status(404).json({
          success: false,
          error: {
            message: "AI result not found",
            code: "RESOURCE_NOT_FOUND",
            status: 404,
            details: { id },
          },
        });
      res.status(200).json({
        success: true,
        data: {
          ...row,
          result:
            typeof row.result === "string"
              ? JSON.parse(row.result)
              : row.result,
        },
      });
    } catch (err) {
      err.status = 500;
      err.message = "Failed to retrieve AI result";
      next(err);
    }
  })();
});

app.put("/api/ai_results/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid AI result ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "AI result ID must be a positive integer",
    });
  }

  // Validate result object
  const { result } = req.body;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return sendValidationError(res, "result must be a valid object", {
      provided: Array.isArray(result) ? "array" : typeof result,
      required: "object",
      details: "result must contain the AI generation output",
    });
  }

  // Validate required result properties
  const requiredProps = ["content", "metadata"];
  const missingProps = requiredProps.filter((prop) => !(prop in result));
  if (missingProps.length > 0) {
    return sendValidationError(res, "Missing required properties in result", {
      missing: missingProps,
      required: requiredProps,
      provided: Object.keys(result),
    });
  }

  (async () => {
    try {
      const resultObj = await crud.updateAIResult(id, result);
      if (!resultObj || resultObj.changes === 0)
        return res.status(404).json({
          success: false,
          error: {
            message: "AI result not found",
            code: "RESOURCE_NOT_FOUND",
            status: 404,
            details: { id },
          },
        });
      res.status(200).json({
        success: true,
        data: { id, result, updated_at: new Date().toISOString() },
      });
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT") {
        err.status = 409;
        err.message = "Constraint violation in update";
      } else {
        err.status = 500;
        err.message = "Failed to update AI result";
      }
      next(err);
    }
  })();
});

app.delete("/api/ai_results/:id", (req, res, next) => {
  // Validate ID parameter
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid AI result ID", {
      provided: req.params.id,
      required: "positive integer",
      details: "AI result ID must be a positive integer",
    });
  }

  (async () => {
    try {
      const resultObj = await crud.deleteAIResult(id);
      if (!resultObj || resultObj.changes === 0)
        return res.status(404).json({
          success: false,
          error: {
            message: "AI result not found",
            code: "RESOURCE_NOT_FOUND",
            status: 404,
            details: { id },
          },
        });
      res.status(200).json({
        success: true,
        data: {
          message: "AI result deleted successfully",
          id,
          deleted_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      if (err.code === "SQLITE_FOREIGN_KEY") {
        err.status = 409;
        err.message =
          "Cannot delete AI result: It is referenced by other records";
      } else {
        err.status = 500;
        err.message = "Failed to delete AI result";
      }
      next(err);
    }
  })();
});

// --- OVERRIDES CRUD API ---
app.post("/api/overrides", (req, res, next) => {
  const { ai_result_id, override } = req.body;

  // Validate ai_result_id
  if (!Number.isInteger(ai_result_id) || ai_result_id < 1) {
    return sendValidationError(res, "ai_result_id must be a positive integer", {
      provided:
        typeof ai_result_id === "number" ? ai_result_id : typeof ai_result_id,
      required: "positive integer",
    });
  }

  // Validate override object
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return sendValidationError(res, "override must be a valid object", {
      provided: Array.isArray(override) ? "array" : typeof override,
      required: "object",
    });
  }

  (async () => {
    try {
      const result = await crud.createOverride(ai_result_id, override);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      if (err.code === "SQLITE_FOREIGN_KEY") {
        err.status = 404;
        err.message = "Referenced AI result not found";
      } else {
        err.status = 500;
        err.message = "Failed to create override";
      }
      next(err);
    }
  })();
});

app.get("/api/overrides", (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1 || limit < 1) {
    return sendValidationError(res, "Invalid pagination parameters", {
      provided: { page, limit },
      required: "positive integers",
    });
  }

  const offset = (page - 1) * limit;

  crud.getOverrides((err, rows) => {
    if (err) {
      err.status = 500;
      err.message = "Failed to retrieve overrides";
      return next(err);
    }

    if (!rows || rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, pages: 0 },
      });
    }

    const total = rows.length;
    const pages = Math.ceil(total / limit);
    const paginatedRows = rows.slice(offset, offset + limit);

    res.status(200).json({
      success: true,
      data: paginatedRows,
      pagination: { page, limit, total, pages },
    });
  });
  (async () => {
    try {
      const rows = await crud.getOverrides();
      if (!rows || rows.length === 0)
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, pages: 0 },
        });
      const total = rows.length;
      const pages = Math.ceil(total / limit);
      const paginatedRows = rows.slice(offset, offset + limit);
      res.status(200).json({
        success: true,
        data: paginatedRows,
        pagination: { page, limit, total, pages },
      });
    } catch (err) {
      err.status = 500;
      err.message = "Failed to retrieve overrides";
      next(err);
    }
  })();
});

app.get("/api/overrides/:id", (req, res, next) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid override ID", {
      provided: req.params.id,
      required: "positive integer",
    });
  }

  crud.getOverrideById(id, (err, row) => {
    if (err) {
      err.status = 500;
      err.message = "Failed to retrieve override";
      return next(err);
    }
    if (!row) {
      return res.status(404).json({
        success: false,
        error: { message: "Override not found", code: "RESOURCE_NOT_FOUND" },
      });
    }
    res.status(200).json({ success: true, data: row });
  });
});

app.put("/api/overrides/:id", (req, res, next) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid override ID", {
      provided: req.params.id,
      required: "positive integer",
    });
  }

  const { override } = req.body;
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return sendValidationError(res, "override must be a valid object", {
      provided: Array.isArray(override) ? "array" : typeof override,
      required: "object",
    });
  }

  crud.updateOverride(id, override, (err, result) => {
    if (err) {
      err.status = 500;
      err.message = "Failed to update override";
      return next(err);
    }
    if (!result || result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: { message: "Override not found", code: "RESOURCE_NOT_FOUND" },
      });
    }
    res.status(200).json({
      success: true,
      data: { id, ...override },
    });
  });
});

app.delete("/api/overrides/:id", (req, res, next) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid override ID", {
      provided: req.params.id,
      required: "positive integer",
    });
  }

  crud.deleteOverride(id, (err, result) => {
    if (err) {
      err.status = 500;
      err.message = "Failed to delete override";
      return next(err);
    }
    if (!result || result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: { message: "Override not found", code: "RESOURCE_NOT_FOUND" },
      });
    }
    res.status(200).json({
      success: true,
      data: { message: "Override deleted successfully" },
    });
  });
});

// --- PDF_EXPORTS CRUD API ---
app.post("/api/pdf_exports", (req, res, next) => {
  const { ai_result_id, file_path } = req.body;

  if (!Number.isInteger(ai_result_id) || ai_result_id < 1) {
    return sendValidationError(res, "ai_result_id must be a positive integer", {
      provided: ai_result_id,
      required: "positive integer",
    });
  }

  if (typeof file_path !== "string" || !file_path.trim()) {
    return sendValidationError(res, "file_path is required", {
      provided: file_path,
      required: "non-empty string",
    });
  }

  (async () => {
    try {
      const result = await crud.createPDFExport(ai_result_id, file_path);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      if (err.code === "SQLITE_FOREIGN_KEY") {
        err.status = 404;
        err.message = "Referenced AI result not found";
      } else {
        err.status = 500;
        err.message = "Failed to create PDF export record";
      }
      next(err);
    }
  })();
});

app.get("/api/pdf_exports", (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1 || limit < 1) {
    return sendValidationError(res, "Invalid pagination parameters", {
      provided: { page, limit },
      required: "positive integers",
    });
  }

  const offset = (page - 1) * limit;

  (async () => {
    try {
      const rows = await crud.getPDFExports();
      if (!rows || rows.length === 0)
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, pages: 0 },
        });
      const total = rows.length;
      const pages = Math.ceil(total / limit);
      const paginatedRows = rows.slice(offset, offset + limit);
      res.status(200).json({
        success: true,
        data: paginatedRows,
        pagination: { page, limit, total, pages },
      });
    } catch (err) {
      err.status = 500;
      err.message = "Failed to retrieve PDF exports";
      next(err);
    }
  })();
});

app.get("/api/pdf_exports/:id", (req, res, next) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid PDF export ID", {
      provided: req.params.id,
      required: "positive integer",
    });
  }

  (async () => {
    try {
      const row = await crud.getPDFExportById(id);
      if (!row)
        return res.status(404).json({
          success: false,
          error: {
            message: "PDF export not found",
            code: "RESOURCE_NOT_FOUND",
          },
        });
      res.status(200).json({ success: true, data: row });
    } catch (err) {
      err.status = 500;
      err.message = "Failed to retrieve PDF export";
      next(err);
    }
  })();
});

// --- MULTI-POEM EBOOK EXPORT FOR SMOKE TESTS ---
app.post("/api/export/book", async (req, res) => {
  // Accept body with { poems: [...] } or load sample file if empty
  let poems = null;
  try {
    poems = req.body && req.body.poems ? req.body.poems : null;
  } catch (e) {
    poems = null;
  }

  if (!poems) {
    // Try loading sample dataset from server/samples/poems.json
    try {
      const samplePath = path.resolve(__dirname, "samples", "poems.json");
      const raw = fs.readFileSync(samplePath, "utf8");
      const parsed = JSON.parse(raw);
      // Support shapes:
      //  - { poems: [...] }
      //  - [ { poems: [...] } ] (array wrapping)
      //  - direct array of poem objects
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].poems) {
        poems = parsed[0].poems;
      } else {
        poems = parsed && parsed.poems ? parsed.poems : parsed;
      }
    } catch (err) {
      console.error("Failed to load sample poems:", err.message);
      return res
        .status(400)
        .json({ error: "No poems provided and sample not available" });
    }
  }

  if (!serviceState.puppeteer.ready || !browserInstance) {
    return res.status(503).json({ error: "PDF generation service not ready" });
  }

  try {
    // Ensure each poem has a background image; generate offline stub if missing
    for (let p of poems) {
      if (!p.background) {
        const generated = generateBackgroundForPoem(p);
        if (generated) p.background = generated;
      }
    }

    const pdf = await renderBookToPDF(poems, browserInstance);
    res.setHeader("Content-Disposition", "inline; filename=ebook.pdf");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
  } catch (err) {
    console.error("Ebook export error:", err);
    res
      .status(500)
      .json({ error: "Failed to generate ebook", details: err.message });
  }
});

// --- Background export job API (SQLite-backed with in-memory fallback) ---
let jobsModule = null;
try {
  jobsModule = require("./jobs");
} catch (e) {
  console.warn(
    "jobs module not available, will use in-memory fallback",
    e.message
  );
}

const exportJobs = {}; // fallback in-memory jobs

app.post("/api/export/job", async (req, res) => {
  const payload = req.body && Object.keys(req.body).length ? req.body : null;

  // Primary path: try to enqueue in SQLite-backed jobs table
  if (jobsModule) {
    try {
      // Prefer explicit DB path when provided (tests set JOBS_DB), otherwise use server default
      const dbPath =
        process.env.JOBS_DB ||
        path.join(process.cwd(), "data", "your-database-name.db");
      const db = await jobsModule.openJobsDb(dbPath);
      try {
        const id = await jobsModule.enqueueJob(db, payload);
        await db.close();
        // Respond with DB id
        res.status(202).json({ jobId: String(id) });
        return;
      } catch (e) {
        // ensure DB closed on error
        try {
          await db.close();
        } catch (ee) {}
        console.warn(
          "jobs.enqueueJob failed, falling back to in-memory",
          e && e.message ? e.message : e
        );
      }
    } catch (e) {
      console.warn(
        "jobs DB open failed, falling back to in-memory",
        e && e.message ? e.message : e
      );
    }
  }

  // Fallback: in-memory behavior (existing logic)
  const jobId = uuidv4();
  exportJobs[jobId] = { state: "queued", progress: 0 };

  (async () => {
    try {
      exportJobs[jobId].state = "preparing";
      exportJobs[jobId].progress = 10;

      let poems = payload && payload.poems ? payload.poems : null;
      if (!poems) {
        const samplePath = path.resolve(__dirname, "samples", "poems.json");
        const raw = fs.readFileSync(samplePath, "utf8");
        const parsed = JSON.parse(raw);
        poems =
          Array.isArray(parsed) && parsed.length > 0 && parsed[0].poems
            ? parsed[0].poems
            : parsed && parsed.poems
            ? parsed.poems
            : parsed;
      }

      const { generateImages } = payload || {};
      if (generateImages) {
        const { generatePoemAndImage } = require("./imageGenerator.cjs");
        let i = 0;
        for (let p of poems) {
          exportJobs[jobId].state = "generating_images";
          exportJobs[jobId].progress = 10 + Math.round((i / poems.length) * 30);
          try {
            const result = await generatePoemAndImage({
              theme: p.title || p.theme,
            });
            if (result && result.image) p.background = result.image;
          } catch (e) {
            console.warn("Image generation failed for poem", i, e.message || e);
          }
          i++;
        }
      } else {
        for (let p of poems) {
          if (!p.background) {
            const generated = generateBackgroundForPoem(p);
            if (generated) p.background = generated;
          }
        }
      }

      exportJobs[jobId].state = "composing";
      exportJobs[jobId].progress = 50;

      const pdf = await renderBookToPDF(poems, browserInstance);

      exportJobs[jobId].state = "saving";
      exportJobs[jobId].progress = 85;

      const outDir = path.resolve(__dirname, "samples", "exports");
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, `ebook_${jobId}.pdf`);
      fs.writeFileSync(outPath, pdf);

      exportJobs[jobId].state = "done";
      exportJobs[jobId].progress = 100;
      exportJobs[jobId].filePath = outPath;
    } catch (err) {
      exportJobs[jobId].state = "error";
      exportJobs[jobId].error = err && err.message ? err.message : String(err);
      exportJobs[jobId].progress = 0;
      console.error("Export job failed", jobId, err);
    }
  })();

  res.status(202).json({ jobId });
});

app.get("/api/export/job/:id", async (req, res) => {
  const id = req.params.id;
  // Try DB lookup first
  if (jobsModule) {
    try {
      const row = await jobsModule.getJob(id);
      if (row) return res.json({ jobId: id, ...row });
    } catch (e) {
      console.warn("jobs.getJob failed", e.message);
    }
  }

  const job = exportJobs[id];
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({ jobId: id, ...job });
});

// --- Synchronous poem->image generation endpoint ---
app.post("/api/generate/poem-image", async (req, res) => {
  const { theme, format } = req.body || {};
  try {
    // lazy-load to avoid cycles during startup
    const { generatePoemAndImage } = require("./imageGenerator.cjs");
    const result = await generatePoemAndImage({ theme, format });
    res.status(200).json({ success: true, result });
  } catch (e) {
    console.error(
      "/api/generate/poem-image error",
      e && e.message ? e.message : e
    );
    res
      .status(500)
      .json({ success: false, error: e && e.message ? e.message : String(e) });
  }
});

app.put("/api/pdf_exports/:id", (req, res, next) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid PDF export ID", {
      provided: req.params.id,
      required: "positive integer",
    });
  }

  const { file_path } = req.body;
  if (typeof file_path !== "string" || !file_path.trim()) {
    return sendValidationError(res, "file_path is required", {
      provided: file_path,
      required: "non-empty string",
    });
  }

  (async () => {
    try {
      const result = await crud.updatePDFExport(id, file_path);
      if (!result || result.changes === 0)
        return res.status(404).json({
          success: false,
          error: {
            message: "PDF export not found",
            code: "RESOURCE_NOT_FOUND",
          },
        });
      res.status(200).json({ success: true, data: { id, file_path } });
    } catch (err) {
      err.status = 500;
      err.message = "Failed to update PDF export";
      next(err);
    }
  })();
});

app.delete("/api/pdf_exports/:id", (req, res, next) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    return sendValidationError(res, "Invalid PDF export ID", {
      provided: req.params.id,
      required: "positive integer",
    });
  }

  (async () => {
    try {
      const result = await crud.deletePDFExport(id);
      if (!result || result.changes === 0)
        return res.status(404).json({
          success: false,
          error: {
            message: "PDF export not found",
            code: "RESOURCE_NOT_FOUND",
          },
        });
      res.status(200).json({
        success: true,
        data: { message: "PDF export deleted successfully" },
      });
    } catch (err) {
      err.status = 500;
      err.message = "Failed to delete PDF export";
      next(err);
    }
  })();
});

// --- HEALTH AND UTILITY FUNCTIONS ---

const HEALTH_CHECK_TIMEOUT_MS = 5000; // 5 seconds

// Utility to add a timeout to any promise
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Operation timed out"));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function checkPuppeteerHealth() {
  if (!browserInstance || !serviceState.puppeteer.ready) {
    return {
      ok: false,
      error: "Puppeteer instance not available or not ready.",
    };
  }
  try {
    await withTimeout(
      (async () => {
        const page = await browserInstance.newPage();
        await page.close();
      })(),
      HEALTH_CHECK_TIMEOUT_MS
    );
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function checkDatabaseHealth() {
  try {
    // db.get returns a promise, so we await it.
    await db.get("SELECT 1");
    return { ok: true, error: null };
  } catch (err) {
    // If the promise rejects, we catch the error.
    return { ok: false, error: err.message };
  }
}

// Graceful shutdown: clear jobs recovery timer and close jobs DB if open
async function gracefulShutdown(signal) {
  console.log("Graceful shutdown:", signal || "exit");
  try {
    if (module.exports._jobsRecoveryTimer) {
      clearInterval(module.exports._jobsRecoveryTimer);
      module.exports._jobsRecoveryTimer = null;
    }
    if (module.exports._jobsDb) {
      try {
        await module.exports._jobsDb.close();
        console.log("Jobs DB closed");
      } catch (e) {
        console.warn(
          "Error closing jobs DB during shutdown",
          e && e.message ? e.message : e
        );
      }
      module.exports._jobsDb = null;
    }
  } catch (e) {
    console.warn(
      "Error during graceful shutdown",
      e && e.message ? e.message : e
    );
  }
  // allow other listeners to run then exit
  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
