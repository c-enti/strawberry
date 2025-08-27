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
    // Prefer CommonJS worker when present to match server module system
    const candidateCjs = path.resolve(
      path.join(__dirname, "..", "worker-sqlite.cjs")
    );
    const candidateMjs = path.resolve(
      path.join(__dirname, "..", "worker-sqlite.mjs")
    );
    const workerScript = fs.existsSync(candidateCjs)
      ? candidateCjs
      : candidateMjs;
    const worker = spawn(process.execPath, [workerScript], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, JOBS_DB: dbPath, E2E_TEST_RUN: "true" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    worker.stdout.on("data", (d) => (stdout += String(d)));
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

    // Print worker logs for debugging before making assertions
    if (stdout) console.error("[worker stdout]\n" + stdout);
    if (stderr) console.error("[worker stderr]\n" + stderr);

    if (!row) {
      throw new Error("Job not found in DB after timeout");
    }

    // Final assertion: job should be completed
    expect(row.state).toBe("done");
  });
});
