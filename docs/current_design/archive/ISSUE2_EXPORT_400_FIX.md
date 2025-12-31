# Export 400 Error: Fix Analysis & Decision

**Date**: December 30, 2025 @ 5:05PM  
**Branch**: `feat/B_Frontend_option2`  
**Directory**: `docs/current_design/`

**Issue**: Export endpoint returns 400 when called post-async generation  
**Status**: Implementation Planning (Option A Selected - Clean Break)  
**Visualization**: [ISSUE2_EXPORT_400_VISUALIZATION.md](ISSUE2_EXPORT_400_VISUALIZATION.md) - Complete export flow diagram  
**Implementation**: [ISSUE2_EXPORT_400_IMPLEMENTATION.md](ISSUE2_EXPORT_400_IMPLEMENTATION.md) - Code changes (UPDATED for Option A)  
**Approach**: [ISSUE2_EXPORT_400_APPROACH.md](ISSUE2_EXPORT_400_APPROACH.md) - Decision rationale

---

## Executive Summary

The export mechanism was working in the synchronous `feat/ebook-revert` branch but fails in the async `feat/B_Frontend_option2` architecture. The root cause is a **data format mismatch** between the `/api/ebook/generate` response and what the `/export` endpoint expects.

**Decision**: Implement **Option 1 (Option A: Clean Break)** - Normalize response format at the source to use canonical envelope structure **without backwards compatibility support**.

**Rationale**:

- Clean, maintainable code path
- Single format expected throughout architecture
- No fallback logic reduces cognitive load
- No legacy field duplication
- Branch is not yet shipped to production, so no compatibility debt to carry

---

## The Problem

### Async Architecture Response Pattern

```
POST /api/ebook/generate
↓
202 Accepted (resultId, status: "QUEUED")
↓
Client polls /api/ebook/status/:resultId
↓
Frontend fetches /api/ebook/result/:resultId
↓
Receives response with "chapters" field
↓
Frontend transforms: chapters → pages
↓
Frontend POSTs to /export with transformed data
↓
Export endpoint validates: Array.isArray(envelope.pages)
↓
❌ FAILS if pages array is empty/malformed
```

### Synchronous Architecture (Working in feat/ebook-revert)

```
POST /api/ebook/generate
↓
200 OK (full result immediately)
↓
Response includes "chapters": [...]
↓
Frontend has complete data immediately
↓
Frontend POSTs to /export
↓
Export endpoint receives canonical envelope
↓
✓ SUCCESS
```

---

## Root Cause

The async generation endpoint returns:

```javascript
{
  id: ebookId,
  resultId: uuid,
  chapters: envelope.pages,    // ← Non-canonical field name
  html: envelope.html,
  metadata: {...},
  actions: {...}
}
```

The export endpoint expects:

```javascript
{
  pages: [...],                 // ← Canonical field name
  html: '...',
  metadata: {...},
  actions: {...}
}
```

**Frontend transformation** (`chapters` → `pages`) is incomplete or unreliable, causing the export endpoint validation to fail.

---

## Three Options Analyzed

### Option 1: Normalize Response Format at Source ✓ SELECTED

**Location**: `/api/ebook/generate` endpoint response builder

**Change**:

```javascript
// Return canonical envelope structure that all downstream consumers expect
const response = {
  id: ebookId,
  resultId: result.resultId,
  out_envelope: {              // ← Wrap in canonical structure
    pages: envelope.pages,
    html: envelope.html,
    metadata: {...},
    actions: {...}
  },
  // Keep legacy fields for backwards compatibility
  chapters: envelope.pages,    // deprecated
  html: envelope.html
};
```

**Pros**:

- ✅ Single source of truth
- ✅ All consumers receive canonical format
- ✅ Eliminates transformation logic in frontend
- ✅ Prevents future similar issues
- ✅ Aligns with documented architecture (CLIENT_SERVER_INTEGRATION.md)
- ✅ Export endpoint validation works without changes

**Cons**:

- ⚠️ Slightly larger response payload
- ⚠️ Requires frontend update to consume `out_envelope`

**Effort**: 2-3 hours (response format + frontend integration)

---

### Option 2: Defensive Export Endpoint Normalization

**Location**: `/export` endpoint request handler

**Change**:

```javascript
app.post("/export", async (req, res) => {
  let envelope = req.body || {};

  // Normalize both async and sync response formats
  if (envelope.chapters && !envelope.pages) {
    envelope = {
      pages: envelope.chapters,
      html: envelope.html,
      metadata: envelope.metadata,
      actions: envelope.actions,
    };
  }

  // Proceed with validation
  if (!Array.isArray(envelope.pages)) {
    return sendValidationError(res, "Export requires pages array");
  }
  // ... export logic
});
```

**Pros**:

- ✅ Backwards compatible (handles both formats)
- ✅ Minimal changes (single file)
- ✅ Works immediately without frontend changes

**Cons**:

- ❌ Band-aid solution (masks deeper issue)
- ❌ Export endpoint becomes aware of frontend response shape
- ❌ Doesn't prevent other consumers from receiving wrong format
- ❌ Technical debt (transformation logic in wrong place)

**Effort**: 1 hour (localized change)

---

### Option 3: Stronger Frontend Validation & Transformation

**Location**: `client/src/App.svelte` (export button handler)

**Change**:

```javascript
// Defensive transformation with validation
const exportPayload = {
  pages: Array.isArray(ebookResult.chapters) ? ebookResult.chapters : [],
  html: ebookResult.html || null,
  metadata: ebookResult.metadata || {},
  actions: ebookResult.actions || {},

  // Guard against empty arrays
  _validation: {
    pageCount: ebookResult.chapters?.length || 0,
  },
};

if (!Array.isArray(exportPayload.pages) || exportPayload.pages.length === 0) {
  throw new Error("Export data incomplete");
}

await exportToPdf(exportPayload);
```

**Pros**:

- ✅ Defensive programming
- ✅ Better error messages to user
- ✅ Doesn't require backend changes

**Cons**:

- ❌ Frontend owns responsibility for data format (wrong layer)
- ❌ Doesn't fix root cause (mismatch at source)
- ❌ Other API consumers (mobile, integrations) still receive wrong format

**Effort**: 1.5 hours (frontend validation logic)

---

## Decision: Option 1

### Why Option 1 is Correct

1. **Architecture Alignment**: BACKEND_ARCHITECTURE.md and CLIENT_SERVER_INTEGRATION.md specify canonical envelope structure (`out_envelope` containing `pages`, `metadata`, `actions`)

2. **No Cascading Issues**: All downstream consumers (export, preview, persistence) receive canonical format by default

3. **Frontend Simplification**: Frontend consumes `out_envelope.pages` directly without transformation logic

4. **Future-Proof**: Adding new features (PDF generation, preview rendering) automatically gets correct format

5. **API Contract**: Establishes clear contract for `/api/ebook/generate` response shape

### Implementation Summary

**Files to Modify**:

1. `server/index.js` - POST /api/ebook/generate endpoint
2. `client/src/App.svelte` - Update to consume `out_envelope`
3. `client/src/lib/api.js` - Update response validation

**Response Format Change**:

```javascript
// OLD (async, non-canonical):
{
  id, resultId, chapters, html, metadata, actions
}

// NEW (async, canonical):
{
  id, resultId,
  out_envelope: { pages, html, metadata, actions },
  // Legacy fields for backwards compatibility
  chapters, html
}
```

**Backend Changes**: ~150 lines (response wrapper)  
**Frontend Changes**: ~80 lines (consume out_envelope)  
**Testing**: E2E test for full generate → export flow

---

## Migration Path

### Phase 1 (Immediate)

- Return canonical `out_envelope` in response
- Keep legacy `chapters`, `html` fields for backwards compatibility
- Frontend updates to use `out_envelope.pages` (primary) with fallback to `chapters`

### Phase 2 (Future)

- Remove legacy fields once all clients updated
- Simplify response to pure canonical envelope

---

## Implementation

Detailed code samples, affected files, and testing strategy are in [ISSUE2_EXPORT_400_IMPLEMENTATION.md](ISSUE2_EXPORT_400_IMPLEMENTATION.md).

---

## Expected Outcome

```
POST /api/ebook/generate
↓
202 Accepted (resultId, status: "QUEUED")
↓
Client polls /api/ebook/status/:resultId
↓
Frontend receives /api/ebook/result/:resultId
  {
    out_envelope: {
      pages: [...],           ← Canonical format
      html: '...',
      metadata: {...},
      actions: {...}
    }
  }
↓
Frontend POSTs to /export with out_envelope.pages
↓
Export endpoint validates canonical structure
↓
✓ PDF generation succeeds
```

---

**Next Steps**: Review [ISSUE2_EXPORT_400_IMPLEMENTATION.md](ISSUE2_EXPORT_400_IMPLEMENTATION.md) for code changes. Implementation branch will be created to execute these changes.
