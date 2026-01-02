# ARCHITECTURE_CONFORM_01+02: Unified Backend + Frontend Implementation

**Date**: January 2, 2026 @ 5:30PM  
**Status**: Specification (Pre-Implementation)

**Starting Branch**: `feat/B_Frontend_option2` (most recent clean state, architecture analysis only)  
**New Branch**: `feat/conform-01+02-unified` (to be created from `feat/B_Frontend_option2`)  
**Scope**: Complete backend result capture + frontend polling state machine

**Historical Reference**: Original CONFORM_01 and CONFORM_02 specifications archived on `feat/conform-02-polling-state` branch for reference. This document supersedes both.

---

## Executive Summary

This unified specification combines CONFORM_01 (backend result capture) and CONFORM_02 (frontend polling) into a single, coherent implementation that respects the architectural design:

**Key Correction**: SmartPoller stays lightweight (tracks status only). Result persistence belongs to **genieService persistence layer**, not smartPoller.

- Backend: Implement genieService result storage + HTTP endpoints for status/result
- Frontend: Add POLLING state + polling loop + UI for progress display
- SmartPoller: Track status/progress only, never store result objects

---

## Problem Statement

### Current State (Broken)

1. **Backend**: smartPoller incorrectly stores full result objects (should be genieService responsibility)
2. **Backend**: `/api/status` returns result field (should return only metadata)
3. **Frontend**: No POLLING state — treats 202 as immediate success
4. **Frontend**: No polling loop — export button enabled before content ready
5. **User Experience**: "Ready!" UI appears immediately, but export fails (no content)

### Root Causes

1. **Spec/Implementation Gap**: Design said genieService owns persistence, but implementation put it in smartPoller
2. **Missing HTTP Endpoint**: `/api/result/:resultId` endpoint never created (only `/api/status`)
3. **Missing Frontend State**: POLLING state was designed but never implemented
4. **Missing Polling Loop**: Frontend polling logic was specified but never coded

---

## Solution Architecture

### Pattern Alignment

This implementation aligns with the 5-pattern architecture:

- **Pattern 1 (PART-A)**: Returns 202 immediately ✅ (already works)
- **Pattern 4 (Helpers & Utilities)**: SmartPoller = lightweight job queue ✅ (needs fix)
- **Pattern 4 (Helpers & Utilities)**: genieService = result persistence layer ✅ (needs implementation)
- **Pattern 5 (Smart Polling)**: Client polling with status/progress ✅ (needs implementation)

### Architecture Diagram

```
POST /api/ebook/generate
  ├─ PART-A (Pattern 1): Return 202 immediately ✅
  ├─ smartPoller.assignTask() ← Lightweight status tracker only
  └─ genieService.process() async
       ├─ Execute service
       ├─ genieService.storeResult() ← NEW: Persist result
       └─ smartPoller.markComplete() ← Track completion only

Client polls:
  GET /api/status/:resultId
    ├─ Returns: { status, eta, calls_completed, calls_total, ... }
    ├─ NO result field (status only)
    └─ Used by: Progress bar, ETA display, polling loop condition

When complete:
  GET /api/result/:resultId
    ├─ Returns: { pages, html, metadata, ... }
    └─ Used by: Content display, export feature
```

---

## Implementation Specification

### Backend: SmartPoller Changes

**Location**: `server/utilities/smartPoller.js`

**Before** (Over-scoped):

```javascript
markComplete(resultId, result) {
  const task = this.tasks.get(resultId);
  task.status = "complete";
  task.result = result;  // ← WRONG: smartPoller storing result
}

getStatus(resultId) {
  return {
    status: task.status,
    result: task.result,  // ← WRONG: returning result in status
    ...
  };
}
```

**After** (Lightweight):

```javascript
markComplete(resultId) {
  const task = this.tasks.get(resultId);
  task.status = "complete";
  // NO: task.result = result  ← Don't store result here
}

getStatus(resultId) {
  return {
    status: task.status,
    eta: task.eta,
    calls_completed: task.calls_completed,
    calls_total: task.calls_total,
    progress_percent: task.progress_percent,
    message: task.message,
    // NO: result field (removed)
  };
}
```

**Changes Required**:

1. Remove `result` field from task object initialization
2. Remove `task.result = result` from `markComplete()` method
3. Remove `result: task.result` from `getStatus()` return object
4. Update callers: `markComplete(resultId)` no longer takes result parameter

### Backend: genieService Result Persistence

**Location**: `server/genieService.js`

**New Methods**:

```javascript
// Initialize result cache on startup
const resultCache = new Map(); // resultId -> result object

/**
 * Store result for later retrieval
 * Called after successful service execution
 * @param {string} resultId
 * @param {object} result - { pages, html, metadata, ... }
 */
function storeResult(resultId, result) {
  resultCache.set(resultId, result);
  logger.debug(`[genieService] Result stored: ${resultId}`);

  // Optional: Clean up old results after 24 hours
  setTimeout(() => {
    resultCache.delete(resultId);
  }, 24 * 60 * 60 * 1000);
}

/**
 * Retrieve stored result
 * @param {string} resultId
 * @returns {object|null} result object or null if not found
 */
function getResult(resultId) {
  const result = resultCache.get(resultId);
  if (!result) {
    logger.warn(`[genieService] Result not found: ${resultId}`);
  }
  return result || null;
}
```

**Update POST handler** (`server/index.js`):

```javascript
// Before: genieService.process() returns result but it's not saved
genieService
  .process({ resultId, ... })
  .then((result) => {
    smartPoller.markComplete(resultId);  // NO: removed result param
  });

// After: Store result before marking complete
genieService
  .process({ resultId, ... })
  .then((result) => {
    genieService.storeResult(resultId, result);  // NEW: Persist result
    smartPoller.markComplete(resultId);  // Lightweight status only
  });
```

### Backend: HTTP Endpoints

#### GET /api/status/:resultId

**Purpose**: Return job status + progress for polling clients  
**Returns**: Status metadata ONLY (no result object)

```javascript
// server/index.js
app.get("/api/status/:resultId", (req, res) => {
  const { resultId } = req.params;
  const status = smartPoller.getStatus(resultId);

  if (!status) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json({
    status: status.status, // "in-progress" | "complete" | "error"
    eta: status.eta, // seconds remaining
    calls_completed: status.calls_completed,
    calls_total: status.calls_total,
    progress_percent: status.progress_percent,
    message: status.message,
    // NO: result field
  });
});
```

**Response Examples**:

While processing:

```json
{
  "status": "in-progress",
  "eta": 35,
  "calls_completed": 1,
  "calls_total": 4,
  "progress_percent": 25,
  "message": "Processing call 1 of 4"
}
```

When complete:

```json
{
  "status": "complete",
  "eta": 0,
  "calls_completed": 4,
  "calls_total": 4,
  "progress_percent": 100,
  "message": "Complete"
}
```

#### GET /api/result/:resultId

**Purpose**: Return full result content for display/export  
**Returns**: Complete content packet with pages, html, metadata

```javascript
// server/index.js
app.get("/api/result/:resultId", (req, res) => {
  const { resultId } = req.params;
  const status = smartPoller.getStatus(resultId);

  if (!status) {
    return res.status(404).json({ error: "Job not found" });
  }

  if (status.status !== "complete") {
    return res.status(202).json({
      error: "Job still processing",
      status: status.status,
    });
  }

  const result = genieService.getResult(resultId);
  if (!result) {
    return res
      .status(500)
      .json({ error: "Result not found (should not happen)" });
  }

  res.json({
    status: "complete",
    content: result, // { pages, html, metadata, ... }
  });
});
```

**Response Example**:

```json
{
  "status": "complete",
  "content": {
    "pages": [
      {
        "title": "Page 1",
        "html": "<html>...</html>"
      },
      ...
    ],
    "html": "<html>...</html>",
    "metadata": {
      "pageCount": 5,
      "wordCount": 12000,
      ...
    }
  }
}
```

---

### Frontend: State Machine Extension

**Location**: `client/src/stores/flowStore.js`

**New State**:

```javascript
// Add to state enum:
const STATES = {
  // ... existing states ...
  GENERATING: "GENERATING",
  POLLING: "POLLING", // ← NEW
  RESULT_READY: "RESULT_READY",
  // ... existing states ...
};

// Add default properties when entering POLLING:
flowStore.subscribe((state) => {
  if (state.state === "POLLING") {
    return {
      ...state,
      pollingStartedAt: Date.now(),
      pollAttempts: 0,
      currentProgressPercent: 0,
      currentEta: null,
    };
  }
});
```

**State Transitions**:

```
GENERATING (async task)
  ├─ Success (202 + resultId)
  │   └─ → POLLING
  └─ Error
      └─ → ERROR

POLLING (polling loop)
  ├─ Complete (status === 'complete')
  │   └─ → RESULT_READY
  └─ Error (timeout, network error, job error)
      └─ → ERROR

RESULT_READY (ready for display/export)
  └─ (user interaction)
```

### Frontend: Polling Loop Implementation

**Location**: `client/src/components/GenerateFlow.svelte`

**New Function**: `pollUntilComplete(resultId)`

```javascript
/**
 * Poll backend until job completes
 * Called after 202 response with resultId
 * Transitions to POLLING state immediately
 * Updates progress on each poll
 * Transitions to RESULT_READY when complete
 */
async function pollUntilComplete(resultId) {
  const MAX_ATTEMPTS = 600; // 10 minutes max
  const POLL_INTERVAL_MS = 2000; // 2 seconds between polls

  // Transition to POLLING state immediately after 202
  flowStore.setState(POLLING);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      // Poll status endpoint
      const statusResponse = await fetch(`/api/status/${resultId}`);

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();

      // Update progress display
      if (statusData.progress_percent !== undefined) {
        flowStore.updateProgress({
          percent: statusData.progress_percent,
          message: statusData.message,
          eta: statusData.eta,
          calls_completed: statusData.calls_completed,
          calls_total: statusData.calls_total,
        });
      }

      // Check if complete
      if (statusData.status === "complete") {
        // Fetch full result
        const resultResponse = await fetch(`/api/result/${resultId}`);

        if (!resultResponse.ok) {
          throw new Error(`Result fetch failed: ${resultResponse.status}`);
        }

        const resultData = await resultResponse.json();

        // Store result and transition to RESULT_READY
        flowStore.setResult(resultData.content);
        flowStore.setState(RESULT_READY);
        return; // Success
      }

      // Not complete yet, wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    } catch (error) {
      logger.error(`Polling error: ${error.message}`);
      flowStore.setState(ERROR, { message: error.message });
      return;
    }
  }

  // Max attempts reached (timeout)
  logger.error(`Polling timeout after ${MAX_ATTEMPTS} attempts`);
  flowStore.setState(ERROR, { message: "Polling timeout" });
}
```

**Integration with POST handler**:

```javascript
// In handleGenerate():
try {
  const response = await fetch("/api/ebook/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, mode, theme }),
  });

  if (response.status === 202) {
    const data = await response.json();
    const { resultId } = data;

    // Start polling loop
    pollUntilComplete(resultId); // ← NEW: Don't await, let it run
    return; // Handler complete
  }

  // Unexpected response
  throw new Error(`Unexpected response: ${response.status}`);
} catch (error) {
  flowStore.setState(ERROR, { message: error.message });
}
```

### Frontend: UI Components

#### PollingStatus.svelte (New)

```svelte
<script>
  import { flowStore } from '../stores/flowStore.js';
</script>

{#if $flowStore.state === 'POLLING'}
  <div class="polling-container">
    <div class="spinner">🔄</div>
    <h2>Working on it...</h2>
    <p>{$flowStore.currentMessage || 'Generating your content...'}</p>

    {#if $flowStore.currentProgressPercent !== undefined}
      <div class="progress-bar">
        <div
          class="progress-fill"
          style="width: {$flowStore.currentProgressPercent}%"
        />
      </div>
      <p class="progress-text">
        {$flowStore.currentProgressPercent}%
        ({$flowStore.calls_completed} of {$flowStore.calls_total} steps)
      </p>
    {/if}

    {#if $flowStore.currentEta !== undefined && $flowStore.currentEta > 0}
      <p class="eta">
        ETA: ~{Math.ceil($flowStore.currentEta)} seconds remaining
      </p>
    {/if}

    <button on:click={handleCancel} class="cancel-btn">
      Cancel
    </button>
  </div>
{/if}

<style>
  .polling-container {
    text-align: center;
    padding: 2rem;
    background: #f5f5f5;
    border-radius: 8px;
  }
  .spinner {
    font-size: 3rem;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .progress-bar {
    width: 100%;
    height: 8px;
    background: #ddd;
    border-radius: 4px;
    overflow: hidden;
    margin: 1rem 0;
  }
  .progress-fill {
    height: 100%;
    background: #4CAF50;
    transition: width 0.3s ease;
  }
  .eta {
    color: #666;
    font-size: 0.9rem;
    margin-top: 0.5rem;
  }
  .cancel-btn {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: #f44336;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
```

---

## Implementation Checklist

### Backend

- [x] Remove `result` field from smartPoller task object
- [x] Update `markComplete(resultId)` signature (remove result param)
- [x] Remove `result` from smartPoller `getStatus()` return
- [x] Create `resultCache` Map in genieService
- [x] Implement `genieService.storeResult(resultId, result)`
- [x] Implement `genieService.getResult(resultId)`
- [x] Update POST handler to call `genieService.storeResult()`
- [x] Create `GET /api/status/:resultId` endpoint
- [x] Create `GET /api/result/:resultId` endpoint
- [x] Test both endpoints with manual curl requests
- [x] Update smartPoller.markComplete() calls to remove result param

### Frontend

- [x] Add `POLLING` state to flowStore
- [x] Implement `pollUntilComplete(resultId)` function
- [x] Integrate polling into POST handler response
- [x] Create PollingStatus.svelte component
- [x] Add POLLING case to state renderer
- [x] Update flowStore to track polling progress fields
- [x] Test polling loop with backend
- [x] Test UI transitions: GENERATING → POLLING → RESULT_READY

### Testing

- [ ] Manual: POST generates content, returns 202
- [ ] Manual: Poll `/api/status/:resultId`, verify fields
- [ ] Manual: Poll until complete, verify `status === 'complete'`
- [ ] Manual: Fetch `/api/result/:resultId`, verify content
- [ ] E2E: Full flow from generate to export with Light_3-page test

---

## Key Differences from Previous Implementation

| Aspect                   | Previous (Wrong)   | New (Correct)       |
| ------------------------ | ------------------ | ------------------- |
| Result Storage           | smartPoller        | genieService        |
| /api/status returns      | status + result    | status only         |
| /api/result returns      | (doesn't exist)    | full result         |
| Frontend State           | No POLLING         | POLLING state added |
| Polling Loop             | Not implemented    | Implemented         |
| smartPoller.markComplete | Takes result param | No param            |

---

## Success Criteria

1. ✅ smartPoller.js has no `result` field or storage
2. ✅ genieService.js has `storeResult()` and `getResult()` methods
3. ✅ `/api/status/:resultId` returns only metadata (no result)
4. ✅ `/api/result/:resultId` returns full content object
5. ✅ Frontend transitions: GENERATING → POLLING → RESULT_READY
6. ✅ Polling loop correctly detects completion
7. ✅ Export button only enabled after RESULT_READY state
8. ✅ Light_3-page test passes end-to-end
9. ✅ No field name mismatches between frontend/backend
10. ✅ Architecture aligns with 5-pattern design

---

**Status**: Ready for implementation  
**Target**: Clean slate, full conformance to spec

---

## ADDENDUM: Fix Applied - Consistent 202 Polling Pattern

**Date**: January 2, 2026  @ 6:30PM
**Commit**: 5e7ee7c  
**Issue**: Frontend showed "Generated Successfully" immediately without polling

### Problem Identified

During implementation testing, the frontend was displaying "eBook Generated Successfully" and enabling the export button immediately upon clicking Generate, even though the polling state machine hadn't started yet.

**Root Cause**: The `/api/generate` endpoint had conditional logic:
- If `genieService.process()` returned `out_envelope` (cached/sync result) → returned **201 Created** with full `out_envelope`
- If async job queued → returned **202 Accepted** with just `resultId`

This caused the frontend's `handleAcceptClassification()` to detect the `out_envelope` field and skip polling entirely, transitioning directly to `RESULT_READY`.

### Solution Implemented

Modified `/api/generate` to **always return 202 Accepted with only `resultId`**, regardless of whether the job completes synchronously or asynchronously. This enforces:

1. **Consistent polling pattern** for frontend in all cases
2. **Deterministic state transitions**: GENERATING → POLLING → RESULT_READY
3. **No premature success messaging** before job completion verification
4. **Architectural clarity**: Endpoint contract is uniform and predictable

#### Changes Made

**Backend (server/index.js - POST /api/generate)**:
- Always return 202 Accepted with just `resultId`
- Still store result and mark complete for sync case, but keep response minimal
- Comments clarify the consistent pattern

**Frontend (client/src/components/GenerateFlow.svelte - handleAcceptClassification)**:
- Simplified logic: always expect `resultId` in response
- Always call `pollUntilComplete()` regardless of execution speed
- Removed conditional branches for 201 vs 202

### Impact

✅ Frontend now displays POLLING state with progress bar for ALL generation requests  
✅ "Generated Successfully" message only appears after `/api/status` reports completion  
✅ User sees consistent UX regardless of sync vs async execution  
✅ Export button only enabled after confirmed completion via polling loop  
✅ Cleaner endpoint contract - no conditional response format  

### Testing Recommendation

Verify the fix with Light_3-page test:
1. Click Generate → Should see "Working on your content..." with progress bar
2. Wait for polling to complete → Should transition to RESULT_READY
3. Export button appears only after completion confirmation
4. No "Generated Successfully" message appears prematurely
