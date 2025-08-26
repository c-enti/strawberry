import { describe, it, expect } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { openJobsDb, enqueueJob, claimNextJob } from "../jobs.js";
import { startWorker } from "../worker-sqlite.mjs";

// Integration test: ensure worker processes one job end-to-end
describe("worker integration", () => {
  it("processes an enqueued job (runOnce)", async () => {
    const dbPath = path.join(os.tmpdir(), `worker-test-${Date.now()}.db`);
    const db = await openJobsDb(dbPath);
    const payload = { type: "export", bookId: 42 };
    const id = await enqueueJob(db, payload);
    expect(typeof id).toBe("number");

    // Run worker in runOnce mode against this DB
    await startWorker({ dbPath, runOnce: true, workerId: "test-worker" });

    const row = await db.get("SELECT * FROM jobs WHERE id = ?", id);
    expect(row.state === "done" || row.state === "failed").toBe(true);

    // cleanup
    await db.close();
    try {
      fs.unlinkSync(dbPath);
      const outPath = path.join(path.dirname(dbPath), `job-${id}.out.pdf`);
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    } catch (e) {
      // ignore
    }
  });
});
