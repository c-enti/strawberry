# Removal of Custom Babel Configuration (May 2025)

## What Changed

- The file `client/babel.config.js` was removed from the project.
- Jest configuration updated to use SWC instead of Babel.
- Added proper Next.js mocks for testing environment.

## Why

- Next.js 15+ prefers the SWC compiler for optimal performance and compatibility.
- The presence of a custom Babel config disables SWC, causing incompatibility with features like `next/font`.
- All frontend tests now pass with SWC-based transformation.

## Implementation Details

1. Removed `babel.config.js`
2. Updated Jest configuration:
   - Switched to @swc/jest for transformation
   - Added proper Next.js component mocking
   - Configured testing environment

## Results

- The project now uses the default Next.js/SWC toolchain
- All tests passing with proper component mocking
- Better compatibility with Next.js features

---

_If you need to reintroduce Babel in the future, document the specific requirement and ensure compatibility with Next.js features._
