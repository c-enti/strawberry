# Current Issues and Challenges

> **Reminder:** Keep `NEXT_STEPS.md` up-to-date. Remove completed items and past notices so it always reflects the current and next actionable work.

This document tracks current and upcoming challenges for the ChronosCraft project.
Historical issues and completed work can be found in the archive directory (e.g., `archive/issues-2025-06-05.md`).

## Active Issues

### Server Improvements (2025-07-15)

#### Error Handling Enhancement

- **Priority:** Medium
- **Description:** Current error handling in `app.ts` needs improvement
- **Tasks:**
  - [ ] Expand error handler beyond CalendarError
  - [ ] Add development-mode specific error messages
  - [ ] Implement proper error logging strategy
  - [ ] Add request ID tracking for better error tracing

#### Project Management API Completion

- **Priority:** High
- **Description:** Project management endpoints need full CRUD implementation
- **Tasks:**
  - [x] Implement UPDATE endpoint
  - [x] Implement DELETE endpoint
  - [ ] Add pagination for list endpoint
    - Note: The list endpoint currently returns all projects with no pagination. No query parameters for pagination are implemented.
    - Next Steps: Add support for limit/offset (or page/size) query parameters in the route and service.
  - [ ] Add sorting and filtering capabilities
    - Note: The list endpoint sorts by updatedAt descending by default, but does not support dynamic sorting or filtering via query parameters.
    - Next Steps: Add support for sort and filter query parameters in the route and service.

#### Input Validation Enhancement

- **Priority:** High
- **Description:** Current validation needs to be more robust
- **Tasks:**
  - [ ] Implement express-validator middleware
  - [ ] Add comprehensive validation for all endpoints
  - [ ] Create reusable validation schemas
  - [ ] Add sanitization for user inputs

#### Database Error Handling

- **Priority:** Medium
- **Description:** Database error handler in `errors.ts` is incomplete
- **Tasks:**
  - [ ] Complete switch statement for all Prisma error codes
  - [ ] Add proper error messages for each error type
  - [ ] Implement proper error logging
  - [ ] Add transaction handling guidance

#### Server Health Check Response (2025-07-15)

- **Priority:** High
- **Description:** Server health check endpoint not responding within expected timeframe
- **Tasks:**
  - [ ] Investigate server response timeout on /health endpoint
  - [ ] Add server startup health diagnostics
  - [ ] Implement connection timeout handling
  - [ ] Add health check metrics (response time, uptime, etc.)
  - [ ] Document expected health check response times

### CI/CD Improvements (2025-06-10)

1. **Set up Playwright integration tests in CI**

   - Add Playwright test run to GitHub Actions workflow ✓
   - Ensure Playwright tests run on PRs and main branch ✓
   - Decision (2025-06-11): Implementing full browser support (Chromium, Firefox, WebKit) ✓
     - Rationale: Development-only requirement, sufficient space available (~706MB total)
     - Benefits: Complete cross-browser testing coverage
   - Added health checks and process management ✓
   - Remaining Robustness TODOs (for future improvement):
     - Add retry mechanism for flaky tests
     - Implement parallel test execution optimization
     - Add test result reporting to PR comments
   - Timebox: 1 hour

2. **Add automated linting to CI**

   - Integrate ESLint for server ✓
   - Add lint script to server package.json ✓
   - Add lint steps to CI workflow ✓
   - Client already has Next.js lint support ✓
   - Testing: Need to verify lint failure fails CI build
   - Timebox: 1 hour

3. **Implement production build verification in CI**

   - Add build step for both client and server in CI
   - Fail CI if build fails
   - Timebox: 1 hour

4. **Set up code coverage reporting**

   - Configure Jest coverage:
     - Update Jest config for both client and server
     - Set appropriate coverage thresholds
     - Ensure coverage output format is CI-friendly
   - Integrate with CI:
     - Add coverage generation to test runs
     - Configure artifact upload
     - Set up path mappings for reports
   - Documentation:
     - Add coverage badge to README
     - Document coverage requirements
   - Timebox: 1 hour

5. **Create deployment workflow for staging**
   - Draft GitHub Actions workflow for staging deployment (can be a placeholder)
   - Document required secrets and environment variables
   - Timebox: 1 hour

### GUI Layout Alignment (2025-07-16)

#### Layout Structure Misalignment

- **Priority:** High
- **Description:** Current GUI implementation does not match vision document layout
- **Tasks:**
  - [x] Consolidate customization controls into sidebar (currently split between aside and sidebar)
  - [x] Implement missing Bottom Bar component for tips, status, and quick actions
  - [x] Properly structure main layout (TopBar, Sidebar, CalendarArea, BottomBar)
  - [x] Implement proper visual containment for each major component

#### Missing Features

- **Priority:** High
- **Description:** Several key features from GUI vision are not implemented
- **Tasks:**
  - [ ] Complete Sidebar implementation with all specified features:
    - Templates
    - Themes
    - Colors
    - Fonts
    - Backgrounds
    - Stickers
    - Notes/Photos
    - Settings
  - [ ] Implement drag/drop events in calendar area
  - [ ] Add live preview functionality
  - [ ] Implement Bottom Bar features (tips, status, quick actions)

<!-- Add new issues above this line -->

## Upcoming Challenges

<!-- Add upcoming challenges above this line -->
