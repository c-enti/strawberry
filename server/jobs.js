const sqlite3 = require("sqlite3").verbose
  ? require("sqlite3").verbose()
  : require("sqlite3");
const path = require("path");
const fs = require("fs");

// Promise-wrapper around sqlite3.Database
function wrapDb(db) {
  return {
    run(sql, ...params) {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve(this);
        });
      });
    },
    get(sql, ...params) {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });
    },
    all(sql, ...params) {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
    },
    exec(sql) {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => (err ? reject(err) : resolve()));
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        db.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

function openJobsDb(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, async (err) => {
      if (err) return reject(err);
      const wrapped = wrapDb(db);
      try {
        await wrapped.exec(`
          CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payload TEXT,
            state TEXT DEFAULT 'queued',
            progress INTEGER DEFAULT 0,
            file_path TEXT,
            error TEXT,
            created_at INTEGER,
            updated_at INTEGER,
            locked_by TEXT,
            locked_at INTEGER
          );
        `);
        resolve(wrapped);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function enqueueJob(db, payload) {
  const now = Date.now();
  const res = await db.run(
    `INSERT INTO jobs (payload, state, progress, created_at, updated_at) VALUES (?, 'queued', 0, ?, ?)`,
    JSON.stringify(payload),
    now,
    now
  );
  return res.lastID;
}

async function claimNextJob(db, lockerId = "worker-1") {
  const row = await db.get(
    `SELECT * FROM jobs WHERE state = 'queued' ORDER BY id ASC LIMIT 1`
  );
  if (!row) return null;
  const now = Date.now();
  await db.run(
    `UPDATE jobs SET state = 'processing', locked_by = ?, locked_at = ?, updated_at = ? WHERE id = ?`,
    lockerId,
    now,
    now,
    row.id
  );
  return Object.assign({}, row, {
    state: "processing",
    locked_by: lockerId,
    locked_at: now,
  });
}

async function finalizeJob(db, id, filePath) {
  const now = Date.now();
  await db.run(
    `UPDATE jobs SET state = 'done', file_path = ?, progress = 100, updated_at = ? WHERE id = ?`,
    filePath,
    now,
    id
  );
}

async function failJob(db, id, errMsg) {
  const now = Date.now();
  await db.run(
    `UPDATE jobs SET state = 'failed', error = ?, updated_at = ? WHERE id = ?`,
    String(errMsg),
    now,
    id
  );
}

// Requeue jobs that have been locked for longer than maxAgeMs (milliseconds)
// Returns number of jobs requeued
async function requeueStaleJobs(db, maxAgeMs = 10 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  // Find jobs that are processing and locked_at older than cutoff
  const rows = await db.all(
    `SELECT id FROM jobs WHERE state = 'processing' AND locked_at IS NOT NULL AND locked_at < ?`,
    cutoff
  );
  if (!rows || rows.length === 0) return 0;
  const ids = rows.map((r) => r.id);
  const now = Date.now();
  // Reset their state to queued and clear locks
  const placeholders = ids.map(() => "?").join(",");
  await db.run(
    `UPDATE jobs SET state = 'queued', locked_by = NULL, locked_at = NULL, updated_at = ? WHERE id IN (${placeholders})`,
    now,
    ...ids
  );
  return ids.length;
}

module.exports = {
  openJobsDb,
  enqueueJob,
  claimNextJob,
  finalizeJob,
  failJob,
  requeueStaleJobs,
};
