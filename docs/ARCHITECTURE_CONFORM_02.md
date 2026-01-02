# ARCHITECTURE_CONFORM_02: Frontend Polling State Implementation

**Date**: January 2, 2026 @ 12:15PM
**Branch**: `feat/conform-01-result-capture`

**Related**: ARCHITECTURE_CONFORM_01.md (Backend Result Capture)
**Status**: Specification (Brainstorming → Design → Implementation)  
**New Branch**: `feat/conform-02-polling-state` (to be created)

---

## Executive Summary

Frontend currently treats all 2xx responses (including 202 Accepted) as "content ready" and immediately displays the "Ready!" UI with export enabled. During actual backend processing (polling phase), users see "Ready" UI and can click export prematurely, causing failures.

**Gap**: Frontend has no intermediate "processing" state or polling loop to wait for job completion before displaying content.

**Solution**: Add explicit "POLLING" state to frontend state machine. When backend returns 202, transition to POLLING and implement polling loop until job completes. Only then show "Ready!" UI.

---

## Problem Analysis

### Current Behavior (Broken)

```
Timeline:
T=0ms    POST /api/ebook/generate → 202 Accepted { resultId, ... }
T=1ms    Frontend checks: response.ok = true
T=2ms    Frontend transition: GENERATING → RESULT_READY
T=3ms    Frontend shows "Ready!" UI + enables export button
T=5ms    User clicks "Export" → fails (no content yet)
T=47000ms Backend finishes: [genieService] Result stored...
```

**Root Cause**: Frontend's binary "error vs success" logic cannot distinguish between:

- "Job accepted, now processing" (202 should mean this)
- "Job complete, content ready" (should be 200 with actual content)

Frontend treats both as "success" → immediate result display.

### Expected Behavior (Fixed)

```
Timeline:
T=0ms      POST /api/ebook/generate → 202 Accepted { resultId, ... }
T=1ms      Frontend checks: response.ok = true
T=2ms      Frontend transition: GENERATING → POLLING
T=3ms      Frontend shows "Working on it..." UI
T=4-47000ms Frontend polling loop:
             GET /api/status/:resultId → { processing: true, ... }
             Wait 1 second
             GET /api/status/:resultId → { processing: true, ... }
             Wait 1 second
             ...continue until complete...
T=47001ms  GET /api/status/:resultId → { complete: true, ... }
T=47002ms  GET /api/result/:resultId → { pages, html, metadata, ... }
T=47003ms  Frontend transition: POLLING → RESULT_READY
T=47004ms  Frontend shows "Ready!" UI + enables export
T=47005ms  User clicks "Export" → succeeds (content now available)
```

---

## Specification

### Frontend State Machine Changes

**New State**: `POLLING`

```javascript
// Current states in flowStore:
// - IDLE
// - MEDIUM_SELECTED
// - PROMPT_ENTERED
// - CLASSIFYING
// - CLASSIFICATION_READY
// - GENERATING
// - RESULT_READY
// - ERROR

// Add new state:
// - POLLING ← between GENERATING and RESULT_READY
```

**State Transitions:**

```
GENERATING (async generation task)
  ├─ Success (202 + resultId received)
  │   └─ → POLLING (new transition)
  └─ Error
      └─ → ERROR

POLLING (async polling task) ← NEW STATE
  ├─ Complete (job finished, content ready)
  │   └─ → RESULT_READY
  └─ Error (timeout, job failed, network error)
      └─ → ERROR

RESULT_READY (content available for display/export)
  └─ ready for user interaction
```

### UI Changes

**During POLLING State:**

Display component: `PollingStatus.svelte` (new) or extend `StatusDisplay.svelte`

```
┌─────────────────────────────────────────┐
│                                         │
│  🔄 Working on it...                    │
│                                         │
│  Generating your content...             │
│  (Step 2 of 4)                          │
│                                         │
│  ████████░░░░░░░░░░  50%                │
│                                         │
│  ETA: ~30 seconds remaining             │
│                                         │
│              [Cancel]                   │
│                                         │
└─────────────────────────────────────────┘
```

**UI Elements:**

- Spinner/animation indicator
- "Working on it..." message
- Progress bar (if available from `/api/status/:resultId`)
- Optional ETA countdown
- Optional step counter (e.g., "Step 2 of 4")
- Cancel button to abort polling

### Polling Loop Implementation

**Location**: `client/src/components/GenerateFlow.svelte` (new function)

```javascript
/**
 * Poll backend until job completes
 * Called after 202 response received
 * Transitions state to RESULT_READY when complete
 */
async function pollUntilComplete(resultId) {
  const MAX_ATTEMPTS = 600; // 10 minutes at 1-second intervals
  const POLL_INTERVAL_MS = 1000; // 1 second between polls

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      // Fetch status from backend
      const statusResponse = await fetch(`/api/status/${resultId}`);

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();

      // Check for error state
      if (statusData.error) {
        throw new Error(statusData.error.message || "Job failed");
      }

      // Check for completion
      // Backend should indicate completion via one of:
      // - statusData.complete === true
      // - statusData.state === "complete"
      // - statusData.job_state === "complete"
      if (statusData.complete === true || statusData.state === "complete") {
        // Job complete, exit polling loop
        return;
      }

      // Optional: Update UI with progress
      if (statusData.progress) {
        flowStore.updateProgress({
          current: statusData.progress.current,
          total: statusData.progress.total,
          percent: statusData.progress.percent,
          message: statusData.progress.message,
        });
      }

      // Optional: Update UI with ETA
      if (statusData.eta) {
        flowStore.updateETA(statusData.eta);
      }

      // Still processing, wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    } catch (err) {
      // Polling error (network, etc.)
      throw new Error(`Polling error: ${err.message}`);
    }
  }

  // Timeout: job did not complete within max attempts
  throw new Error("Job did not complete within 10 minutes");
}

/**
 * Fetch generated content from backend
 * Called after polling completes (job is done)
 */
async function fetchContent(resultId) {
  const response = await fetch(`/api/result/${resultId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Content not found (expired or invalid)");
    }
    throw new Error(`Failed to retrieve content: ${response.status}`);
  }

  const data = await response.json();

  if (!data.content) {
    throw new Error("Invalid response: missing content");
  }

  return data.content;
}
```

### Flow Integration

**In `handleAcceptClassification()` function:**

```javascript
async function handleAcceptClassification() {
  const { prompt, classification, selectedMedium } = $flowStore;

  flowStore.startGenerating();
  retryCount = 0;

  try {
    // Step 1: Call /api/generate (returns 202 with resultId)
    const genResult = await withRetry(
      () =>
        generate({
          prompt,
          medium: selectedMedium || classification.medium,
          classification,
        }),
      maxRetries,
      retryDelayMs
    );

    // Step 2: NEW - Transition to POLLING state instead of RESULT_READY
    flowStore.finishGenerating();
    flowStore.transitionTo("POLLING");

    // Step 3: NEW - Poll until job complete
    await pollUntilComplete(genResult.resultId);

    // Step 4: NEW - Fetch actual content from result endpoint
    const content = await fetchContent(genResult.resultId);

    // Step 5: Now transition to RESULT_READY with actual content
    flowStore.setResult({
      ...genResult,
      ...content, // pages, html, metadata, etc.
    });
    flowStore.transitionTo("RESULT_READY");
  } catch (err) {
    flowStore.finishGenerating();
    flowStore.setError(err, retryCount);
    flowStore.transitionTo("ERROR");
    error = err.message;
  }
}
```

---

## Implementation Checklist

### Phase 1: State Management

- [x] Add `POLLING` state to `flowStore`
- [x] Add `updateProgress()` method to flowStore
- [x] Add `updateETA()` method to flowStore
- [x] Define state transition rules (GENERATING → POLLING → RESULT_READY)

### Phase 2: Polling Logic

- [x] Create `pollUntilComplete(resultId)` function
- [x] Create `fetchContent(resultId)` function
- [x] Implement max retry/timeout handling (10 minutes)
- [x] Add error handling for network failures
- [x] Add progress/ETA forwarding to UI

### Phase 3: UI Components

- [x] Create or extend `PollingStatus.svelte` component
- [x] Add spinner/animation
- [x] Add "Working on it..." messaging
- [x] Add progress bar (conditional, if progress available)
- [x] Add ETA display (conditional, if ETA available)
- [x] Add cancel button (optional, stops polling)

### Phase 4: Integration

- [x] Integrate polling logic into `GenerateFlow.svelte`
- [x] Update `handleAcceptClassification()` to use polling
- [x] Test flow: Generate → Poll → Fetch → Display
- [x] Verify export only works when content actually available

### Phase 5: Testing

- [ ] Test successful completion flow
- [ ] Test timeout (job doesn't complete in 10 min)
- [ ] Test network errors during polling
- [ ] Test content fetch failure
- [ ] Test cancel button
- [ ] Verify UI state transitions correct

---

## Backend Dependencies

**Endpoints Already Implemented** (CONFORM_01):

- ✅ `GET /api/status/:resultId` — Returns job status
- ✅ `GET /api/result/:resultId` — Returns content when complete (CONFORM_01)

**Status Response Contract** (required format):

```javascript
// While processing:
{
  resultId: "abc123",
  state: "processing",  // or: complete: false
  progress: {
    current: 2,
    total: 4,
    percent: 50,
    message: "Generating page 2..."
  },
  eta: 45000  // milliseconds remaining
}

// When complete:
{
  resultId: "abc123",
  state: "complete",  // or: complete: true
  progress: {
    current: 4,
    total: 4,
    percent: 100,
    message: "Complete"
  }
}
```

---

## Success Criteria

✅ Frontend remains in POLLING state while backend processes (no premature "Ready")  
✅ "Working on it..." UI visible during polling phase  
✅ Export button disabled during polling (only enabled in RESULT_READY)  
✅ Polling loop continues until backend reports completion  
✅ Content successfully fetched and displayed after polling complete  
✅ Export succeeds (content actually available)  
✅ Timeout handling: stops polling after 10 minutes with clear error message  
✅ Network errors during polling handled gracefully

---

## Known Considerations

1. **Polling Interval**: Currently 1 second. Adjust based on job typical duration and desired UI responsiveness.

2. **Max Attempts**: Currently 600 (10 minutes). Can be configurable per medium (ebooks longer than wall-art).

3. **Progress Accuracy**: Depends on backend providing accurate progress data in `/api/status`. If not available, show generic "working..." without progress bar.

4. **ETA Accuracy**: Also depends on backend calculation. May be approximate; display as "approximately X seconds".

5. **Cancel Button**: Optional enhancement. If implemented, clear polling state and return to classification.

6. **State Persistence**: If needed, polling state could be saved to localStorage for recovery if browser crashes during polling.

---

## Related Issues

- **ARCHITECTURE_CONFORM_01**: Backend result capture and retrieval (prerequisite)
- **ARCHITECTURE_BA-FE_WIRING.md**: Root cause analysis of frontend-backend disconnect
- **Light_3-page_04.md**: Real-world test case showing the problem

---

## Implementation Branch

When ready to implement:

```bash
git checkout -b feat/conform-02-polling-state origin/feat/B_Frontend_option2
```

Then implement changes, commit, and create PR to `feat/B_Frontend_option2`.

---

## Notes for Developer

- Polling loop must be interrupt-able (user can cancel)
- No local storage of intermediate state needed (frontend polls backend source of truth)
- Coordinate with CONFORM_01 work (backend result endpoints must be working)
- Consider user experience: show encouraging messages, not technical jargon
- Keep polling resilient: network hiccup shouldn't crash the flow, retry gracefully
