# GitHub Workflows

This document provides a summary and assessment of the GitHub Actions workflows in this repository.

## Workflow Summary

- **`ci-quick-smoke.yml`** — Fast PR-level smoke that verifies server startup and a `/health` ping.

- **`server-tests-pr.yml`** — PR workflow that runs the server unit/integration test suite (Vitest). Recently extended to explicitly run the worker E2E test (`__tests__/e2e.worker.test.mjs`) to prevent regressions in the job/worker flow.

- **`ci-smoke-puppeteer.yml`** — Nightly and push workflow that runs a full Puppeteer-based export smoke test. It produces artifacts (PDF + logs) for debugging export regressions.

- **`verify-export.yml`** — Lightweight export verification (in-process) used for quicker feedback without full browser dependencies.

## Overview and Assessment

- **Redundancy**: The workflows for running server tests have been consolidated into a single, comprehensive workflow (`server-tests-pr.yml`) to avoid confusion and ensure consistency.

- **Clarity**: The naming of the workflows is clear and concise.

- **Efficiency**: The `ci-quick-smoke.yml` workflow provides an efficient, non-blocking smoke test for pull requests.

- **Gating**: The `ci-smoke-puppeteer.yml` workflow is a strict, gated check for the critical PDF export functionality, running on pushes to `main` and on a nightly schedule to prevent regressions.

- **Overall**: The workflows provide good test coverage for the application, with a clear separation between quick checks, pull request tests, and critical path validation.

## To-Do (recent)

- [x] Add explicit worker E2E step to `server-tests-pr.yml` so PRs gate the `e2e.worker.test.mjs` path (prevents job/worker regressions).
- [x] Keep nightly full export smoke (`ci-smoke-puppeteer.yml`) enabled on `main` and upload artifacts for debugging.
- [ ] Consider adding a nightly server-tests job (full test-suite) for proactive regression detection.

## CI Notes

- **Chrome/Chromium Dependency**: Several tests, particularly those involving Puppeteer for PDF generation (`export.integration.test.js`, `puppeteer.smoke.test.js`), require a system-level installation of Google Chrome or Chromium.

- **`CHROME_PATH`**: The CI environment must set the `CHROME_PATH` environment variable to point to the location of the Chrome/Chromium executable.

- **Workflow Example**: The `server-tests-pr.yml` workflow provides a working example of how to install `google-chrome-stable` on an Ubuntu runner and configure the necessary environment variables.

- **Puppeteer Installation**: When installing npm dependencies in a CI environment where a system browser is provided, it's important to set `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` to prevent Puppeteer from downloading its own version of Chromium, which can be redundant and slow down the build process.

### Pre-flight Check Script

The repository includes `scripts/verify-ci-env.sh` and workflows already call it to ensure the CI runner has the required system-level dependencies (Chrome/Chromium, CHROME_PATH, and `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`). This central script reduces flaky CI caused by missing system packages and is referenced by server test and smoke workflows.

### Successful Local Test

Local validations were performed during development (verify-ci-env and server Vitest runs). Example: running the server E2E locally produced expected worker logs and a passing Vitest result for `__tests__/e2e.worker.test.mjs`.
