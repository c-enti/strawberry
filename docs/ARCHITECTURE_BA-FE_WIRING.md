# Architecture: Backend-Frontend Wiring Issue

**Date**: January 2, 2026 @ 10:15AM
**Branch**: `feat/B_Frontend_option2`

**Status**: Brainstorming / Planning  
**Context**: Backend refresh broke the content→display→export flow

---

## Diagnosis

**What works:**

- Backend generates content successfully
- User receives `resultId` from 202 response
- Frontend polls `/api/status/:resultId` for progress

**What's broken:**

- Generated content never reaches frontend for display
- Export functionality unreachable
- User sees "complete" but no content and no export button

**Root cause**: No mechanism to retrieve and deliver generated content after completion.

---

## The Gap

**Backend stores result via:**

```javascript
smartPoller.markComplete(resultId, result); // Line 3000
// result = { pages, html, metadata }
```

**Frontend sees only:**

```javascript
GET /api/status/:resultId
// Returns: { status, eta, progress }
// ← Missing: The actual content!
```

**Missing link**: No endpoint to retrieve result after completion.

---

## Desired Flow

```
1. POST /api/ebook/generate → returns 202 + resultId
2. Frontend polls GET /api/status/:resultId
3. When status === "complete":
   ├─ GET /api/result/:resultId ← [MISSING]
   ├─ Display in preview
   └─ Show export button
4. User clicks export → POST /api/export { resultId }
```

---

## Key Issues to Address

| Issue                 | Current State                     | Missing                            |
| --------------------- | --------------------------------- | ---------------------------------- |
| **Content Retrieval** | No endpoint for completed content | `GET /api/result/:resultId`        |
| **Data Persistence**  | In-memory only (smartPoller)      | Database storage for restarts      |
| **Frontend Logic**    | Polls status only                 | Logic to fetch & display content   |
| **Export Wiring**     | Export endpoints exist            | Integration with retrieved content |
| **Error Handling**    | No recovery mechanism             | What happens on failures?          |

---

## Solution Approaches

### **Option A: In-Memory (Quickest)**

- Add `GET /api/result/:resultId` (returns from smartPoller cache)
- Update frontend to fetch + display
- **Pro**: Fast to implement
- **Con**: Data lost on server restart

### **Option B: Database (Robust)**

- Persist results to database when `markComplete()` called
- `GET /api/result/:resultId` queries DB
- **Pro**: Production-ready, survives restarts
- **Con**: DB migration needed

### **Option C: Hybrid (Best)**

- In-memory cache for recent results
- Persist to DB after TTL
- Retrieval checks cache first, then DB
- **Pro**: Fast + durable
- **Con**: Cache invalidation complexity

---

## Frontend Integration Points

### Missing Frontend Code

**In GenerateFlow.svelte** (when status === "complete"):

```javascript
// ← ADD THIS
const result = await fetch(`/api/result/${resultId}`).then((r) => r.json());
// result = { pages, html, metadata }

showPreview(result.html);
enableExportButton(() => exportContent(resultId));
```

### Current State

- ✅ Classification works
- ✅ Generation call works
- ✅ Polling works
- ❌ Content display missing
- ❌ Export integration missing

---

## Questions for Discussion

1. **Persistence Model**

   - Should content survive server restarts?
   - How long should resultId remain valid? (session / 24h / permanent?)

2. **Export Strategy**

   - Backend retrieves + exports? Or frontend sends HTML directly?
   - What format? (PDF only, or also HTML/DOCX?)

3. **Data Isolation**

   - Multiple concurrent users with different results?
   - Current smartPoller is global—is that sufficient?

4. **Error Recovery**

   - If generation fails mid-way, can user retry?
   - Should partial results be recoverable?

5. **Performance**
   - Cache strategy for high volume?
   - Max result lifetime before auto-cleanup?

---

## Recommended Next Steps

1. **Immediate** (verify flow works):

   - Implement Option A (in-memory retrieval endpoint)
   - Add frontend logic to display content
   - Test end-to-end generation→display→export

2. **Follow-up** (production ready):
   - Evaluate Option B or C based on scale
   - Implement persistence layer
   - Update retrieval endpoint to use DB

---

**Document Status**: Planning Phase  
**Next Action**: Decision on Option A/B/C + branch creation for implementation
