import { describe, it, expect } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { openJobsDb, enqueueJob, claimNextJob, finalizeJob } from "../jobs.js";

describe("jobs helper", () => {
  it("enqueue, claim, finalize flow", async () => {
    const dbPath = path.join(os.tmpdir(), `jobs-test-${Date.now()}.db`);
    const db = await openJobsDb(dbPath);
    const payload = { type: "export", bookId: 1 };
    const id = await enqueueJob(db, payload);
    expect(typeof id).toBe("number");

    const claimed = await claimNextJob(db, "tester");
    expect(claimed).not.toBeNull();
    expect(claimed.id).toBe(id);

    const outPath = path.join(path.dirname(dbPath), "out.pdf");
    await finalizeJob(db, id, outPath);
    const row = await db.get("SELECT * FROM jobs WHERE id = ?", id);
    expect(row.state).toBe("done");
    await db.close();
    fs.unlinkSync(dbPath);
  });
});
