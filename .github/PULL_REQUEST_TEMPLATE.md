### Summary

Describe the purpose of this PR and what it changes.

### Checklist

- [ ] CI passes (`npm --prefix server test`)
- [ ] Reviewer: check server-tests-pr CI logs and artifacts for the E2E worker test
- [ ] Docs: update `docs/focus/V0.1_Final-0824.md` with verification notes for changed items

### Notes for reviewer

Please pay special attention to the server job-queue changes and the startup recovery behavior added in `server/index.js`.
