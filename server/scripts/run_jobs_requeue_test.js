const os = require("os");
const path = require("path");
const fs = require("fs");
const {
  openJobsDb,
  enqueueJob,
  claimNextJob,
  requeueStaleJobs,
} = require("../jobs.js");

async function run() {
  const dbPath = path.join(os.tmpdir(), `jobs-requeue-${Date.now()}.db`);
  const db = await openJobsDb(dbPath);
  try {
    const id = await enqueueJob(db, { type: "requeue-test" });
    const claimed = await claimNextJob(db, "tester");
    if (!claimed) {
      console.error("FAIL: job was not claimed");
      process.exit(2);
    }
    const old = Date.now() - 1000 * 60 * 60;
    await db.run("UPDATE jobs SET locked_at = ? WHERE id = ?", old, id);
    const num = await requeueStaleJobs(db, 1000 * 60 * 10);
    if (num !== 1) {
      console.error("FAIL: expected 1 requeued, got", num);
      process.exit(3);
    }
    const row = await db.get("SELECT * FROM jobs WHERE id = ?", id);
    if (row.state !== "queued") {
      console.error("FAIL: expected state queued, got", row.state);
      process.exit(4);
    }
    console.log("PASS: requeueStaleJobs behavior is correct");
    process.exit(0);
  } catch (e) {
    console.error("ERROR", e);
    process.exit(1);
  } finally {
    try {
      await db.close();
    } catch (e) {}
    try {
      fs.unlinkSync(dbPath);
    } catch (e) {}
  }
}

run();
