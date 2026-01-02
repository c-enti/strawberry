# Implementation Issues: CONFORM_02 Polling State

**Date**: January 2, 2026 @ 2:50PM
**Branch**: `feat/conform-02-polling-state`

**Reference**: Light_3-page_06.md (observed behavior)

---

## Executive Summary

The CONFORM_02 specification has been **partially implemented** in the code, but **the completion detection logic is broken**. This causes the frontend to never detect job completion during polling, resulting in:

- ✅ Transitions to POLLING state correctly
- ✅ PollingStatus component renders
- ✅ Polling loop runs
- ❌ **Polling loop never detects completion** (waits 10 minutes, then times out)
- ❌ User never sees "Ready!" UI with export button
- ❌ Content display fails

---

## Root Cause Analysis

### The Mismatch

**Backend returns** (from `/api/status/:resultId`):

```javascript
{
  resultId: "abc123",
  status: "complete",  // ← Backend field name
  eta: null,
  calls_total: 4,
  calls_completed: 4,
  progress_percent: 100,
  message: "Complete",
  result: { pages, html, metadata, ... },  // ← Result already included!
  error: null
}
```

**Frontend checks for** (lines 238-243 of GenerateFlow.svelte):

```javascript
if (statusData.complete === true || statusData.state === "complete") {
  // Job complete, exit polling loop
  return;
}
```

**The Problem**: Backend sends `status: "complete"` but frontend checks for `complete: true` or `state: "complete"`.

These fields **do not exist** in the backend response, so the condition is **always false**.

---

## Issue #1: Completion Detection Triggers Too Early

**Location**: `client/src/components/GenerateFlow.svelte` (lines 238-243)

**Current Code**:

```javascript
if (statusData.complete === true || statusData.state === "complete") {
  console.log(`[POLLING] Job complete: ${resultId}`);
  return;
}
```

**The Real Problem**: The first `/api/status/:resultId` poll **returns status="complete" immediately**, before the actual job has even started processing.

**Why This Happens**: The backend is supposed to return `status: "in-progress"` while the async job handler is running. Instead, it's returning `status: "complete"` on the first poll.

**Timeline of What's Actually Happening**:

```
T=0ms    POST /api/ebook/generate returns 202 + resultId
T=1ms    Frontend transitions GENERATING → POLLING
T=2ms    Frontend makes first poll: GET /api/status/:resultId
T=3ms    Backend returns status response with status="complete" ← PREMATURE!
         (Job hasn't even started processing yet!)
T=4ms    Frontend sees: statusData.status === "complete" ✓ (condition works!)
T=5ms    Frontend exits polling loop immediately
T=6ms    Frontend fetches/transitions to RESULT_READY
T=7ms    Frontend shows "Ready!" UI with export button ← TOO EARLY!
T=9ms    genieService async task finally starts in background
T=66ms   Backend completes real job
         (But frontend already showed success page)
```

**Root Cause Analysis**:

The condition `statusData.status === "complete"` is **actually correct**, but the **backend is returning the wrong status value**. The issue is not the completion detection logic, but what the backend is returning.

Possible reasons:

1. **Race Condition**: Status endpoint is called before `smartPoller.assignTask()` is called, so it returns null/undefined which defaults to "complete"
2. **SmartPoller State Leak**: Task from a previous request is still in smartPoller and being returned
3. **Missing await**: The `genieService.process()` async task hasn't been invoked yet when first status poll happens

**What Should Happen**: First poll should return `status: "in-progress"`, not `status: "complete"`

---

## Issue #2: Backend Already Returns Result in Status Response

**Location**: `server/index.js` (lines 3253-3299)

**Current Response**:

```javascript
const response = {
  resultId,
  status: taskStatus.status || "in-progress",
  eta: taskStatus.eta || null,
  calls_total: taskStatus.calls_total || 0,
  calls_completed: taskStatus.calls_completed || 0,
  progress_percent: taskStatus.progress_percent || 0,
  message: taskStatus.message || `Job ${taskStatus.status}`,
  result: taskStatus.result || null, // ← Already included!
  // ...
};
```

**Design Intent** (per CONFORM_02):

- `/api/status/:resultId` → Returns progress/status only (no content)
- `/api/result/:resultId` → Returns content when complete

**Current Reality**: Result is already in status response, but frontend tries to fetch it separately from `/api/result/`.

**This Creates**: Duplicate data transmission + unnecessary network call.

**Options**:

- **Option A**: Keep result in status response, update frontend to use it directly
- **Option B**: Remove result from status response, keep only in `/api/result/` endpoint

**Recommendation**: **Option A** (simpler, fewer network calls)

---

## Issue #3: Frontend Tries to Fetch Non-Existent Endpoint Result

**Location**: `client/src/components/GenerateFlow.svelte` (lines 284-310)

**Current Flow** (broken):

```javascript
// After polling "completes" (which never happens due to Issue #1)
const content = await fetchContent(genResult.resultId);

async function fetchContent(resultId) {
  const response = await fetch(`/api/result/${resultId}`);
  // ...
  if (!data.content) {
    // ← Expects data.content structure
    throw new Error("Invalid response: missing content");
  }
  return data.content; // Returns { pages, html, metadata }
}
```

**But polling never completes** (Issue #1), so this code never executes.

**Additionally**: The backend's `/api/result/` response structure is:

```javascript
{
  resultId,
  status: "complete",
  content: result  // ← Wrapped in "content" field
}
```

So this code would **work if polling worked**.

---

## Issue #4: Progress/ETA Not Being Updated in Frontend Store

**Location**: `client/src/components/GenerateFlow.svelte` (lines 246-265)

**Current Code**:

```javascript
if (statusData.progress) {
  flowStore.updateProgress({
    current: statusData.progress.current,
    total: statusData.progress.total,
    percent: statusData.progress.percent,
    message: statusData.progress.message,
  });
}

if (statusData.eta) {
  flowStore.updateETA(statusData.eta);
}
```

**Problem**: Backend never sends a `progress` object in status response. It sends individual fields:

```javascript
{
  calls_completed: 2,
  calls_total: 4,
  progress_percent: 50,  // Not nested in .progress
  message: "Processing call 2 of 4"
}
```

**Result**: `if (statusData.progress)` is always false. Progress bar never updates. ETA never updates.

**PollingStatus Component Shows**: Empty progress bar (0%), no ETA, no step counter.

**User Sees**: Just spinner + "Working on it..." text. No progress feedback.

---

## Observable Behavior (Light_3-page_06 confirms)

**Server Logs Show** (line: `[genieService] Result stored`):

- ✅ Job completes successfully at T~57s
- ✅ Result stored and marked complete
- ✅ Backend reports 4/20 quota used

**Frontend Detects Completion Too Early**:

- ✅ Transitions to POLLING state briefly
- ❌ **Detects completion on first poll** (before job actually starts)
- ❌ Immediately transitions to RESULT_READY (skips POLLING UI)
- ❌ **Shows export button immediately after "Generate" pressed** (not after ~57 seconds)
- ❌ **Does NOT show PollingStatus component** ("Working on it..." spinner never appears)
- ❌ Shows success page with export button while backend is still processing

**Export Attempt Fails** (logs show `POST /export 400 3.183ms`):

- User clicks export before backend finishes job
- Export endpoint gets invalid/incomplete content
- Returns 400 error
- Real job completes ~57 seconds later, but frontend has already moved on

---

## The Real Issue: Backend Status Endpoint Returns "complete" Too Early

**Critical Finding**: The polling logic is actually **working correctly**. The problem is that the backend's `/api/status/:resultId` endpoint is returning `status: "complete"` on the **first poll**, before the async job handler has even started running.

**Evidence**:

- Frontend transitions to POLLING state ✓
- Frontend polls /api/status/:resultId ✓
- Frontend detects statusData.status === "complete" on first poll ✓
- Frontend immediately exits polling loop ✓
- Export button appears immediately (not after 57 seconds) ✓
- User never sees PollingStatus component ✓

**What Should Happen**:

- First poll should return: `status: "in-progress"`, `progress_percent: 0`, `message: "Queued, waiting to start..."`
- Subsequent polls should track real progress: 25%, 50%, 75%, 100%
- Final poll should return: `status: "complete"` after job actually finishes

**What's Actually Happening**:

- First poll returns: `status: "complete"` (before job starts)
- Frontend thinks job is done
- Frontend transitions to RESULT_READY immediately
- Backend async task is still queued/starting
- User sees success page with potentially incomplete/wrong content

**Investigation Needed**:

Check the `genieService.process()` async flow in `server/index.js`:

```javascript
// Line ~2970 in POST /api/ebook/generate handler
genieService
  .process({ resultId, ... })
  .then((result) => {
    smartPoller.markComplete(resultId, result);
  })
  .catch((err) => {
    smartPoller.markError(resultId, err);
  });

// The problem: Is smartPoller.assignTask() being called BEFORE
// genieService.process() is invoked? Or is getStatus() being called
// before assignTask()?
```

**Likely Root Cause**: The status endpoint is being called (by frontend polling) before `smartPoller.assignTask()` has been called by the backend.

Timeline should be:

1. ✓ POST /api/ebook/generate handler receives request
2. ✓ Returns 202 immediately
3. ✓ **Then** calls smartPoller.assignTask() to initialize task state
4. ✓ **Then** hands off genieService.process() async
5. ✗ **Currently**: Maybe smartPoller.assignTask() is being called after the async handoff?

---

## Complete Fix Required

### Step 1: Fix Backend Task Initialization Order (CRITICAL)

**File**: `server/index.js` (POST /api/ebook/generate handler, around line ~2970)

**Problem**: SmartPoller task may not be initialized before status is first polled.

**Must ensure**:

1. **First**: Return 202 to client immediately
2. **Second**: Call `smartPoller.assignTask(resultId, { eta: null })` to initialize task state with `status: "in-progress"`
3. **Third**: Then hand off async job: `genieService.process(...)`

**Verification Check**:

Look for this pattern in the POST /api/ebook/generate handler:

```javascript
// Step 1: Quick validation
if (!prompt) return res.status(400).json({ error: ... });

// Step 2: Return 202 immediately
const resultId = generateUUID();
statusMap.set(resultId, { resultId, status: "queued", ... });
res.status(202).json({ resultId, status: "queued", ... });

// Step 3: MUST happen next - initialize smartPoller
smartPoller.assignTask(resultId, {
  eta: null,
  calls_total: 0,
  calls_completed: 0,
  status: "in-progress",
  message: "Queued, waiting to start..."
});

// Step 4: THEN hand off async (don't await)
genieService
  .process({ resultId, ... })
  .then((result) => { smartPoller.markComplete(resultId, result); })
  .catch((err) => { smartPoller.markError(resultId, err); });
```

**If this order is wrong**: Frontend's first poll will find no task in smartPoller, causing it to return null/undefined/wrong status.

---

### Step 2: Fix Frontend Completion Detection (Line 238)

**File**: `client/src/components/GenerateFlow.svelte`

**Current**:

```javascript
if (statusData.complete === true || statusData.state === "complete") {
```

**Fixed**:

```javascript
if (statusData.status === "complete") {
```

This is correct, but will only work if backend returns correct status values from smartPoller.

---

### Step 3: Fix Frontend Progress/ETA Extraction (Lines 246-265)

**File**: `client/src/components/GenerateFlow.svelte`

**Current**:

```javascript
if (statusData.progress) {
  flowStore.updateProgress({
    current: statusData.progress.current,
    total: statusData.progress.total,
    percent: statusData.progress.percent,
    message: statusData.progress.message,
  });
}

if (statusData.eta) {
  flowStore.updateETA(statusData.eta);
}
```

**Fixed**:

```javascript
// Backend sends flat structure, not nested
if (statusData.calls_total && statusData.calls_completed !== undefined) {
  flowStore.updateProgress({
    current: statusData.calls_completed,
    total: statusData.calls_total,
    percent: statusData.progress_percent || 0,
    message: statusData.message,
  });
}

if (statusData.eta !== null && statusData.eta !== undefined) {
  // eta comes as milliseconds, convert for display
  flowStore.updateETA(statusData.eta);
}
```

---

### Step 4: Use Result from Status Response (Lines 284-310)

**File**: `client/src/components/GenerateFlow.svelte`

**Current** (calls fetchContent):

```javascript
// After polling completes
const content = await fetchContent(genResult.resultId);
const content_pages = content.pages; // Error: content is undefined
```

**Fixed** (use result from polling response):

```javascript
// After polling completes, result is already available in smartPoller
const statusFinal = await fetch(`/api/status/${resultId}`).then((r) =>
  r.json()
);

flowStore.setResult({
  ...genResult,
  ...statusFinal.result, // pages, html, metadata already here
});
```

**Or Simpler**: Store the final status response during polling and use it directly.

---

### Step 5: Backend Consistency (Optional Cleanup)

**File**: `server/index.js` (lines 3253-3299)

**Consider**: Remove `result` from status response if you want to keep the design clean:

```javascript
// Current: returns result in status (simpler for client)
result: taskStatus.result || null,

// Alternative: Don't include, force client to call /api/result/
// (But then Issue #2 is moot)
```

**Recommendation**: **Keep result in status response** (cleaner, faster, fewer network calls).

---

## Success Criteria After Fix

✅ **SmartPoller Initialization**: Task initialized before first status poll (status="in-progress", not "complete")  
✅ **Completion Detection**: Frontend detects `statusData.status === "complete"` correctly (but only after job finishes)  
✅ **PollingStatus Display**: User sees spinning "Working on it..." during actual job processing (~57 seconds)  
✅ **Progress Display**: Progress bar updates as backend reports 0%, 25%, 50%, 75%, 100%  
✅ **ETA Display**: ETA updates as backend provides elapsed + remaining time  
✅ **Polling Duration**: Polling loop runs for ~57 seconds (actual job time), not immediately  
✅ **Content Display**: Result available after completion, renders immediately after polling completes  
✅ **Export Button**: Only appears after PollingStatus completes (not immediately after "Generate")  
✅ **Export Works**: Export succeeds with valid, complete content

---

## Timeline of Expected Behavior (After Fix)

```
T=0ms      POST /api/ebook/generate → 202 Accepted
           Frontend state: GENERATING → POLLING
           Backend: smartPoller.assignTask(resultId, { status: "in-progress" })

T=1ms      Frontend begins polling
           GET /api/status/:resultId
           Response: status="in-progress", progress=0%, message="Queued, waiting to start..."
           PollingStatus visible: 🔄 "Working on it..." (spinner shows)

T=5s       Backend starts processing
           GET /api/status/:resultId
           Response: status="in-progress", progress=25%, message="Generating structure..."
           PollingStatus updates: ████░░░░░░ 25%

T=15s      First API call completes
           GET /api/status/:resultId
           Response: status="in-progress", progress=50%, message="Generating opening..."
           PollingStatus updates: ████████░░ 50%

T=30s      Multiple calls progressing
           GET /api/status/:resultId
           Response: status="in-progress", progress=75%, message="Generating chapters..."
           PollingStatus updates: ████████████░░ 75%

T=55s      All calls complete, composing starts
           GET /api/status/:resultId
           Response: status="in-progress", progress=90%, message="Composing..."
           PollingStatus updates: ████████████████░░ 90%

T=58s      Job complete
           GET /api/status/:resultId
           Response: status="complete", progress=100%, result={...}
           Frontend detects: statusData.status === "complete" ✓
           Polling loop exits ✓

T=59s      Frontend transitions POLLING → RESULT_READY
           PollingStatus hidden
           Content displayed from status response result field
           Export button enabled and visible

T=60s      User can see full preview + export button
           User clicks export → succeeds (content verified complete)
```

---

## Files to Modify

| File                                        | Issue         | Fix                             |
| ------------------------------------------- | ------------- | ------------------------------- |
| `client/src/components/GenerateFlow.svelte` | Line 238      | Change completion condition     |
| `client/src/components/GenerateFlow.svelte` | Lines 246-265 | Fix progress/ETA extraction     |
| `client/src/components/GenerateFlow.svelte` | Lines 284-310 | Use result from status response |

---

## Related Documentation

- [ARCHITECTURE_CONFORM_02.md](ARCHITECTURE_CONFORM_02.md) - Specification (what should happen)
- [ARCHITECTURE_BA-FE_WIRING.md](ARCHITECTURE_BA-FE_WIRING.md) - Root cause analysis
- [Light_3-page_06.md](design/ebookService/DATA/Light_3-page_06.md) - Test results showing issue

---

## Implementation Priority

**Severity**: 🔴 Critical (blocks core feature: content display)

**Effort**: ⚡ Low (3 small code fixes, ~15 minutes)

**Impact**: ✅ High (fixes end-to-end generation → display → export flow)

---

**Status**: Ready for implementation  
**Next**: Apply fixes and re-run Light_3-page test
