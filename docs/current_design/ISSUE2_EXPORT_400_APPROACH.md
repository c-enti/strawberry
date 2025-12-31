# Export 400 Fix: Implementation Approach Decision

**Date**: December 30, 2025 @ 6:35PM
**Branch**: `feat/B_Frontend_option2` (documentation)  
**Directory**: `docs/current_design/`

**Decision**: Option A - Clean Break (No Backwards Compatibility)  
**Status**: Approved - Ready for Implementation in `feat/export-400-fix_02`

---

## Decision Summary

After initial implementation with backwards compatibility support (preserved in `feat/export-400-fix`), the team decided to pursue **Option A: Clean Break** for the refined implementation in `feat/export-400-fix_02`.

### Option A: Clean Break (SELECTED)

- Backend sends **only** `out_envelope` with canonical structure
- Frontend expects **only** `out_envelope` with `pages` field
- No fallback logic, no legacy field duplication
- Simple, maintainable code path
- Single format contract throughout architecture

### Why Option A Was Chosen

1. **Branch Lifecycle**: `feat/B_Frontend_option2` has not shipped to production

   - No external clients to break
   - No deployed versions to maintain compatibility with
   - Clean slate opportunity

2. **Code Simplicity**: No fallback/legacy handling reduces:

   - Cognitive load during debugging
   - Test complexity (no "both formats" scenarios)
   - Support burden (one format = one truth)

3. **Architectural Clarity**: Single data contract means:

   - No branching logic in consumers
   - Clear validation expectations
   - Easier to reason about data flow

4. **Prevention**: Avoids creating backwards compatibility debt that must be carried forward

---

## Implementation Scope Change

### Original Implementation (`feat/export-400-fix`) - Historical

✅ Created with backwards compatibility:

- Backend returns both `out_envelope` AND `chapters`
- Frontend falls back to `chapters` if `out_envelope` missing
- API validation handles both formats
- Tests include "legacy format" scenarios (41 tests)

**Status**: Committed and pushed as historical record

### New Implementation (`feat/export-400-fix_02`) - Streamlined

Will implement Option A:

- Backend returns **only** `out_envelope`
- Frontend expects **only** canonical structure
- No fallback/transformation logic
- Cleaner code, fewer tests (only canonical path)
- No legacy field duplication

---

## Changes Required

### Backend: `server/index.js`

```javascript
// CLEAN: No chapters field, only canonical
const responseObj = {
  id: ebookId,
  resultId: result.resultId,
  out_envelope: {
    pages: envelope.pages,
    html: envelope.html || null,
    metadata: {...},
    actions: {...},
  },
};
```

### Frontend: `client/src/App.svelte`

```javascript
// CLEAN: Direct access, no fallback
const exportPayload = ebookResult.out_envelope;

// Validate pages exists
if (!Array.isArray(exportPayload.pages) || exportPayload.pages.length === 0) {
  throw new Error("Cannot export: missing or empty pages array");
}
```

### API: `client/src/lib/api.js`

```javascript
// CLEAN: Only canonical format expected
const envelope = json?.out_envelope;
if (!envelope || !Array.isArray(envelope.pages)) {
  throw {
    code: "INVALID_RESPONSE",
    message: "Server response missing out_envelope.pages",
  };
}
```

---

## Test Coverage Changes

### Historical Branch (`feat/export-400-fix`)

- 41 tests (including legacy format scenarios)
- Covers backwards compatibility paths
- Tests for format transformation

### New Branch (`feat/export-400-fix_02`)

- ~25-30 tests (canonical path only)
- No legacy format handling tests
- Cleaner, focused test suite
- All tests verify single canonical contract

---

## Migration Path

Since this is not yet deployed, the migration is simple:

1. ✅ Commit historical implementation (`feat/export-400-fix`)
2. ✅ Update documentation with Option A decision
3. ✅ Create new branch (`feat/export-400-fix_02`)
4. ✅ Implement clean version
5. ✅ Review and merge to `feat/B_Frontend_option2`

No runtime migration, no compatibility layer needed.

---

## Related Documentation

- **Historical**: [feat/export-400-fix](../../../) - Initial implementation with backwards compat (preserved for reference)
- **Implementation Guide**: [ISSUE2_EXPORT_400_IMPLEMENTATION.md](ISSUE2_EXPORT_400_IMPLEMENTATION.md) (will be updated for \_02)
- **Architecture**: [ISSUE2_EXPORT_400_FIX.md](ISSUE2_EXPORT_400_FIX.md) (updated with Option A decision)
- **Visualization**: [ISSUE2_EXPORT_400_VISUALIZATION.md](ISSUE2_EXPORT_400_VISUALIZATION.md)

---

**Decision Made**: December 30, 2025  
**Branch**: `feat/export-400-fix_02` (to be created)  
**Status**: Ready for implementation
