import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
import { openJobsDb, enqueueJob, claimNextJob } from "../jobs.js";

describe("jobs.startup_requeue_integration", () => {
  it("requeues stale processing jobs on server start", async () => {
    const dbPath = path.join(os.tmpdir(), `jobs-requeue-int-${Date.now()}.db`);

    // Seed a stale processing job
    const db = await openJobsDb(dbPath);
    const id = await enqueueJob(db, { type: "startup-int" });
    const claimed = await claimNextJob(db, "integration-tester");
    expect(claimed).toBeTruthy();
    const old = Date.now() - 1000 * 60 * 60;
    await db.run("UPDATE jobs SET locked_at = ? WHERE id = ?", old, id);
    await db.close();

    // Set env to use this DB and skip Puppeteer for fast, deterministic startup
    process.env.JOBS_DB = dbPath;
    process.env.SKIP_PUPPETEER = "true";
    process.env.NODE_ENV = "test";

    // Require and start server programmatically (CommonJS require)
    const require = createRequire(import.meta.url);
    const server = require("../index.js");
    await server.startServer({ listen: false });

    // Confirm job state is queued after startup recovery
    const db2 = await openJobsDb(dbPath);
    const row = await db2.get("SELECT * FROM jobs WHERE id = ?", id);
    expect(row.state).toBe("queued");

    // Cleanup: clear recovery timer and close DB
    try {
      if (server._jobsRecoveryTimer) clearInterval(server._jobsRecoveryTimer);
    } catch (e) {}
    try {
      if (server._jobsDb && server._jobsDb.close) await server._jobsDb.close();
    } catch (e) {}
    try {
      await db2.close();
    } catch (e) {}
    try {
      fs.unlinkSync(dbPath);
    } catch (e) {}
  }, 20000);
});
