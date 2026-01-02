# Architecture Conform: Issue #01

**Date**: January 2, 2026  @ 11:05AM
**Branch**: `feat/B_Frontend_option2`

**Title**: HTTP Handler Result Capture & Delivery  
**Status**: Specification Gap  
**Severity**: Critical (blocks frontend content display)

---

## The Nuance

The design specifies that:

1. ✅ genieService.process() executes service and **returns result**
2. ✅ genieService marks smartPoller.markComplete(resultId, result)
3. ❌ **Missing**: HTTP handler captures and stores result for frontend delivery

---

## Current Code Gap

**server/index.js** (lines ~3000):

```javascript
genieService
  .process({ resultId, ... })
  .then((result) => {
    smartPoller.markComplete(resultId, result);
    // ← Result is here but not captured/stored
  });
```

---

## Required Addition

HTTP handler must store result for frontend retrieval:

```javascript
genieService
  .process({ resultId, ... })
  .then((result) => {
    // Design already handles: smartPoller.markComplete() + persistence
    // Missing: Store for immediate/later retrieval
    genieService.storeResult(resultId, result);
  });
```

---

## Solution

Add to genieService:

- `storeResult(resultId, result)` — cache result keyed by resultId
- `getResult(resultId)` — retrieve result for HTTP handler delivery

Add HTTP endpoint:

- `GET /api/result/:resultId` — returns `{ status, content: { pages, html, metadata } }`

Frontend then gets complete content packet when it polls or requests result.

---

## Scope

- **Backend**: genieService result cache management + HTTP retrieval endpoint
- **Frontend**: No changes (already knows what to do with content)
- **Persistence**: Use existing pattern (database or in-memory)

---

**Next**: ARCHITECTURE_CONFORM_03 (Service manifest enforcement)
