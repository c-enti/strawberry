import { describe, it, expect } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { openJobsDb, enqueueJob, getJob } from "../jobs.js";
import { startWorker } from "../worker-sqlite.mjs";

describe("worker-sqlite", () => {
  it("processes a queued job and finalizes it", async () => {
    const dbPath = path.join(os.tmpdir(), `worker-test-${Date.now()}.db`);
    const db = await openJobsDb(dbPath);
    const payload = { type: "export", bookId: 42 };
    const id = await enqueueJob(db, payload);
    expect(typeof id).toBe("number");

    // Run the worker once to process the job
    await startWorker({ dbPath, runOnce: true, workerId: "test-worker" });

    // Re-open DB and verify job state
    const db2 = await openJobsDb(dbPath);
    const row = await db2.get("SELECT * FROM jobs WHERE id = ?", id);
    expect(row).not.toBeNull();
    expect(row.state === "done" || row.state === "error").toBeTruthy();

    // If done, check output exists
    if (row.state === "done") {
      expect(row.file_path).toBeTruthy();
      expect(fs.existsSync(row.file_path)).toBe(true);
      fs.unlinkSync(row.file_path);
    }

    await db2.close();
    fs.unlinkSync(dbPath);
  });
});
