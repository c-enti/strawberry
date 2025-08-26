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
