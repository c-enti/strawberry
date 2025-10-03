# PATH_FORWARD_CHECKLIST — dv01

Document Version: dv01
Datetime: 2025-09-30 10:40 UTC
Branch: aether-rewrite/client

Purpose

This checklist turns `PATH_FORWARD_dv01` into a concrete, time-estimated set of tasks and verification steps for the `client-v2` rewrite. Each item has a clear acceptance criterion and a time estimate. Work top→down and add one-line verification notes (commit hash / PR) when an item is completed.

Guiding Principle

- Continuous visual verification: `client-v2` must be visually tested and verified at all times. Visual parity or acceptable enhancement of the Preview and Export flows is required before advancing phases.

Overview & Total Estimate

- Prep + Phases 1–5 + Cleanup: Estimated 10–14 days (conservative)
- Detailed breakdown below includes per-phase estimates and subtask timeboxes.

## Phase 0 — Preparation (Estimate: 0.5 - 1 day) ✅ Done

**↦** In branch `aether-rewrite/client-phase0`

Core Tasks:

- [x] Create `client-v2/` skeleton (Vite + Svelte)
  - Estimate: 2-3 hours
  - Acceptance: `client-v2` dev server runs locally and serves default page
  - Verification: commit `2bce478`, `c23d43d`
- [x] Add feature-flag routing + single-route toggle (server-side proxy)
  - Estimate: 1-2 hours
  - Acceptance: toggle `/preview` to `client-v2` via env flag and proxy URL
  - Verification: commit `015fcfe`, PR #2
- [x] Devcontainer / Docker-compose check for new port(s) (optional)
  - Estimate: 1-3 hours (only if necessary)
  - Acceptance: devcontainer builds and forwarding works
  - Verification: Port 5174 configured in devcontainer.json with label and preview settings

Verification Evidence:

- [x] Server-side proxy implementation:
  - Added to `server/index.js` with feature flags
  - Integration test: `server/__tests__/preview.client-v2-proxy.test.js`
  - Commit `015fcfe`, PR #2
- [x] Client-v2 implementation:
  - Dev server runs on port 5174 with default page
  - Basic unit test added and passing under jsdom
  - Quick-start added to README.md
  - Commits `2bce478`, `c23d43d`

Remaining Phase 0 Tasks:

1. Devcontainer automation (completed):
   - ✓ Port forwarding configured (port 5174)
   - ✓ Manual port forwarding method set for deterministic behavior
2. CI Integration:
   - ✓ Add workflow to run client-v2 tests on PRs
   - ✓ Configure branch protection

## Phase 1 — Preview Pipeline (store + preview) (Estimate: 2 - 3 days) 🟩 In-process

**↦** In branch `aether-rewrite/client-phase1`

- [ ] Implement store adapter / shared types in `client-v2`
  - Estimate: 4-8 hours
  - Acceptance: unit tests for adapter pass. Verification: commit/PR `________`
- [ ] Recreate Preview page UI using canonical template
  - Estimate: 6-12 hours
  - Acceptance: preview renders same content given sample payload. Visual snapshot created. Verification: commit/PR `________`
- [ ] Add Vitest unit tests for store & preview logic
  - Estimate: 2-4 hours
  - Acceptance: `npm --prefix client-v2 test` passes locally. Verification: commit/PR `________`
- [ ] Add visual snapshots (DOM or image) and integrate into PR checks
  - Estimate: 2-4 hours
  - Acceptance: snapshot tests run and diff is reviewed. Verification: PR `________`
  - Note: Playwright-based smoke tests for end-to-end/visual regression are intentionally disabled for the `aether-dev` prototype branch (Phase 0). When the team reaches the phase where Playwright is installed and used (see CI notes below), re-activate the Playwright smoke jobs and ensure the Playwright runner is available in CI (or gate by label). Verification: workflow run `________`

## Phase 2 — Content Input & AI Integration (Estimate: 2.5 - 3.5 days) | In branch `aether-rewrite/client-phase2`

- [ ] Migrate content input UI (form & validation)
  - Estimate: 4-6 hours
  - Acceptance: local manual input updates preview. Verification: commit/PR `________`
- [ ] Wire `POST /prompt` with stubs and add stubbed AI layer
  - Estimate: 6-10 hours
  - Acceptance: integration tests pass using `USE_REAL_AI=false`. Verification: commit/PR `________`
- [ ] Visual tests for generated preview + background theme
  - Estimate: 3-6 hours
  - Acceptance: snapshots cover at least 3 representative poems. Verification: PR `________`

## Phase 3 — Export & PDF Quality (Estimate: 2 - 3 days) | In branch `aether-rewrite/client-phase3`

- [ ] Migrate Export controls & UX to `client-v2`
  - Estimate: 3-6 hours
  - Acceptance: export UI triggers the server export endpoint. Verification: commit/PR `________`
- [ ] Add in-process smoke-export harness targeting `client-v2` flows
  - Estimate: 4-8 hours
  - Acceptance: `node server/scripts/run_export_test_inproc.js` produces artifacts reproducibly. Verification: PR `________`
- [ ] Validate PDF with `server/pdfQuality.mjs` and text extraction
  - Estimate: 2-4 hours
  - Acceptance: generated test PDF passes non-fatal validation and contains expected sample text. Verification: commit/PR `________`

## Phase 4 — Progressive Migration & Cutover (Estimate: 2 - 4 days) | In branch `aether-rewrite/client-phase4`

- [ ] Migrate dashboard and secondary pages incrementally
  - Per-page estimate: 4-8 hours (unit tests + visual checks)
  - Estimate total: 1-3 days depending on number of pages
  - Acceptance: each page PR includes unit tests, visual snapshots, and local integration smoke. Verification: PR `________`
- [ ] Implement canary rollout via feature flags
  - Estimate: 3-6 hours
  - Acceptance: canary toggle deployable and monitored. Verification: deployment `________`
- [ ] Full cutover and archive legacy client
  - Estimate: 2-6 hours (coord with ops/CI)
  - Acceptance: default routing serves `client-v2`, legacy client archived. Verification: commit/PR `________`

## Phase 5 — Cleanup & Optimization (Estimate: 1 - 2 days) | In branch `aether-rewrite/client-phase5`

- [ ] Remove legacy dependencies and unused assets
  - Estimate: 2-6 hours
  - Acceptance: fewer unused packages and smaller artifact size. Verification: commit/PR `________`
- [ ] Consolidate `shared/` usage and remove duplicates
  - Estimate: 2-8 hours
  - Acceptance: migrated pages import from `shared/` where appropriate. Verification: commit/PR `________`

Test & QA Gates (time per gate included in phase estimates)

- Unit Test Gate (fast): Vitest runs for client-v2 and server modules — typically < 15 minutes per run locally.
- Visual Parity Gate: snapshot + manual review — 0.5-2 hours depending on feedback.
- Integration Smoke Gate: in-process export + text extraction — 15-60 minutes per run.
- Canary Gate: monitor 24–48 hours; ongoing metric review.

### CI Notes & Runbook

- Keep `USE_REAL_AI=false` in CI by default. Real-AI smoke jobs are gated and run optionally.
- Add CI jobs (textual plan):
  - `client-v2:unit` — run unit tests and snapshots
  - `integration:smoke-export` — run server in CI, trigger in-process export, archive artifacts
  - `visual:snapshots` (optional) — image snaps comparison
- PR checklist (always required in PR body):

  - Unit tests pass
  - Snapshot updated/approved
  - Integration smoke run passes locally
  - Manual visual verification attached (screenshot)
  - Export artifacts validated if export affected

  Playwright note:

  - The repository contains Playwright smoke workflows that run heavier browser tests. These have been temporarily gated/disabled for prototype work on `aether-dev` to keep feedback fast and avoid flaky infra. When you reach the phase that requires E2E/browser smoke tests (for example: late Phase 1 validation of preview, Phase 3 export verification, or as part of canary runs), re-activate the Playwright jobs by either:

    - removing the `if` condition that skips runs targeting `aether-dev` in the workflow file(s), or
    - changing the trigger to run only when a PR has a specific label (e.g. `run-playwright`) and applying that label when you want the smoke job to run, or
    - moving Playwright smoke runs to a separate scheduled workflow (nightly) if continuous runs are not required.

    Add a one-line verification note (workflow run link / commit) when you re-enable Playwright.

### Modus Operandi: Systematic Migration & Quality Assurance

Key principles for implementation:

1. **Incremental Migration with Continuous Testing**

   - Review each component before migration
   - Document current limitations and planned improvements
   - Maintain continuous visual verification
   - Test at multiple levels (unit, visual, integration)
   - Address technical debt systematically

2. **Strategic Code Reuse & Analysis**

   - Leverage existing `shared/` directory components
   - Evaluate current implementation pain points
   - Document architectural decisions and improvements
   - Maintain stable server API interface
   - Reuse proven business logic and visual templates

3. **Quality-First Development Process**

   - Review and document each component before rewriting
   - Note problematic areas in current implementation
   - Document rationale for architectural changes
   - Consider maintenance implications
   - Create parallel implementations for easy comparison

4. **Implementation Checklist Per Component**

   - [ ] Review current implementation
   - [ ] Document known issues/limitations
   - [ ] Identify reusable elements
   - [ ] Plan improvements while maintaining functionality
   - [ ] Implement with comprehensive tests
   - [ ] Validate visual parity
   - [ ] Document architectural decisions

5. **Verification Strategy**
   - Use feature flags for A/B testing
   - Maintain parallel running capability
   - Enable quick rollbacks if needed
   - Document visual and functional differences
   - Validate improvements with metrics

Remember: Slower initial progress in favor of quality and maintainability is acceptable. Each change should be well-tested, well-documented, and contribute to overall system improvement.

### Timing summary (conservative estimate)

- Phase 0: 0.5 - 1 day
- Phase 1: 2 - 3 days
- Phase 2: 2.5 - 3.5 days
- Phase 3: 2 - 3 days
- Phase 4: 2 - 4 days
- Phase 5: 1 - 2 days

Total estimated range: 10 - 17.5 days (conservative buffer included)

How to use this checklist in PRs

- Paste the relevant section(s) in PR descriptions for page migrations.
- Fill verification commit/PR hashes in the `Verification` fields when items are complete.
- Keep visual snapshots and smoke artifacts attached to PRs for reviewer inspection.

End of PATH_FORWARD_CHECKLIST dv01
