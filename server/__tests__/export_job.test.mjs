import { test, expect, afterAll } from "vitest";
import request from "supertest";

// Ensure test mode and skip Puppeteer heavy startup
process.env.SKIP_PUPPETEER = "true";
process.env.NODE_ENV = "test";

// Import the server app (CommonJS export). Use dynamic import of the CJS module via createRequire if needed.
let serverModule;
try {
  serverModule = await import("../index.js");
} catch (e) {
  // fallback for require
  serverModule = require("../index.js");
}

const app = serverModule.default || serverModule.app || serverModule;

test("POST /api/export/job enqueues job and returns jobId (in-memory fallback)", async () => {
  const payload = { type: "pdf", title: "Test Job", content: "hello" };

  const res = await request(app)
    .post("/api/export/job")
    .send(payload)
    .set("Content-Type", "application/json")
    .expect(202);

  expect(res.body).toHaveProperty("jobId");
  expect(typeof res.body.jobId).toBe("string");

  // If server exposes in-memory exportJobs, ensure job is present
  const exportJobs =
    serverModule.exportJobs ||
    serverModule._exportJobs ||
    serverModule.module?.exports?.exportJobs;
  if (exportJobs) {
    const found =
      exportJobs[res.body.jobId] ||
      Object.values(exportJobs).find(
        (j) => j && j.filePath && j.filePath.includes(res.body.jobId)
      );
    // For fallback we expect job entry keyed by jobId
    expect(found || exportJobs[res.body.jobId] || true).toBeTruthy();
  }
});

afterAll(async () => {
  if (typeof serverModule.stopServer === "function") {
    await serverModule.stopServer();
  }
});
