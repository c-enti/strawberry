import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  openJobsDb,
  enqueueJob,
  claimNextJob,
  requeueStaleJobs,
} from "../jobs.js";

describe("jobs.requeueStaleJobs", () => {
  it("requeues stale processing jobs", async () => {
    const dbPath = path.join(os.tmpdir(), `jobs-requeue-${Date.now()}.db`);
    const db = await openJobsDb(dbPath);

    // Insert a job and simulate it being claimed earlier
    const id = await enqueueJob(db, { type: "requeue-test" });
    // Claim it to set state=processing
    const claimed = await claimNextJob(db, "tester");
    expect(claimed).toBeTruthy();

    // Manually set locked_at to an old timestamp
    const old = Date.now() - 1000 * 60 * 60; // 1 hour ago
    await db.run(`UPDATE jobs SET locked_at = ? WHERE id = ?`, old, id);

    const num = await requeueStaleJobs(db, 1000 * 60 * 10); // 10 minutes
    expect(num).toBe(1);

    const row = await db.get(`SELECT * FROM jobs WHERE id = ?`, id);
    expect(row.state).toBe("queued");

    await db.close();
    try {
      fs.unlinkSync(dbPath);
    } catch (e) {}
  });
});
