import path from "path";
import fs from "fs";
import { openJobsDb, claimNextJob, finalizeJob, failJob } from "./jobs.js";
import { fileURLToPath } from "url";

/**
 * startWorker
 * - dbPath: path to sqlite jobs DB
 * - pollInterval: milliseconds between polls when idle
 * - runOnce: if true, process at most one job then exit
 * - workerId: identifier saved into locked_by
 */
export async function startWorker({
  dbPath = path.join(process.cwd(), "data", "your-database-name.db"),
  pollInterval = 2000,
  runOnce = false,
  workerId = "worker-1",
} = {}) {
  const db = await openJobsDb(dbPath);

  async function processOnce() {
    const job = await claimNextJob(db, workerId);
    if (!job) {
      // No job claimed
      console.error(`[worker:${workerId}] no queued job found`);
      return false;
    }

    console.error(`[worker:${workerId}] claimed job ${job.id}`);

    try {
      // Minimal processing: create a small placeholder output file
      const outPath = path.join(path.dirname(dbPath), `job-${job.id}.out.pdf`);
      await fs.promises.writeFile(outPath, `job ${job.id} output`);
      await finalizeJob(db, job.id, outPath);
      console.error(
        `[worker:${workerId}] finalized job ${job.id} -> ${outPath}`
      );
    } catch (err) {
      console.error(
        `[worker:${workerId}] failed job ${job.id}:`,
        err && (err.message || err)
      );
      await failJob(db, job.id, err ? String(err.message || err) : "unknown");
    }

    return true;
  }

  if (runOnce) {
    await processOnce();
    await db.close();
    return;
  }

  try {
    // long-running polling loop
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await processOnce();
      await new Promise((r) => setTimeout(r, pollInterval));
    }
  } finally {
    await db.close();
  }
}

// CLI entry when invoked directly: `node server/worker-sqlite.mjs`
const __filename = fileURLToPath(import.meta.url);

// Robust detection: check any argv entry basename matches this file's basename.
// This handles absolute, relative, and tool-invoked variants used by tests/CI.
const launchedDirectly = process.argv.some((a) =>
  a ? path.basename(a) === path.basename(__filename) : false
);

if (launchedDirectly) {
  const dbPath =
    process.env.JOBS_DB ||
    path.join(process.cwd(), "data", "your-database-name.db");
  console.error(`[worker] CLI start detected. JOBS_DB=${dbPath}`);
  // Give a clear startup log for test debugging
  console.error(
    `[worker] starting with pid=${process.pid} cwd=${process.cwd()}`
  );
  startWorker({ dbPath }).catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}
