const path = require("path");
const fs = require("fs");

/**
 * CommonJS worker entry — mirrors logic in worker-sqlite.mjs but uses require
 * so it runs cleanly under the server's CommonJS module system.
 */
async function startWorker({
  dbPath = path.join(process.cwd(), "data", "your-database-name.db"),
  pollInterval = 2000,
  runOnce = false,
  workerId = "worker-1",
} = {}) {
  const jobs = require("./jobs.js");
  const { openJobsDb, claimNextJob, finalizeJob, failJob } = jobs;

  const db = await openJobsDb(dbPath);

  async function processOnce() {
    const job = await claimNextJob(db, workerId);
    if (!job) {
      console.error(`[worker:${workerId}] no queued job found`);
      return false;
    }

    console.error(`[worker:${workerId}] claimed job ${job.id}`);

    try {
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
    while (true) {
      await processOnce();
      await new Promise((r) => setTimeout(r, pollInterval));
    }
  } finally {
    await db.close();
  }
}

module.exports = { startWorker };

// CLI behaviour when run directly
if (require.main === module) {
  const dbPath =
    process.env.JOBS_DB ||
    path.join(process.cwd(), "data", "your-database-name.db");
  const runOnce = process.env.E2E_TEST_RUN === "true" || false;
  const pollInterval = runOnce
    ? 200
    : Number(process.env.POLL_INTERVAL || 2000);

  console.error(
    `[worker] CLI start detected. JOBS_DB=${dbPath} runOnce=${runOnce}`
  );
  console.error(
    `[worker] starting with pid=${
      process.pid
    } cwd=${process.cwd()} pollInterval=${pollInterval}`
  );

  startWorker({ dbPath, runOnce, pollInterval }).catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}
