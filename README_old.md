# vanilla

Home to ChronosCraft AI

## ChronosCraft AI

> **Babel Notice (May 2025):**
>
> The custom Babel configuration (`client/babel.config.js`) was removed to restore compatibility with Next.js 15+ and SWC-based features. No custom Babel plugins or transforms were in use. See `client/BABEL_REMOVAL.md` for details.

Fluid and magic-like crafting of stunningly unique, personalized, printable calendars using Generative AI.

## Overview

ChronosCraft AI is a web application where users co-create beautiful, personalized, printable calendars with the help of Generative AI. The project is split into two main parts:

- [`client/`](./client): Frontend (React/Next.js) – user experience, design, and GenAI-powered creative features.
- [`server/`](./server): Backend (Node.js/Express) – API orchestration, persistence, and integration with AI services.

For detailed technical and product documentation, see the respective `README.md` files in each subdirectory.

## Quick Start

1. Set up your development environment (see `docs/CONFIGURATION.md`)
2. Install dependencies for both client and server
3. Start the development servers

## Documentation

- 📚 `docs/CONFIGURATION.md` - Setup and configuration guide
- 🔧 `docs/API.md` - API documentation and endpoints
- 👥 `docs/CONTRIBUTING.md` - Development workflow and guidelines
- 📝 `docs/CHANGELOG.md` - Version history and changes

## Project Structure

```
client/      # Next.js frontend
server/      # Express backend
docs/        # Project documentation
```

For detailed configuration and setup instructions, see `docs/CONFIGURATION.md`.

## Technology Vibe

- **Unified Testing Experience:**
  All client-side tests are powered by Jest for seamless React/Next.js development. All server-side tests run on Vitest for fast, modern Node.js/TypeScript workflows. This clear separation ensures reliability, speed, and best-in-class tooling for every part of the stack.
- **Module System:** ~~ES Modules (ESM) standardized across all packages for:~~
  ~~- Native async/await support without transpilation~~
  ~~- Better tree-shaking and build optimization~~
  ~~- Future-proof codebase aligned with modern JavaScript~~
  ~~- Consistent import/export syntax across frontend and backend~~
- **Frontend:** Modern, component-based JS framework (React/Next.js). Focus on a clean, responsive UI.
- **Backend:** Scalable platform (Node.js/Express). Ready to orchestrate multiple API calls.
- **Database:** For a balance of structure and flexibility (PostgreSQL/JSONB).
  - Development uses Prisma's cloud PostgreSQL service for stability and simplified container setup
  - Production deployments can use any PostgreSQL-compatible service (Azure Database, AWS RDS, etc.)
- **AI:**
  - **Default:** Use Google's Gemini for both text and image generation.
  - Leverage best-in-class third-party APIs for core GenAI (image generation, possibly LLM for assistant). Build custom logic for agent orchestration and workflow, not foundational models.
  - Optionally support use of [GitHub Models](https://github.com/features/models) to find and experiment with AI models for free; see Google AI Edge Gallery for locally run LLMs.
- **PDF Generation:** Use a proven, robust library (implementing both, but for v0.1 the focus is on pdf-lib; puppeteer for HTML-to-PDF is to be an addition for V1.0 -- make it work).
- **Persistence:** Standard database for user accounts, projects, preferences, asset metadata.

## Secrets & Sensitive Data

- All sensitive configuration (API keys, credentials, etc.) must be managed using [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) only. **Do not commit secrets to the repository or use alternative secret management systems.**

## Environment Variables & .env Usage

- For local development, copy `.env.example` to `.env` in the project root and fill in the required values.
- The dev container and Codespaces support environment variables out of the box.
- Do not commit secrets or sensitive values to the repository.
- See `CONTRIBUTING.md` for more details on environment variable management.

## Integration Testing with start-dev.sh

To run full integration (end-to-end) tests across both backend and frontend, use the `start-dev.sh` script in the project root. This script:

- Ensures ports 3000 (frontend) and 5000 (backend) are free
- Starts the backend and waits for it to be ready
- Starts the frontend and waits for it to be ready
- Runs Playwright integration tests (real browser automation)
- Shuts down both servers after tests complete

**Usage:**

```zsh
./start-dev.sh
```

This is the recommended way to verify backend/frontend integration and run Playwright tests locally or in CI.

- The `start-dev.sh` script now uses a robust HTTP check for frontend readiness.
- Playwright integration tests require the frontend to be accessible at http://localhost:3000.
- If you see HTTP ERROR 502, ensure the frontend server is running and port 3000 is public in Codespaces.

---

_For the full product vision and feature breakdown, see the documentation in each subproject._
