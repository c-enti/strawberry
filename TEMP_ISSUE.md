# TEMP_ISSUE: Backend Readiness Endpoint Implementation

## Goal

Replace the fixed sleep in the startup script with a robust readiness check, so the frontend only starts when the backend is truly ready to serve requests.

---

## Stepwise Actionables

### Step 1: Add a /ready Endpoint to the Backend

- [ ] Implement a new `/ready` endpoint in the Express app (`server/app.ts`).
- [ ] The endpoint should check PostgreSQL connectivity (e.g., run `SELECT 1`).
- [ ] Return 200 if the DB is reachable, 503 otherwise.

### Step 2: Update Startup Script to Use /ready

- [ ] In `start-app.sh`, replace the current curl loop (which waits for `/`) with a loop that waits for `/ready` to return 200.
- [ ] Remove the fixed sleep after backend startup.

### Step 3: (Optional, Future) Expand Readiness Checks

- [ ] Add Prisma client/schema checks to `/ready` if needed.
- [ ] Add checks for other dependencies (e.g., Redis, external APIs) if present.

### Step 4: Remove TEMP_ISSUE When Complete

- [ ] Delete this file after all steps are implemented and verified.

---

## Notes

- Keep each step small and testable.
- Commit after each step for easy rollback.
- This will make the dev workflow more reliable and robust.
