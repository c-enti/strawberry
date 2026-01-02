# ISSUE 2: eBook Delivery - Implementation Nuances

**Date**: December 31, 2025 @ 12:30PM

**Reference**: ISSUE2_EBOOK_DELIVERY_FIX_ASSESSMENT.md  
**Status**: Implementation Guide

---

## Overview

This document captures the specific implementation details, edge cases, and nuances required to fix the eBook delivery flow. It bridges the corrective assessment with actual code changes.

---

## Part 1: Backend Verification & Potential Updates

### Verification Checklist

**Check #1: Does `/api/ebook/result/:resultId` endpoint exist?**

```bash
grep -n "app.get.*result.*resultId\|/api/ebook/result" server/index.js
```

**Expected Locations**:

- Likely after `/api/status/:resultId` endpoint (around line 3190+)
- OR in a separate module like `server/utils/resultDb.js`
- OR handled via smartPoller.getResult()

**If Found**: Proceed to Check #2  
**If Not Found**: Must implement - see "Missing Endpoint Implementation" below

---

### Check #2: Current Response Format

**What to Look For**:

```javascript
// Desired format
app.get("/api/ebook/result/:resultId", (req, res) => {
  const result = smartPoller.getResult(req.params.resultId);

  if (!result) return res.status(404).json({ error: "RESULT_NOT_FOUND" });
  if (result.expired) return res.status(410).json({ error: "RESULT_EXPIRED" });

  res.json({
    resultId: req.params.resultId,
    html: result.html,
    chapters: result.chapters,
    metadata: result.metadata,
    actions: result.actions,
  });
});
```

**Potential Issues**:

1. Response includes `chapters` but frontend expects it
2. Missing `html` field
3. Missing `metadata` field
4. Including extra fields that confuse frontend

**If Issues Found**: Update endpoint response to match expected schema

---

### Missing Endpoint Implementation

**If endpoint doesn't exist**, add it after `/api/status/:resultId`:

**File**: `server/index.js` (after line 3210)

**Code to Add**:

```javascript
/**
 * GET /api/ebook/result/:resultId
 *
 * Returns the complete generated ebook after job completes
 * Can be called once polling shows status: "complete"
 */
app.get("/api/ebook/result/:resultId", async (req, res) => {
  try {
    const { resultId } = req.params;
    const smartPoller = require("./utilities/smartPoller");

    // Get the stored result
    const taskStatus = smartPoller.getStatus(resultId);

    // Not found
    if (!taskStatus) {
      return res.status(404).json({
        error: "RESULT_NOT_FOUND",
        message: `Result with ID '${resultId}' not found`,
        code: "RESULT_NOT_FOUND",
      });
    }

    // Still processing
    if (taskStatus.status !== "complete" && taskStatus.status !== "success") {
      return res.status(202).json({
        error: "STILL_PROCESSING",
        message: "Generation still in progress",
        code: "STILL_PROCESSING",
        status: taskStatus.status,
        progress: {
          completed: taskStatus.calls_completed || 0,
          total: taskStatus.calls_total || 0,
        },
        eta: taskStatus.eta || null,
      });
    }

    // Expired (optional - if result cleanup is implemented)
    if (
      taskStatus.completedAt &&
      Date.now() - taskStatus.completedAt > 86400000
    ) {
      // 24 hours
      return res.status(410).json({
        error: "RESULT_EXPIRED",
        message: "Result expired after 24 hours",
        code: "RESULT_EXPIRED",
        expiresAt: new Date(taskStatus.completedAt + 86400000).toISOString(),
      });
    }

    // Return complete result
    const result = taskStatus.result || {};

    res.json({
      resultId: resultId,
      id: result.id || `ebook_${resultId}`,
      html: result.html || result.content?.html || null,
      chapters: result.chapters || result.pages || [],
      metadata: result.metadata || {},
      actions: result.actions || {
        persist_prompt: true,
        generate_pdf: true,
        can_export: true,
        can_preview: true,
        can_override: true,
      },
    });
  } catch (err) {
    console.error("Result endpoint error:", err);
    res.status(500).json({
      error: "SERVER_ERROR",
      message: "Failed to retrieve result",
    });
  }
});
```

**Key Implementation Details**:

1. **Status Check**: Return 202 if still processing (not an error)
2. **Error Status Codes**:
   - 404: resultId doesn't exist or was never created
   - 410: result expired (>24h) - use 410 Gone for cache semantics
   - 202: result not yet ready - client should keep polling
   - 500: server error during retrieval
3. **Response Shape**: Always return consistent structure
4. **Defensive Defaults**: Use `||` for missing fields to prevent undefined

---

## Part 2: Frontend Implementation - ebookApi.js

### Current File Structure

**File**: `client/src/lib/ebookApi.js`  
**Lines**: 1-152 (end of file)

### Implementation Strategy

**Replace** the entire `generateEbook()` function with new implementation that includes polling.

**Key Nuances**:

1. **Handle 202 Status Code Explicitly**

   ```javascript
   const response = await fetch(...);

   // Check response status BEFORE reading body
   if (response.status === 202) {
     // Parse body as JSON to get resultId
     const acceptance = await response.json();
     return pollUntilComplete(acceptance.resultId, onProgress);
   }

   // Original behavior for other status codes
   if (!response.ok) throw new Error(...);
   ```

2. **Callback Pattern for Progress**

   - Accept `onProgress` callback parameter
   - Call it on EVERY polling iteration
   - Avoid excessive console logging in production

3. **Error Recovery During Polling**

   - Network error ≠ job failure
   - Continue polling with backoff
   - Max 10 consecutive errors before giving up
   - Never throw until maxErrors exceeded

4. **Smart Poll Interval Calculation**
   - Don't poll faster than ETA suggests
   - Reduce frequency as ETA increases
   - Minimum 1s (too fast = unnecessary load)
   - Maximum 10s (too slow = poor UX)

### New generateEbook() Implementation

**Location**: Replace lines 100-118

```javascript
/**
 * POST /api/ebook/generate with async polling
 *
 * Handles full async flow:
 * 1. POST to /api/ebook/generate
 * 2. Get 202 + resultId
 * 3. Poll /api/status/:resultId until complete
 * 4. Fetch /api/ebook/result/:resultId
 * 5. Return full ebook result
 *
 * @param {Object} payload - { prompt, theme, pageCount, ... }
 * @param {Function} onProgress - callback(status, eta, progress)
 * @returns {Promise<Object>} Full ebook result
 */
export async function generateEbook(payload, onProgress = () => {}) {
  // Step 1: Send POST to /api/ebook/generate
  console.log("[API] Sending POST /api/ebook/generate");
  const generateResponse = await fetchWithTimeout(
    `${CONFIG.API_BASE_URL}/ebook/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    CONFIG.TIMEOUTS.GENERATE
  );

  // Step 2: Handle 202 Accepted response
  // Must check status before reading body
  if (!generateResponse || !generateResponse.resultId) {
    throw new Error(
      "Invalid response from /api/ebook/generate: missing resultId"
    );
  }

  const resultId = generateResponse.resultId;
  console.log(`[API] Job accepted with resultId: ${resultId}`);

  // Step 3: Poll until complete
  const statusResult = await pollUntilComplete(resultId, onProgress);
  console.log(`[API] Job complete, fetching full result...`);

  // Step 4: Fetch full result
  const fullResult = await fetchWithTimeout(
    `${CONFIG.API_BASE_URL}/ebook/result/${resultId}`,
    { method: "GET" },
    CONFIG.TIMEOUTS.GENERATE
  );

  console.log(
    `[API] Full result retrieved, size: ${
      JSON.stringify(fullResult).length
    } bytes`
  );

  return fullResult;
}

/**
 * Poll /api/status/:resultId until complete
 *
 * Nuances:
 * - Smart backoff based on ETA
 * - Max 10 consecutive errors before giving up
 * - Calls onProgress on every iteration
 * - Handles various error scenarios
 *
 * @param {string} resultId - Job ID to poll
 * @param {Function} onProgress - callback(status, eta, progress)
 * @returns {Promise<Object>} Status when complete
 */
async function pollUntilComplete(resultId, onProgress) {
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 10;
  let lastEta = null;

  while (consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
    try {
      console.log(`[API] Polling /api/status/${resultId}`);

      // Fetch status
      const statusResponse = await fetch(
        `${CONFIG.API_BASE_URL}/ebook/status/${resultId}`
      );

      // Handle non-200 responses
      if (!statusResponse.ok) {
        if (statusResponse.status === 404) {
          throw new Error("Result not found - invalid resultId");
        }
        if (statusResponse.status === 410) {
          throw new Error("Result expired");
        }
        consecutiveErrors++;
        console.warn(
          `[API] Polling error ${statusResponse.status}, retry ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}`
        );

        // Exponential backoff: 1s, 2s, 4s, 8s, etc.
        const backoffMs = Math.min(
          1000 * Math.pow(2, consecutiveErrors),
          30000
        );
        await sleep(backoffMs);
        continue;
      }

      // Parse status
      const status = await statusResponse.json();

      // Handle error in response
      if (status.error) {
        consecutiveErrors++;
        console.warn(`[API] Job error: ${status.error}, will retry...`);
        await sleep(5000);
        continue;
      }

      // Reset error counter on successful poll
      consecutiveErrors = 0;
      lastEta = status.eta;

      // Call progress callback
      onProgress(status.status, status.eta, {
        completed: status.calls_completed || 0,
        total: status.calls_total || 0,
        percent: status.progress_percent || 0,
        eta: status.eta || 0,
        message: status.message || `Status: ${status.status}`,
      });

      console.log(
        `[API] Status: ${status.status}, ETA: ${status.eta}s, Progress: ${
          status.progress_percent || 0
        }%`
      );

      // Check if complete
      if (status.status === "complete" || status.status === "success") {
        console.log(`[API] Job complete!`);
        return status;
      }

      // Calculate smart poll interval based on ETA
      const pollInterval = calculatePollInterval(status.eta || 30);
      console.log(`[API] Waiting ${pollInterval}ms before next poll`);

      await sleep(pollInterval);
    } catch (err) {
      consecutiveErrors++;
      console.error(
        `[API] Polling error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`,
        err.message
      );

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error(
          `Polling failed after ${MAX_CONSECUTIVE_ERRORS} consecutive errors: ${err.message}`
        );
      }

      // Exponential backoff for errors
      const backoffMs = Math.min(1000 * Math.pow(2, consecutiveErrors), 30000);
      await sleep(backoffMs);
    }
  }

  throw new Error(`Polling timeout after ${MAX_CONSECUTIVE_ERRORS} errors`);
}

/**
 * Calculate smart polling interval based on ETA
 *
 * Nuances:
 * - Faster polls when close to completion (better UX)
 * - Slower polls when far away (reduce server load)
 * - Minimum 1s (too fast = wasted bandwidth)
 * - Maximum 10s (too slow = poor UX)
 *
 * @param {number} etaSeconds - Estimated seconds to completion
 * @returns {number} Milliseconds to wait before next poll
 */
function calculatePollInterval(etaSeconds) {
  if (etaSeconds === undefined || etaSeconds === null) {
    return 5000; // Default: 5s
  }

  if (etaSeconds < 5) return 1000; // Final phase: 1s polls
  if (etaSeconds < 10) return 2000; // ~10-20s: 2s polls
  if (etaSeconds < 30) return 3000; // ~30s: 3s polls
  if (etaSeconds < 60) return 5000; // ~1m: 5s polls
  return 10000; // >1m: 10s polls (max)
}

/**
 * Utility: Sleep for N milliseconds
 * @param {number} ms - Milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

---

## Part 3: Frontend Implementation - ebookStore.js

### Current generate() Method

**File**: `client/src/stores/ebookStore.js`  
**Lines**: 119-152

### Implementation Strategy

**Key Nuances**:

1. **Progress State Tracking**

   - Add new field: `progress: { completed, total, percent, eta, message }`
   - Update on every polling iteration
   - Reset to 0 on start

2. **Status Transitions**

   - `idle` → `generating` → `composing` → `success`
   - If error → `error` (but don't go back to `idle` until user clicks retry)
   - Progress visible during all "generating" states

3. **Callback Integration**
   - Pass callback to `generateEbook()`
   - Call `update()` for each progress event
   - This triggers reactive UI updates in App.svelte

### Updated generate() Implementation

**Replace** lines 119-152:

```javascript
/**
 * Generate eBook from prompt using current config
 *
 * Nuances:
 * - Passes progress callback to API layer
 * - Updates store on every progress event
 * - Handles both success and error paths
 * - Clears previous result before generating
 *
 * @param {string} prompt - User prompt
 * @returns {Promise<void>}
 */
async generate(prompt) {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error("Prompt cannot be empty");
  }

  // Clear previous result and reset state
  update((store) => ({
    ...store,
    result: null,  // Clear old result
    loading: true,
    error: null,
    status: "generating",
    progress: {
      completed: 0,
      total: 0,
      percent: 0,
      eta: null,
      message: "Starting generation...",
    },
  }));

  try {
    const currentStore = get({ subscribe });

    // Define progress callback
    const handleProgress = (status, eta, progress) => {
      console.log(`[ebookStore] Progress: ${status}, ETA: ${eta}s`);

      update((store) => ({
        ...store,
        status: status === "complete" ? "success" : status,
        progress: {
          completed: progress.completed || 0,
          total: progress.total || 0,
          percent: progress.percent || 0,
          eta: eta || null,
          message: progress.message || `Status: ${status}`,
        },
      }));
    };

    // Call API with progress callback
    const response = await ebookApi.generateEbook(
      {
        prompt,
        theme: currentStore.config.theme,
        pageCount: currentStore.config.pageCount,
        colorPalette: currentStore.config.colorPalette,
        fontSizeScale: currentStore.config.fontSizeScale,
      },
      handleProgress  // Pass callback
    );

    // Log received result
    console.log("[ebookStore] Response received:");
    console.log("[ebookStore] - html present:", !!response.html);
    console.log("[ebookStore] - html length:", response.html?.length || "NULL");
    console.log("[ebookStore] - title:", response.metadata?.title || "UNKNOWN");
    console.log("[ebookStore] - chapters:", response.chapters?.length || 0);

    // Store result with progress cleared
    update((store) => ({
      ...store,
      result: response,
      loading: false,
      status: "success",
      progress: {
        completed: response.chapters?.length || 0,
        total: response.chapters?.length || 0,
        percent: 100,
        eta: 0,
        message: "Complete!",
      },
    }));

  } catch (err) {
    console.error("[ebookStore] Generation error:", err.message);

    update((store) => ({
      ...store,
      result: null,
      loading: false,
      error: err.message,
      status: "error",
      progress: {
        completed: 0,
        total: 0,
        percent: 0,
        eta: null,
        message: `Error: ${err.message}`,
      },
    }));

    // Re-throw for caller to handle
    throw err;
  }
}
```

---

## Part 4: Frontend Implementation - App.svelte

### Current Result Section

**File**: `client/src/App.svelte`  
**Lines**: 130-200

### Implementation Strategy

**Key Nuances**:

1. **Progress Display During Polling**

   - Show while `ebookLoading === true`
   - Display progress percentage
   - Show real-time ETA countdown
   - Update message based on status

2. **Result Display After Completion**

   - Check `ebookResult && ebookResult.html` before rendering
   - Use `{@html}` for HTML content (Svelte directive)
   - Fallback to chapters if HTML missing
   - Never render undefined/null content

3. **Export Button Visibility**
   - Only show when result available
   - Enable when HTML present
   - Show error state if export fails

### Updated Ebook Result Section

**Replace** lines 130-200:

```svelte
{#if $modeStore.current === 'ebook'}
  <div class="phase-b-section">
    <h3>E-book Styling (Phase B)</h3>

    <div class="ebook-controls">
      <div class="control-group">
        <ThemeSelector
          selectedTheme={ebookConfig.theme}
          onChange={(theme) => ebookStore.setTheme(theme)}
        />
      </div>

      <div class="control-group">
        <PageCountSlider
          pageCount={ebookConfig.pageCount}
          onChange={(count) => ebookStore.setPageCount(count)}
        />
      </div>

      {#if ebookResult && ebookResult.html}
        <div class="control-group">
          <OverrideForm
            onApply={(overrides) => ebookStore.applyOverride(overrides, ebookResult.id)}
            isLoading={ebookLoading}
          />
        </div>
      {/if}
    </div>

    <div class="ebook-prompt-form">
      <label for="ebook-prompt">Enter your prompt:</label>
      <textarea
        id="ebook-prompt"
        bind:value={prompt}
        rows="3"
        class="prompt-input"
        placeholder="e.g., A children's mystery tale about a blind mouse detective..."
      ></textarea>
      <button
        class="generate-button"
        on:click={() => ebookStore.generate(prompt)}
        disabled={ebookLoading || !prompt.trim()}
      >
        {ebookLoading ? `Generating eBook... ${ebookProgress?.percent || 0}%` : 'Generate eBook'}
      </button>
    </div>

    <!-- PROGRESS DISPLAY DURING POLLING -->
    {#if ebookLoading}
      <div class="loading-section">
        <div class="progress-container">
          <p class="loading-message">Generating e-book...</p>

          <!-- Progress bar -->
          <div class="progress-bar">
            <div
              class="progress-fill"
              style="width: {ebookProgress?.percent || 0}%"
            ></div>
          </div>

          <!-- Progress details -->
          <div class="progress-details">
            <p class="progress-text">
              {#if ebookProgress?.completed && ebookProgress?.total}
                {ebookProgress.completed}/{ebookProgress.total} calls completed
              {:else}
                Processing...
              {/if}
            </p>

            {#if ebookProgress?.eta !== null && ebookProgress?.eta !== undefined}
              <p class="eta-text">
                Estimated time: {ebookProgress.eta}s remaining
              </p>
            {/if}

            {#if ebookProgress?.message}
              <p class="status-text">{ebookProgress.message}</p>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- ERROR DISPLAY -->
    {#if ebookError}
      <p class="error-message">Error: {ebookError}</p>
    {/if}

    <!-- RESULT DISPLAY -->
    {#if ebookResult && (ebookResult.html || ebookResult.chapters || ebookResult.metadata)}
      <div class="result-section">
        <h4>✅ eBook Generated Successfully!</h4>

        <!-- Metadata summary -->
        {#if ebookResult.metadata}
          <div class="metadata-summary">
            {#if ebookResult.metadata.title}
              <p><strong>Title:</strong> {ebookResult.metadata.title}</p>
            {/if}
            {#if ebookResult.metadata.theme}
              <p><strong>Theme:</strong> {ebookResult.metadata.theme}</p>
            {/if}
            {#if ebookResult.metadata.pageCount}
              <p><strong>Pages:</strong> {ebookResult.metadata.pageCount}</p>
            {/if}
          </div>
        {/if}

        <!-- Export button -->
        <div class="export-button-wrapper">
          <ExportButton
            ebookResult={ebookResult}
            isLoading={ebookLoading}
          />
        </div>

        <!-- HTML Preview -->
        {#if ebookResult.html}
          <div class="preview-container">
            <h5>Preview</h5>
            <div class="ebook-preview">
              {@html ebookResult.html}
            </div>
          </div>
        {:else if ebookResult.chapters && Array.isArray(ebookResult.chapters)}
          <!-- Fallback: Show chapters if HTML missing -->
          <div class="preview-container">
            <h5>Preview (Chapters)</h5>
            <div class="ebook-chapters">
              {#each ebookResult.chapters as chapter (chapter.title)}
                <div class="chapter">
                  <h6>{chapter.title}</h6>
                  <div class="chapter-content">
                    {#if chapter.content}
                      {@html chapter.content}
                    {:else}
                      <p>(No content)</p>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {:else if ebookResult.metadata}
          <!-- Ultimate fallback: Just show theme preview -->
          <div class="preview-container">
            <h5>Preview</h5>
            <ThemePreview
              theme={ebookConfig.theme}
              pageCount={ebookResult.metadata.pageCount || 1}
            />
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .loading-section {
    margin: 2rem 0;
    padding: 1.5rem;
    background: #f5f5f5;
    border-radius: 8px;
    border-left: 4px solid #4CAF50;
  }

  .progress-container {
    width: 100%;
  }

  .progress-bar {
    width: 100%;
    height: 24px;
    background: #e0e0e0;
    border-radius: 12px;
    overflow: hidden;
    margin: 1rem 0;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4CAF50, #45a049);
    transition: width 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 0.75rem;
    font-weight: bold;
  }

  .progress-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: #666;
  }

  .eta-text {
    font-weight: 500;
    color: #4CAF50;
  }

  .metadata-summary {
    background: #f9f9f9;
    padding: 1rem;
    border-radius: 4px;
    margin: 1rem 0;
  }

  .metadata-summary p {
    margin: 0.25rem 0;
    font-size: 0.95rem;
  }
</style>
```

---

## Part 5: Error Handling Patterns

### Network Error During Polling

**Scenario**: Internet drops while polling

**Handling**:

```javascript
// In pollUntilComplete():
try {
  const response = await fetch(...);
  // ... handle response
} catch (err) {
  consecutiveErrors++;
  if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
    console.warn("Network error - will retry with backoff");
  }
  // Exponential backoff continues...
}
```

### Result Not Yet Ready (202)

**Scenario**: Polling returns 202 (still processing)

**Handling**:

```javascript
if (statusResponse.status === 202) {
  // This is OK - job still processing
  const status = await statusResponse.json();
  onProgress(status.status, status.eta, progress);
  await sleep(pollInterval);
  continue;  // Poll again
}
```

### Result Expired (410)

**Scenario**: User generates ebook, waits >24h, then checks status

**Response**: 410 Gone

**Handling**:

```javascript
if (statusResponse.status === 410) {
  throw new Error("Result expired - please generate again");
}
```

### Polling Max Errors

**Scenario**: 10 consecutive polling failures

**Behavior**: Stop polling and throw error

**User Experience**: Show error message with retry button

---

## Part 6: Testing Considerations

### Unit Tests - ebookApi.js

```javascript
test("generateEbook returns 202 and starts polling", async () => {
  // Mock: First fetch returns 202 + resultId
  // Mock: Poll returns "complete"
  // Mock: Result fetch returns full ebook
  // Assert: Returns { html, chapters, metadata }
});

test("calculatePollInterval returns correct values", () => {
  assert(calculatePollInterval(2) === 1000);
  assert(calculatePollInterval(50) === 10000);
});

test("pollUntilComplete handles network errors", async () => {
  // Mock: First 2 polls fail, 3rd succeeds
  // Assert: Continues with exponential backoff
});
```

### Integration Tests - Store + API

```javascript
test("ebookStore.generate updates progress on each poll", async () => {
  // Mock: API calls generateEbook with progress callback
  // Assert: Store progress field updates
  // Assert: Progress goes from 0% to 100%
});

test("ebookStore.generate handles generation error", async () => {
  // Mock: API throws error after max retries
  // Assert: Status becomes "error"
  // Assert: Error message displayed
});
```

### E2E Tests - Full Flow

```javascript
test("User generates 3-page ebook and sees preview", async () => {
  // 1. Fill prompt
  // 2. Click generate
  // 3. Wait for polling (with progress bar visible)
  // 4. Assert HTML preview renders
  // 5. Assert export button is enabled
});
```

---

## Part 7: Debugging Guide

### Enable Debug Logging

**In ebookApi.js**:

```javascript
const DEBUG = true; // Set to true for verbose logging

function log(msg) {
  if (DEBUG) console.log(`[ebookApi] ${msg}`);
}
```

### Common Issues & Solutions

**Issue**: "Missing resultId" error immediately

**Debug**:

```javascript
console.log("Generate response:", generateResponse);
console.log("Type:", typeof generateResponse);
console.log("Status:", generateResponse.status);
```

**Issue**: Polling never completes

**Debug**:

```javascript
// Add in pollUntilComplete:
console.log(`Poll result:`, status);
console.log(`Status field:`, status.status);
console.log(`Is complete?`, status.status === "complete");
```

**Issue**: Progress not updating in UI

**Debug**:

```javascript
// Add in handleProgress callback:
console.log("onProgress called:", { status, eta, progress });

// Check ebookStore subscription:
ebookStore.subscribe((store) => {
  console.log("Store progress:", store.progress);
});
```

---

## Part 8: Rollout Strategy

### Phase 1: Backend Verification (10 min)

- Verify `/api/ebook/result/:resultId` exists
- Check response format matches expected schema
- Add endpoint if missing

### Phase 2: Frontend API Layer (30 min)

- Update `ebookApi.generateEbook()`
- Implement `pollUntilComplete()`
- Test with console logging

### Phase 3: Frontend Store (20 min)

- Update `ebookStore.generate()`
- Add progress state tracking
- Test store updates

### Phase 4: Frontend UI (20 min)

- Add progress bar in App.svelte
- Add error handling display
- Test with mock API

### Phase 5: Integration Testing (30 min)

- E2E test with real backend
- Test error scenarios
- Verify UI updates correctly

---

**Document Status**: Implementation Guide Complete - Ready for Execution  
**Total Est. Time**: ~2.5 hours  
**Complexity**: Medium  
**Risk**: Low (isolated change, not affecting other features)
