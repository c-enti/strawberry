import { describe, it, expect } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { openJobsDb, enqueueJob } from "../jobs.js";

describe("e2e: worker processes queued job", () => {
  it("spawns worker, enqueues job, and observes final state", async () => {
    const dbPath = path.join(os.tmpdir(), `jobs-e2e-${Date.now()}.db`);

    // Create DB and enqueue a job
    const db = await openJobsDb(dbPath);
    const payload = { type: "e2e-test", ts: Date.now() };
    const id = await enqueueJob(db, payload);
    await db.close();

    // Start worker as a subprocess pointed at our test DB
    const workerScript = path.resolve(
      path.join(__dirname, "..", "worker-sqlite.mjs")
    );
    const worker = spawn(process.execPath, [workerScript], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, JOBS_DB: dbPath },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    worker.stderr.on("data", (d) => (stderr += String(d)));

    // Poll the DB until the job reaches a terminal state (done|failed) or timeout
    async function readJobRow() {
      const db2 = await openJobsDb(dbPath);
      const row = await db2.get("SELECT * FROM jobs WHERE id = ?", id);
      await db2.close();
      return row;
    }

    const deadline = Date.now() + 10000; // 10s timeout
    let row = null;
    while (Date.now() < deadline) {
      row = await readJobRow();
      if (row && (row.state === "done" || row.state === "failed")) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    // Ask worker to exit if it's still running
    try {
      worker.kill();
    } catch (e) {
      // ignore
    }

    // Clean up DB file
    try {
      fs.unlinkSync(dbPath);
    } catch (e) {
      // ignore
    }

    if (!row) {
      // Provide stderr to help debugging if test times out
      throw new Error(`Job not processed in time. Worker stderr:\n${stderr}`);
    }

    expect(row.state).toBe("done");
  });
});
