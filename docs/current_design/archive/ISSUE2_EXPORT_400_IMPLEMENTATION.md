# Export 400 Error: Implementation Guide

**Date**: December 30, 2025 @ 5:05PM  
**Branch**: `feat/B_Frontend_option2` (documentation)  
**Directory**: `docs/current_design/`

**Implementation Branch**: `feat/export-400-fix` (to be created)  
**Decision**: [ISSUE2_EXPORT_400_FIX.md](ISSUE2_EXPORT_400_FIX.md) - Option 1 selected  
**Visualization**: [ISSUE2_EXPORT_400_VISUALIZATION.md](ISSUE2_EXPORT_400_VISUALIZATION.md) - Export flow diagram  
**Audience**: Backend & Frontend developers

---

## Overview

This guide provides complete code changes to fix the export 400 error by normalizing the `/api/ebook/generate` response to use canonical envelope format.

**Key Principle**: Ensure response uses canonical structure that all downstream consumers (export, persistence, preview) expect.

---

## Architecture: Response Flow

```
genieService.process()
  ├─ Orchestrates generation via services
  ├─ Returns { out_envelope, resultId, metadata }
  │
  └─ Back to endpoint handler
       ├─ Wraps in response envelope
       ├─ Returns canonical structure
       │
       └─ Frontend receives canonical format
            ├─ Consumes out_envelope.pages
            ├─ Calls /export with canonical structure
            └─ exportService validates and generates PDF
```

**Design Principle**:

- **genieService** → orchestrates (delegates to services/utilities)
- **Services** → generation logic only
- **exportService** → utility that handles export (not assigned to service handlers)

---

## File Changes Summary

| File                      | Change Type         | Impact                    | Effort    |
| ------------------------- | ------------------- | ------------------------- | --------- |
| `server/index.js`         | Response wrapper    | Format canonical envelope | 150 lines |
| `client/src/App.svelte`   | Update consumer     | Use out_envelope          | 40 lines  |
| `client/src/lib/api.js`   | Response validation | Expect out_envelope       | 30 lines  |
| `server/exportService.js` | No change           | Already handles canonical | —         |
| `server/genieService.js`  | No change           | Already returns canonical | —         |

---

## 1. Backend: Normalize Response Format

### File: `server/index.js`

**Location**: POST `/api/ebook/generate` endpoint response builder

**Current Code** (lines ~3370-3410):

```javascript
// Current: Non-canonical response
const responseObj = {
  id: ebookId,
  resultId: result.resultId,
  chapters: envelope.pages, // ← Wrong field name
  html: envelope.html || null,
  title: actualTitle,
  metadata: {
    title: actualTitle,
    author: "Aether AI",
    theme,
    pageCount: pageCountNum,
    wordCount: (prompt || "").split(/\s+/).length,
    colorPalette,
    fontSizeScale,
    density,
    ...(envelope.metadata || {}),
  },
  actions: envelope.actions || {
    persist_prompt: true,
    generate_pdf: true,
    can_export: true,
    can_preview: true,
    can_override: true,
  },
};
```

**Fixed Code**:

```javascript
// Fixed: Return canonical envelope at top level
const outEnvelope = {
  pages: envelope.pages, // ← Canonical field name
  html: envelope.html || null,
  metadata: {
    title: actualTitle || "Generated E-book",
    author: "Aether AI",
    theme,
    pageCount: pageCountNum,
    wordCount: (prompt || "").split(/\s+/).length,
    colorPalette,
    fontSizeScale,
    density,
    generatedAt: new Date().toISOString(),
    ...(envelope.metadata || {}),
  },
  actions: envelope.actions || {
    persist_prompt: true,
    generate_pdf: true,
    can_export: true,
    can_preview: true,
    can_override: true,
  },
};

// Response wrapper with canonical envelope
const responseObj = {
  id: ebookId,
  resultId: result.resultId,
  out_envelope: outEnvelope, // ← Canonical structure

  // Legacy fields for backwards compatibility (deprecated)
  chapters: envelope.pages,
  html: envelope.html || null,
  title: actualTitle,
  metadata: outEnvelope.metadata,
  actions: outEnvelope.actions,
};
```

**Change Summary**:

- ✓ Create `outEnvelope` with canonical structure (`pages`, `html`, `metadata`, `actions`)
- ✓ Wrap in response as `out_envelope` field
- ✓ Keep legacy fields for backwards compatibility during transition
- ✓ Ensures export endpoint receives canonical format

---

## 2. Frontend: Update Response Consumer

### File: `client/src/App.svelte`

**Location**: ebook generation success handler (lines ~175-190)

**Current Code**:

```javascript
// Current: Transforms chapters → pages
const { exportToPdf } = await import("./lib/api.js");

// Manual transformation
const exportPayload = {
  pages: ebookResult.chapters || [],
  html: ebookResult.html || null,
  metadata: ebookResult.metadata || {},
  actions: ebookResult.actions || {},
};

await exportToPdf(exportPayload);
```

**Fixed Code**:

```javascript
// Fixed: Use canonical out_envelope directly
const { exportToPdf } = await import("./lib/api.js");

// Canonical envelope from response
const exportPayload = ebookResult.out_envelope || {
  pages: ebookResult.chapters || [], // Fallback for backwards compatibility
  html: ebookResult.html || null,
  metadata: ebookResult.metadata || {},
  actions: ebookResult.actions || {},
};

// Validation guard
if (!Array.isArray(exportPayload.pages) || exportPayload.pages.length === 0) {
  throw new Error(
    "Cannot export: missing or empty pages array. " +
      "Generation may be incomplete. Try again or refresh."
  );
}

await exportToPdf(exportPayload);
```

**Change Summary**:

- ✓ Use `ebookResult.out_envelope` (canonical format) as primary source
- ✓ Fallback to manual transformation for backwards compatibility
- ✓ Add validation to catch empty/malformed pages array
- ✓ Improve error messages to user

---

## 3. Frontend: Update API Response Validation

### File: `client/src/lib/api.js`

**Location**: `submitPrompt()` response handler (lines ~140-170)

**Current Code**:

```javascript
// Current: Expects envelope.pages directly
const envelope = json?.out_envelope;
if (!envelope || !Array.isArray(envelope.pages)) {
  Logger.error("Invalid server response shape", { envelope });
  throw {
    type: "server",
    code: "INVALID_RESPONSE",
    message: "Server response missing canonical out_envelope.pages",
  };
}
```

**Fixed Code**:

```javascript
// Fixed: Handle both new and legacy response formats
let envelope = json?.out_envelope;

// Backwards compatibility: legacy response format
if (!envelope && json?.chapters) {
  Logger.warn(
    "Using legacy response format (chapters instead of out_envelope)",
    {
      hasChapters: !!json.chapters,
      hasOutEnvelope: !!json.out_envelope,
    }
  );

  envelope = {
    pages: json.chapters,
    html: json.html,
    metadata: json.metadata || {},
    actions: json.actions || {},
  };
}

// Validation
if (!envelope || !Array.isArray(envelope.pages)) {
  Logger.error("Invalid server response: missing or empty pages", {
    envelope,
    responseKeys: json ? Object.keys(json) : null,
  });
  throw {
    type: "server",
    code: "INVALID_RESPONSE",
    message:
      "Server response missing pages array. " +
      "Expected: { out_envelope: { pages: [...], ... } }",
  };
}

Logger.info("Response validated", {
  pages: envelope.pages?.length || 0,
  hasHtml: !!envelope.html,
  hasMetadata: !!envelope.metadata,
});
```

**Change Summary**:

- ✓ Accept canonical `out_envelope` format (new)
- ✓ Handle legacy `chapters` format (backwards compatible)
- ✓ Enhanced error messages with debugging info
- ✓ Log format transitions for monitoring

---

## 4. Export Service: Verify Compatibility

### File: `server/exportService.js`

**No changes required** — already handles canonical envelope format.

**Verification** (existing code should handle this):

```javascript
async function generate(envelope, options = {}) {
  if (!envelope || !Array.isArray(envelope.pages)) {
    const e = new Error("Export requires canonical envelope with pages array");
    e.status = 400;
    throw e;
  }

  const generated = await pdfGenerator.generatePdfBuffer({
    envelope,
    validate: !!options.validate,
  });

  return { buffer: generated.buffer, validation: generated.validation };
}
```

**Status**: ✓ Already compatible. Will receive canonical `pages` array from normalized response.

---

## 5. genieService: Verify Export Handling

### File: `server/genieService.js`

**Existing code** (should already support both resultId and content):

```javascript
async export({
  prompt,
  promptId,
  resultId,
  envelope,
  validate = false,
} = {}) {
  const exportService = require("./exportService");

  // Priority 1: Canonical envelope provided directly
  if (envelope && envelope.pages && Array.isArray(envelope.pages)) {
    return exportService.generate(envelope, { validate });
  }

  // Priority 2: Canonical envelope passed as prompt parameter
  if (
    prompt &&
    typeof prompt === "object" &&
    prompt.pages &&
    Array.isArray(prompt.pages)
  ) {
    return exportService.generate(prompt, { validate });
  }

  // Priority 3: Generate from string prompt using process()
  if (prompt && typeof prompt === "string") {
    const processResult = await this.process({
      mode: "basic",
      prompt,
      metadata: {},
      options: {},
    });
    if (processResult && processResult.out_envelope) {
      return exportService.generate(processResult.out_envelope, { validate });
    }
  }

  // Priority 4: Lookup persisted content by ID
  if (promptId || resultId) {
    const persisted = await this.getPersistedContent({ promptId, resultId });
    if (persisted && persisted.content) {
      const contentObj = persisted.content.content || persisted.content;
      if (contentObj && contentObj.pages && Array.isArray(contentObj.pages)) {
        return exportService.generate(contentObj, { validate });
      }
    }
  }

  // No valid export path found
  const e = new Error(
    "Export requires: canonical envelope with pages array, or valid promptId/resultId"
  );
  e.status = 400;
  throw e;
}
```

**Status**: ✓ Already supports both resultId lookup and direct content. No changes needed.

---

## Testing Strategy

### Unit Tests

**File**: `server/__tests__/export-400-fix.test.mjs`

```javascript
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../index.js";

describe("Export 400 Fix: Response Format", () => {
  it("should return canonical out_envelope in ebook response", async () => {
    const response = await request(app)
      .post("/api/ebook/generate")
      .send({
        mode: "ebook",
        prompt: "Test prompt",
        metadata: { pageCount: 3, theme: "light" },
      });

    expect(response.status).toBe(202);
    expect(response.body).toHaveProperty("out_envelope");
    expect(response.body.out_envelope).toHaveProperty("pages");
    expect(Array.isArray(response.body.out_envelope.pages)).toBe(true);
    expect(response.body.out_envelope).toHaveProperty("metadata");
    expect(response.body.out_envelope).toHaveProperty("actions");
  });

  it("should provide backwards compatible legacy fields", async () => {
    const response = await request(app)
      .post("/api/ebook/generate")
      .send({
        mode: "ebook",
        prompt: "Test prompt",
        metadata: { pageCount: 3 },
      });

    expect(response.status).toBe(202);
    // Legacy fields still present
    expect(response.body).toHaveProperty("chapters");
    expect(response.body).toHaveProperty("html");
  });

  it("should allow export with canonical envelope", async () => {
    const envelope = {
      pages: [{ content: "Test chapter 1" }, { content: "Test chapter 2" }],
      html: "<html>...</html>",
      metadata: { title: "Test" },
      actions: {},
    };

    const response = await request(app).post("/export").send(envelope);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(Buffer.isBuffer(response.body)).toBe(true);
  });
});
```

### E2E Test

**File**: `client/__tests__/export-flow.test.mjs`

```javascript
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import App from "../src/App.svelte";

describe("Export Flow: Generate → Export", () => {
  it("should complete full flow: generate → export PDF", async () => {
    render(App);

    // Start generation
    const input = screen.getByPlaceholderText(/enter your prompt/i);
    fireEvent.change(input, { target: { value: "Test story" } });
    fireEvent.click(screen.getByText("Generate"));

    // Wait for completion
    await waitFor(
      () => {
        expect(screen.getByText(/complete/i)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Export should work
    const exportBtn = screen.getByText(/export.*pdf/i);
    expect(exportBtn).not.toBeDisabled();

    fireEvent.click(exportBtn);

    // Verify PDF download triggered
    await waitFor(() => {
      expect(screen.getByText(/exported successfully/i)).toBeInTheDocument();
    });
  });
});
```

### Manual Testing Checklist

- [ ] Generate ebook → verify response has `out_envelope`
- [ ] Verify legacy `chapters` field present for backwards compat
- [ ] Export button enabled after generation completes
- [ ] Click export → PDF downloads successfully
- [ ] Check PDF content matches generated ebook
- [ ] Test with multiple page counts (3, 5, 10, 20)
- [ ] Test with different themes (light, dark)

---

## Deployment Strategy

### Phase 1: Deploy Backend + Frontend (Together)

1. Create branch: `feat/export-400-fix`
2. Implement all changes above
3. Run full test suite
4. Deploy to staging
5. E2E testing on staging
6. Deploy to production

### Phase 2: Monitor & Cleanup

1. Monitor error logs for 400 responses
2. Log legacy format usage (should decrease over time)
3. After 2 weeks, remove legacy fields
4. Simplify response to pure canonical envelope

---

## Rollback Plan

If issues occur:

```javascript
// Quick rollback: revert response format change
const responseObj = {
  id: ebookId,
  resultId: result.resultId,
  chapters: envelope.pages,        // Revert to old field name
  html: envelope.html || null,
  title: actualTitle,
  metadata: {...},
  actions: {...},
};
```

Frontend will automatically use fallback logic:

```javascript
const exportPayload = ebookResult.out_envelope || {
  pages: ebookResult.chapters || [], // Falls back to chapters
  // ...
};
```

---

## Success Criteria

✓ Export 400 error no longer occurs  
✓ Full generate → export flow completes successfully  
✓ PDF contains correct content  
✓ Backwards compatibility maintained during transition  
✓ No increase in response payload size (< 5%)  
✓ Zero export-related errors in production logs

---

## Implementation Branch Instructions

Once ready to implement:

```bash
# Create implementation branch from feat/B_Frontend_option2
git checkout feat/B_Frontend_option2
git pull origin feat/B_Frontend_option2
git checkout -b feat/export-400-fix

# Apply all changes from this guide
# Commit changes
git add -A
git commit -m "fix: Normalize ebook response to canonical envelope format

- Backend: wrap response in out_envelope with pages/html/metadata/actions
- Frontend: consume out_envelope, fallback to legacy chapters for compat
- Export: now receives canonical format, 400 error resolved
- Tests: added unit and E2E tests for export flow"

# Push and create PR against feat/B_Frontend_option2
git push origin feat/export-400-fix
```

---

## Related Documents

- [ISSUE2_EXPORT_400_FIX.md](ISSUE2_EXPORT_400_FIX.md) - Decision rationale & option analysis
- [ISSUES_IDENTIFIED_ISSUE2.md](ISSUES_IDENTIFIED_ISSUE2.md) - Original issue & ADDENDUM
- [Light_3-page_02_AN.md](../design/ebookService/DATA/Light_3-page_02_AN.md) - Root cause analysis
- [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) - Canonical response structure spec
- [CLIENT_SERVER_INTEGRATION.md](CLIENT_SERVER_INTEGRATION.md) - API contract definition
