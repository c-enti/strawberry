// Lightweight SQLite-backed job helpers for export processing
const db = require("./db");

function safeParsePayload(payloadText) {
  if (!payloadText) return null;
  try {
    return JSON.parse(payloadText);
  } catch (e) {
    return payloadText;
  }
}

async function enqueueJob(payload) {
  await db.initialize();
  const payloadText = payload ? JSON.stringify(payload) : null;
  const stmt = await db.run(
    `INSERT INTO jobs (payload, state, progress, created_at, updated_at) VALUES (?, 'queued', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    payloadText
  );
  return { id: stmt.lastID };
}

async function getJob(id) {
  await db.initialize();
  const row = await db.get(
    `SELECT id, payload, state, progress, file_path, error, locked_by, locked_at, created_at, updated_at FROM jobs WHERE id = ?`,
    id
  );
  if (!row) return null;
  return {
    id: row.id,
    payload: safeParsePayload(row.payload),
    state: row.state,
    progress: row.progress,
    file_path: row.file_path,
    error: row.error,
    locked_by: row.locked_by,
    locked_at: row.locked_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function claimNextJob(workerId = "worker") {
  await db.initialize();
  // Find the oldest queued job
  const candidate = await db.get(
    `SELECT id FROM jobs WHERE state = 'queued' ORDER BY created_at ASC LIMIT 1`
  );
  if (!candidate) return null;
  const id = candidate.id;
  // Mark as processing and lock
  await db.run(
    `UPDATE jobs SET state = 'processing', locked_by = ?, locked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    workerId,
    id
  );
  return getJob(id);
}

async function updateJobProgress(id, progress, state) {
  await db.initialize();
  await db.run(
    `UPDATE jobs SET progress = ?, state = COALESCE(?, state), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    progress,
    state || null,
    id
  );
  return getJob(id);
}

async function finalizeJob(id, filePath) {
  await db.initialize();
  await db.run(
    `UPDATE jobs SET state = 'done', progress = 100, file_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    filePath,
    id
  );
  return getJob(id);
}

async function failJob(id, errorMessage) {
  await db.initialize();
  await db.run(
    `UPDATE jobs SET state = 'error', error = ?, progress = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    errorMessage ? String(errorMessage) : null,
    id
  );
  return getJob(id);
}

/**
 * Requeue stale processing jobs older than `minutes` minutes back to queued state.
 */
async function requeueStaleJobs(minutes = 30) {
  await db.initialize();
  const sql = `UPDATE jobs SET state = 'queued', locked_by = NULL, locked_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE state = 'processing' AND locked_at < datetime('now', ?)`;
  const when = `-${minutes} minutes`;
  const info = await db.run(sql, when);
  return info.changes || 0;
}

module.exports = {
  enqueueJob,
  getJob,
  claimNextJob,
  updateJobProgress,
  finalizeJob,
  failJob,
  requeueStaleJobs,
};
import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";

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

export async function openJobsDb(dbPath) {
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

export async function enqueueJob(db, payload) {
  const now = Date.now();
  const res = await db.run(
    `INSERT INTO jobs (payload, state, progress, created_at, updated_at) VALUES (?, 'queued', 0, ?, ?)`,
    JSON.stringify(payload),
    now,
    now
  );
  return res.lastID;
}

export async function claimNextJob(db, lockerId = "worker-1") {
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

export async function finalizeJob(db, id, filePath) {
  const now = Date.now();
  await db.run(
    `UPDATE jobs SET state = 'done', file_path = ?, progress = 100, updated_at = ? WHERE id = ?`,
    filePath,
    now,
    id
  );
}

export async function failJob(db, id, errMsg) {
  const now = Date.now();
  await db.run(
    `UPDATE jobs SET state = 'failed', error = ?, updated_at = ? WHERE id = ?`,
    String(errMsg),
    now,
    id
  );
}
