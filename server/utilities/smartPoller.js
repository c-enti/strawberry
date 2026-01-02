/**
 * utilities/smartPoller.js
 * App-wide utility for job status management
 *
 * Singleton utility that:
 * - Tracks all concurrent jobs
 * - Enriches status with real activity from orchestrator
 * - Provides status endpoint for client polling
 * - Manages cleanup of completed jobs
 */

const logger = require("../utils/logger");

class SmartPoller {
  constructor() {
    this.tasks = new Map(); // resultId -> taskStatus
    this.cleanupIntervalMs = 3600000; // 1 hour
    this.maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours
    this.startCleanup();
  }

  /**
   * Assign a new task (called by endpoints at PART-A)
   * @param {string} resultId
   * @param {{eta?: number, totalCalls?: number}} options
   */
  assignTask(resultId, { eta = null, totalCalls = null } = {}) {
    const task = {
      resultId,
      status: "in-progress", // in-progress | complete | error
      eta: eta || null, // in seconds
      calls_total: totalCalls || null,
      calls_completed: 0,
      progress_percent: 0,
      message: "Job queued",
      error: null,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      completedAt: null,
    };

    this.tasks.set(resultId, task);
    logger.debug(`[SmartPoller] assignTask: ${resultId} (eta=${task.eta})`);
    return task;
  }

  /**
   * Update progress from orchestrator/services
   * @param {string} resultId
   * @param {{callsCompleted?: number, currentCall?: number, totalCalls?: number, eta?: number}} opts
   */
  updateProgress(
    resultId,
    { callsCompleted = 0, currentCall = 0, totalCalls = null, eta = null } = {}
  ) {
    const task = this.tasks.get(resultId);
    if (!task) return;

    task.calls_completed = Number.isFinite(callsCompleted)
      ? callsCompleted
      : task.calls_completed;
    task.calls_total = totalCalls || task.calls_total;
    task.eta = typeof eta === "number" ? eta : task.eta;

    if (task.calls_total && task.calls_total > 0) {
      task.progress_percent = Math.round(
        (task.calls_completed / task.calls_total) * 100
      );
    }

    if (task.calls_total) {
      task.message = `Processing call ${currentCall} of ${task.calls_total}`;
    }

    task.lastUpdatedAt = Date.now();
  }

  /**
   * Mark task complete
   * Note: Result persistence handled by genieService, not smartPoller
   */
  markComplete(resultId) {
    const task = this.tasks.get(resultId);
    if (!task) return;

    task.status = "complete";
    task.progress_percent = 100;
    task.message = "Complete";
    task.completedAt = Date.now();
    task.lastUpdatedAt = Date.now();

    logger.info(`[SmartPoller] markComplete: ${resultId}`);
  }

  /**
   * Mark task failed with error
   */
  markError(resultId, { message = "Unknown error", code = "ERROR" } = {}) {
    const task = this.tasks.get(resultId);
    if (!task) return;

    task.status = "error";
    task.error = { message, code };
    task.message = `Error: ${message}`;
    task.completedAt = Date.now();
    task.lastUpdatedAt = Date.now();
    logger.error(`[SmartPoller] markError: ${resultId} - ${message}`);
  }

  /**
   * Get status object for endpoint consumption
   * Note: Returns status/progress metadata only. Results obtained from genieService.
   */
  getStatus(resultId) {
    const task = this.tasks.get(resultId);
    if (!task) return null;

    return {
      status: task.status,
      eta: task.eta,
      calls_total: task.calls_total,
      calls_completed: task.calls_completed,
      progress_percent: task.progress_percent || 0,
      message: task.message,
      error: task.error || null,
      startedAt: task.startedAt,
      lastUpdatedAt: task.lastUpdatedAt,
      completedAt: task.completedAt,
    };
  }

  getActiveTasks() {
    return Array.from(this.tasks.values()).filter(
      (t) => t.status === "in-progress"
    );
  }

  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      const toDelete = [];
      for (const [resultId, task] of this.tasks.entries()) {
        if (
          (task.status === "complete" || task.status === "error") &&
          task.completedAt &&
          now - task.completedAt > this.maxAgeMs
        ) {
          toDelete.push(resultId);
        }
      }
      toDelete.forEach((id) => this.tasks.delete(id));
      if (toDelete.length > 0)
        logger.debug(`[SmartPoller] cleaned ${toDelete.length} tasks`);
    }, this.cleanupIntervalMs);
  }
}

module.exports = new SmartPoller();
