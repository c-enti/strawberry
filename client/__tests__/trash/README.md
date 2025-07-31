# AI Agent Test Artifacts

These tests have been preserved as historical examples of problematic AI agent-generated tests. They serve as documentation of what agents SHOULD NOT do when implementing tests.

> **Note:** These files have been moved to `/docs/addenda/client_trash-test/` to preserve the history of AI agent test generation attempts and their failure modes.

## What's Wrong With These Tests

These tests represent common pitfalls in AI-generated test implementations:

1. Only validated environment variable presence
2. Tested error message strings (brittle tests)
3. Used mocked responses instead of testing real functionality
4. Did not validate actual theme generation quality or performance

## Why This Matters

This serves as a reminder to write meaningful tests that:

- Validate real integration with Gemini API
- Verify theme generation quality and format
- Test actual error handling with real API failures
- Measure and validate performance/rate limiting
- Focus on business value over coverage numbers

## Better Testing Strategy

1. Integration tests with real API calls
2. Theme quality validation (color harmony, accessibility)
3. Real error handling scenarios
4. Performance and rate limit handling
5. End-to-end user workflows

Remember: Tests should validate behavior that matters to users, not implementation details.
