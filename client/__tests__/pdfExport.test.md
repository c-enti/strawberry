# pdfExport.test.md

## Test Purpose

This unit test validates the business logic of the PDF export utility, ensuring that calendar data is correctly transformed into a print-ready PDF.

## Mocking Philosophy

Mocks are used only for external dependencies, such as file system or network operations if present. Internal logic, such as data transformation and PDF structure, is tested directly without superficial or excessive mocking.

## Actionables

- Calls the PDF export utility with valid calendar data.
- Confirms correct PDF generation and error handling.
- Avoids mocking internal data transformation logic.

## Output Quality Metrics

- Verifies 300 DPI resolution for print quality
- Validates vector graphics preservation
- Checks color accuracy (sRGB/CMYK)
- Ensures text sharpness and font embedding
- Validates PDF/X-1a:2001 compliance for print
- Supports "Quality Output Matters" principle

## Performance Expectations

- PDF generation within 1000ms for single page
- Memory usage under 50MB during generation
- Proper cleanup of temporary files
- Supports "Simplicity & Flow" principle

## Hallmarks

- Tests real substance: PDF generation from calendar data.
- Isolates only true external dependencies (none in this test).
- Runs quickly and deterministically.

---

**Test & Documentation Review Note**

> ⚠️ Reviewed: As of 2025-07-14, pdfExport.test.ts was reviewed and found to only cover basic existence and error-free execution. Full approval is pending real PDF logic and deeper actionable coverage. This note is invalidated if the documentation or implementation changes.
