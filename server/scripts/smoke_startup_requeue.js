const os = require("os");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const { openJobsDb, enqueueJob, claimNextJob } = require("../jobs.js");

async function seedStaleJob(dbPath) {
  const db = await openJobsDb(dbPath);
  try {
    const id = await enqueueJob(db, { type: "smoke-requeue" });
    const claimed = await claimNextJob(db, "smoker");
    if (!claimed) throw new Error("failed to claim job");
    // set locked_at far in the past to make it stale
    const old = Date.now() - 1000 * 60 * 60;
    await db.run("UPDATE jobs SET locked_at = ? WHERE id = ?", old, id);
    await db.close();
    return id;
  } catch (e) {
    try {
      await db.close();
    } catch (e) {}
    throw e;
  }
}

async function run() {
  const dbPath = path.join(os.tmpdir(), `jobs-smoke-${Date.now()}.db`);
  console.log("Using jobs DB at", dbPath);
  const id = await seedStaleJob(dbPath);
  console.log("Seeded stale job id", id);

  // Start server in a child process with JOBS_DB pointing to dbPath and skipping Puppeteer
  const env = Object.assign({}, process.env, {
    JOBS_DB: dbPath,
    NODE_ENV: "test",
    SKIP_PUPPETEER: "true",
  });

  console.log("Starting server (test mode, SKIP_PUPPETEER=true)");
  const child = child_process.spawn(process.execPath, ["server/index.js"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  child.stdout.on("data", (d) => {
    const s = d.toString();
    stdout += s;
    process.stdout.write(s);
  });
  child.stderr.on("data", (d) => process.stderr.write(d.toString()));

  // Wait up to 8s for the startup recovery log
  const ok = await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 8000);
    child.stdout.on("data", (d) => {
      const s = d.toString();
      if (s.includes("Startup recovery: requeued")) {
        clearTimeout(timeout);
        resolve(true);
      }
    });
  });

  if (!ok) {
    console.error("\nSmoke test FAILED: did not see startup requeue log");
    child.kill();
    process.exit(2);
  }

  // Check DB to confirm job state is queued
  const { openJobsDb } = require("../jobs.js");
  const db = await openJobsDb(dbPath);
  try {
    const row = await db.get("SELECT * FROM jobs WHERE id = ?", id);
    if (row.state === "queued") {
      console.log("PASS: job was requeued to queued state");
      process.exit(0);
    } else {
      console.error("FAIL: job state after startup is", row.state);
      process.exit(3);
    }
  } catch (e) {
    console.error("ERROR checking DB:", e);
    process.exit(4);
  } finally {
    try {
      await db.close();
    } catch (e) {}
    child.kill();
    try {
      fs.unlinkSync(dbPath);
    } catch (e) {}
  }
}

run().catch((e) => {
  console.error("ERROR", e);
  process.exit(1);
});
