# ISSUE 2: eBook Delivery - Fix Assessment

**Date**: December 31, 2025 @ 12:25PM

**Reference**: ISSUE2_EBOOK_DELIVERY_FINAL_E2E_ANALYSIS.md  
**Status**: Ready for Implementation

---

## Corrective Assessment

The eBook delivery failure is a **frontend-backend protocol mismatch** where:

- Backend correctly implements **async 202 + polling pattern** (Pattern 1 + Pattern 5)
- Frontend **does not implement** the corresponding polling consumer

### Fix Strategy: Three Layers

---

## Layer 1: Verify Backend Result Endpoint

**Requirement**: GET `/api/ebook/result/:resultId` must exist and return full ebook

**Current Status**: Unknown - needs verification

**What It Should Return**:

```json
{
  "resultId": "abc-123-uuid",
  "id": "ebook_timestamp_randomId",
  "html": "<!DOCTYPE html>... (full rendered document)",
  "chapters": [
    {
      "title": "Chapter 1",
      "content": "HTML formatted content"
    },
    {
      "title": "Chapter 2",
      "content": "HTML formatted content"
    }
  ],
  "metadata": {
    "title": "Generated eBook Title",
    "author": "Aether AI",
    "theme": "dark",
    "pageCount": 10,
    "wordCount": 5000,
    "colorPalette": "standard",
    "fontSizeScale": 1.0,
    "density": "standard"
  },
  "actions": {
    "persist_prompt": true,
    "generate_pdf": true,
    "can_export": true,
    "can_preview": true,
    "can_override": true
  }
}
```

**How It Gets Stored**:

- Backend's genieService.process() generates content
- Result is stored via `smartPoller.markComplete(resultId, result)`
- Polling endpoint (/api/status/:resultId) confirms status === "complete"
- Result endpoint (/api/ebook/result/:resultId) retrieves stored result

**Verification Task**:

1. Check if `/api/ebook/result/:resultId` endpoint exists in server/index.js
2. Check what format it currently returns
3. If missing or wrong format: Create/update endpoint to return canonical structure

---

## Layer 2: Update Frontend ebookApi.generateEbook()

**Current Behavior** (BROKEN):

```javascript
export async function generateEbook(payload) {
  return fetchWithTimeout(
    `${CONFIG.API_BASE_URL}/ebook/generate`,
    { method: "POST", body: JSON.stringify(payload) },
    CONFIG.TIMEOUTS.GENERATE
  );
  // Returns: { resultId, status: "queued", message: "..." }
}
```

**Required Behavior** (FIXED):

The function must:

1. **Step 1: POST and Get 202 + resultId**

   ```javascript
   const response = await fetchWithTimeout(...);
   if (response.status === 202) {
     resultId = response.resultId;
   }
   ```

2. **Step 2: Poll /api/status/:resultId**

   ```
   Loop until status === "complete":
     GET /api/status/{resultId}
     Return: { status, progress, eta, message }
     Wait based on ETA (smart backoff)
     On complete: exit loop
   ```

3. **Step 3: Fetch Full Result**
   ```javascript
   const fullResult = await fetchWithTimeout(`/api/ebook/result/${resultId}`, {
     method: "GET",
   });
   return fullResult;
   // Returns: { html, chapters, metadata, actions, ... }
   ```

**New Function Signature**:

```javascript
export async function generateEbook(payload, onProgress) {
  // payload: { prompt, theme, pageCount, ... }
  // onProgress: callback(status, eta, progress) for UI updates
  // returns: full ebook result with { html, chapters, metadata }
}
```

---

## Layer 3: Update Frontend ebookStore.js

**Current generate() Method** (BROKEN):

```javascript
async generate(prompt) {
  update(store => ({ ...store, loading: true }));

  const response = await ebookApi.generateEbook({ prompt, ... });

  update(store => ({
    ...store,
    result: response,  // Gets empty 202 response
    loading: false
  }));
}
```

**Required generate() Method** (FIXED):

```javascript
async generate(prompt) {
  update(store => ({
    ...store,
    loading: true,
    status: "generating",
    progress: { completed: 0, total: 0, percent: 0, eta: null }
  }));

  const result = await ebookApi.generateEbook(
    { prompt, theme, pageCount, ... },
    // onProgress callback
    (status, eta, progress) => {
      update(store => ({
        ...store,
        status: status,  // "queued", "processing", "composing", "complete"
        progress: progress,  // { completed, total, percent, eta }
      }));
    }
  );

  update(store => ({
    ...store,
    result: result,  // Full ebook with html, chapters, metadata
    loading: false,
    status: "success"
  }));
}
```

---

## Layer 4: Update Frontend UI (App.svelte)

**Required Changes**:

1. **Show Progress During Polling**

   ```svelte
   {#if ebookLoading}
     <div class="progress-container">
       <p>Generating e-book...</p>
       <div class="progress-bar">
         <div class="progress" style="width: {ebookProgress?.percent || 0}%"></div>
       </div>
       {#if ebookProgress?.eta}
         <p>Est. time remaining: {ebookProgress.eta}s</p>
       {/if}
       <p>{ebookProgress?.message || 'Processing...'}</p>
     </div>
   {/if}
   ```

2. **Display HTML When Available**
   ```svelte
   {#if ebookResult && ebookResult.html}
     <div class="preview-container">
       <h5>Preview</h5>
       <div class="ebook-preview">
         {@html ebookResult.html}
       </div>
     </div>
   {/if}
   ```

---

## Error Handling Requirements

### Network Errors During Polling

**Scenario**: Network timeout while polling /api/status/:resultId

**Current**: No handling  
**Required**:

- Exponential backoff: retry with increasing delays
- Max 10 consecutive errors before giving up (Pattern 5)
- Display user-friendly error message
- Offer "Retry" or "Check Status" button

### Result Expired

**Scenario**: User comes back after >24 hours

**Response**: 410 Gone

```json
{
  "error": "RESULT_EXPIRED",
  "message": "Result expired after 24 hours",
  "expiresAt": "2025-01-16T10:30:45.123Z"
}
```

**Required Handling**:

- Catch 410 status
- Show: "Result expired. Please generate again."
- Reset form

### Job Failed During Generation

**Scenario**: Gemini API error, quota exhausted, etc.

**Response**: Polling returns status: "failed"

```json
{
  "status": "failed",
  "error": {
    "code": "QUOTA_EXHAUSTED",
    "message": "API quota exhausted",
    "retryable": true,
    "retryAfterSeconds": 4
  }
}
```

**Required Handling**:

- Detect status === "failed"
- Display error with retryable flag
- Offer retry if retryable === true

### Validation Errors (400)

**Scenario**: Invalid theme, pageCount, prompt

**Response**: 400 Bad Request (pre-202)

```json
{
  "error": "Invalid theme. Must be one of: dark, light, corporate, bold"
}
```

**Current**: Handled by fetchWithTimeout  
**Required**: No change needed (already working)

---

## Polling Algorithm Requirements

**Smart Backoff Strategy** (from Pattern 5):

| ETA Range     | Poll Interval | Rationale                        |
| ------------- | ------------- | -------------------------------- |
| < 5 seconds   | 1 second      | Quick final polls                |
| 5-10 seconds  | 2 seconds     | Moderate speed                   |
| 10-30 seconds | 3-5 seconds   | Balance bandwidth/responsiveness |
| > 30 seconds  | 10 seconds    | Reduce server load               |

**Implementation** (pseudocode):

```javascript
function calculatePollInterval(etaSeconds) {
  if (etaSeconds < 5) return 1000;
  if (etaSeconds < 10) return 2000;
  if (etaSeconds < 30) return Math.min(5000, etaSeconds * 100);
  return 10000;
}

async function pollUntilComplete(resultId, onProgress) {
  let consecutiveErrors = 0;
  const maxErrors = 10;

  while (consecutiveErrors < maxErrors) {
    try {
      const status = await fetch(`/api/status/${resultId}`);

      if (status.error) {
        // Polling error - increment counter
        consecutiveErrors++;
        await sleep(1000 * consecutiveErrors); // Exponential backoff
        continue;
      }

      consecutiveErrors = 0; // Reset on success

      onProgress(status.status, status.eta, {
        completed: status.calls_completed,
        total: status.calls_total,
        percent: status.progress_percent,
        eta: status.eta,
        message: status.message,
      });

      if (status.status === "complete") {
        return status;
      }

      const interval = calculatePollInterval(status.eta);
      await sleep(interval);
    } catch (err) {
      consecutiveErrors++;
      // Continue polling with backoff
    }
  }

  throw new Error("Polling failed after 10 consecutive errors");
}
```

---

## Data Flow After Fix

```
User Input
  ↓
POST /api/ebook/generate (payload)
  ↓ (< 2ms)
202 Accepted + { resultId }
  ↓
Frontend: ebookApi.generateEbook() extracts resultId
  ↓
Frontend: Poll loop starts
  ├─ GET /api/status/{resultId}
  │  ├─ Return: { status: "queued", eta: 52s }
  │  └─ UI shows: "Queued, ~52s remaining"
  │
  ├─ GET /api/status/{resultId} (after 5s)
  │  ├─ Return: { status: "processing", eta: 45s, progress: 1/10 }
  │  └─ UI shows: "Processing, 10%, ~45s remaining"
  │
  ├─ GET /api/status/{resultId} (repeats until complete)
  │
  └─ GET /api/status/{resultId}
     ├─ Return: { status: "complete", eta: 0 }
     └─ UI shows: "Complete"
  ↓
Frontend: Fetch result
  ├─ GET /api/ebook/result/{resultId}
  └─ Return: { html, chapters, metadata, ... }
  ↓
Frontend: Display result
  ├─ Set ebookResult = fullEbook
  ├─ Update ebookStore
  └─ App.svelte renders preview
  ↓
User sees: HTML preview + Export button (responsive)
```

---

## Acceptance Criteria

### Backend

- [ ] `/api/ebook/result/:resultId` endpoint exists and returns full ebook
- [ ] Response includes: html, chapters, metadata, actions
- [ ] 404 for missing resultId
- [ ] 410 for expired resultId (>24h)

### Frontend

- [ ] `generateEbook()` handles 202 response correctly
- [ ] Polling loop implemented with smart backoff
- [ ] Progress callback works for UI updates
- [ ] Returns full ebook result after polling completes
- [ ] Errors during polling handled with exponential backoff

### UI

- [ ] Progress bar/message shown during polling
- [ ] ETA displayed and updates in real-time
- [ ] HTML preview renders once complete
- [ ] Export button becomes responsive
- [ ] Error messages clear and actionable

### E2E

- [ ] User generates 3-page ebook
- [ ] Sees progress during generation (~50s)
- [ ] Gets HTML preview after completion
- [ ] Export button works without error

---

## Timeline & Complexity

| Layer | Task                              | Complexity | Est. Time |
| ----- | --------------------------------- | ---------- | --------- |
| 1     | Verify /api/ebook/result endpoint | Low        | 10min     |
| 2     | Update ebookApi.generateEbook()   | Medium     | 30min     |
| 3     | Update ebookStore.generate()      | Medium     | 20min     |
| 4     | Update App.svelte UI              | Low        | 20min     |
| 5     | Error handling + edge cases       | Medium     | 30min     |
| 6     | Test end-to-end                   | Medium     | 20min     |

**Total Est.**: ~2.5 hours

---

## Risk Assessment

| Risk                           | Probability | Impact | Mitigation                   |
| ------------------------------ | ----------- | ------ | ---------------------------- |
| Result endpoint missing        | Medium      | High   | Verify in Layer 1            |
| Polling timeout                | Low         | Medium | Max errors counter           |
| Race condition on result fetch | Low         | Medium | Include resultId in response |
| Progress updates too frequent  | Low         | Low    | Smart backoff algorithm      |

---

**Document Status**: Assessment Complete - Ready for Implementation  
**Next Document**: ISSUE2_EBOOK_DELIVERY_IMPLEMENTATION.md
