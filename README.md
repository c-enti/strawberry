# AetherPress - AI-Powered eBook Creation

Datetime: 2025-10-01 10:00 UTC
Branch: aether-rewrite/client-phase0

AetherPress is an AI-powered eBook creation platform focused on delivering a streamlined experience from concept to publication. The project follows a prototype-first approach, starting with V0.1 to establish core functionality before expanding to V1.0.

The initial prototype (V0.1) demonstrates the foundational workflow:
Prompt → AI Processing → Preview → Basic Override → PDF Export

Current focus: Building a robust proof-of-concept through an A4 eBook of public-domain summer poems — one poem per page with AI-generated decorative backgrounds that complement each poem's theme.

## Development Philosophy

The project follows a prototype-first development strategy:

1. Build a working V0.1 prototype focusing on core functionality
2. Validate the core workflow and architectural decisions
3. Gather feedback and insights from the prototype
4. Evolve to V1.0 with production-ready features

Development Guidelines:

- Focus on implementing real, working features over mocks
- Maintain clean, modular architecture from the start
- Document decisions and changes thoroughly
- Test core functionality early and often

🚨 **All contributors must understand and follow this prototype-first approach** 🚨

## Core Architecture Principles

1. **Always-Working Frontend First**

   - Frontend must maintain a consistent, working state at all times
   - All components must be independently testable
   - Clear separation between display and logic layers
   - Predictable data flow and state management

2. **"Dumb" Preview Component**
   - Preview component's sole responsibility is to display $previewStore contents
   - No internal fetch/update logic in the preview component
   - All preview updates must flow through the store
   - Clear separation from business logic and API calls

These principles are fundamental to our architecture and must be maintained throughout both V0.1 and V1.0 development phases.

## Project Vision

AetherPress aims to revolutionize eBook creation by combining AI capabilities with user creativity:

V0.1 Goals:

- Demonstrate core AI-powered content and image generation
- Establish fundamental user workflow and controls
- Validate technical architecture and design decisions

V1.0 Vision:

- Empower creators to produce visually stunning eBooks effortlessly
- Provide precise control over AI-generated content and layouts
- Deliver production-quality results with minimal technical overhead

## Unified Testing & Module System (Summary)

**Client tests**: Powered by Vitest for fast, modern Svelte development.
**Server tests**: Powered by Vitest for Node.js/JavaScript workflows.
**Module System**: CommonJS (CJS) is used in the backend for compatibility; ESM is used in the frontend for Svelte/Vite.

## Project Structure

- `server/` — All backend code (Express server, Puppeteer, modules)
- `client/` — Svelte frontend SPA
- `data/` — (Optional) Database files
- `samples/` — Sample files (e.g., PNGs, PDFs)
- `docs/` — Project documentation
- `shared/` — Code or assets shared between client and server (e.g., utility functions, types, or constants).
- `config/` — Configuration files (e.g., environment settings, service credentials, or build configs).

## Technology Vibe

- **Client:** Modern, component-based JS framework (Vite/Svelte). Focus on a clean, responsive UI.
- **Server:** Scalable platform (Express/Node.js). Ready to orchestrate multiple API calls.
- **Database:** For a balance of structure and flexibility (PostgreSQL/JSONB).
  - Production deployments can use any PostgreSQL-compatible service (Azure Database, AWS RDS, etc.)
  - Postgres is now the default for local and smoke tests (the migration is in place and `docs/focus/GUI_RESOLUTION.md` formalizes integration steps).
  - See `/server/index.js` for the current health check implementation and TODO note.
- **AI:**
  - **Default:** Use Google's Gemini for both text and image generation.
  - Leverage best-in-class third-party APIs for core GenAI (image generation, possibly LLM for assistant). Build custom logic for agent orchestration and workflow, not foundational models.
  - Support use of [GitHub Models](https://github.com/features/models) for discovery and experimentation with AI models (for free).
- **PDF Generation:** Use a proven, robust library, puppeteer for HTML-to-PDF.
- **Persistence:** Standard database for user accounts, projects, preferences, asset metadata.

## Key Features

- **Prompt Engine ("The Magic Wand"):**  
  Uses natural language processing to interpret your creative prompt, ensuring that your ideas—no matter how abstract—are understood and transformed into content.

- **AI Orchestrator ("The Conductor"):**  
  Seamlessly manages the AI Content Agent, Image Agent, Layout Engine, and Assembly Engine to balance creativity with consistency.

- **Modular Dashboard ("The Control Panel"):**  
  Provides distinct modules for content, images, layout, and settings, allowing for targeted tweaks without disrupting your entire project.

- **Dynamic Live Preview & Export:**  
  See changes in near real-time and export a high-fidelity PDF that mirrors the live preview down to the pixel.

## API Endpoints (Core Loop)

1. **POST /prompt** — Accepts a `prompt` and returns generated content
2. **GET /preview** — Returns an HTML preview for given content
3. **POST /override** — Accepts `content` and `override`, returns updated content
4. **GET /export** — Returns a PDF file for given content

## Implementation Notes

- **PDF Generation**: Uses Puppeteer for production-level HTML-to-PDF rendering
- **AI Service Abstraction**: Centralized logic for text and image generation
- **Template-Based Layouts**: Dynamic HTML/CSS templates for content and image rendering

## Future Enhancements

- Asynchronous processing for better performance
- Enhanced UI/UX
- User authentication and session management
- Expanded database schema for more complex workflows

## Documentation

See the `docs/` directory for devcontainer setup, dependency management, and architecture notes.

## Getting Started

### Quick Start (Client-v2 + Server)

Use these commands from the repo root to run the latest client-v2 with server proxy:

```bash
# Terminal 1: Start client-v2 dev server
npm --prefix client-v2 run dev

# Terminal 2: Start server with preview proxy
PREVIEW_CLIENT_V2_ENABLED=1 CLIENT_V2_PROXY_URL=http://127.0.0.1:5174 node server/index.js
```

### Legacy Setup

1. Start the server:

   ```bash
   cd server
   npm install
   npm run dev    # runs Express server from index.js
   ```

2. Start the client:
   ```bash
   cd client
   npm install
   npm run dev    # runs Svelte app on Vite
   ```

### Access Points

- **Client-v2**: [http://localhost:5174](http://localhost:5174)
- **Legacy Client**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3000](http://localhost:3000)

## CI/CD Workflows

For a detailed summary and assessment of the GitHub Actions workflows used in this project, please see the `WORKFLOWS.md` document located in the `.github/workflows/` directory. This document provides an overview of each workflow's purpose, the triggers, and the key jobs they perform.

CI and local artifact handling

- The repository ignores runtime test artifacts (`test-artifacts/`, `server/test-artifacts/`, `client/test-artifacts/`) to avoid committing large or temporary files. CI jobs still upload runner-produced artifacts for debugging. To reproduce artifact generation locally, run the headless preview script or smoke-export script and check the `test-artifacts/` directory (created locally):

```bash
# generate preview artifacts (local)
# When run from the repo root, the client script writes into `client/test-artifacts/`.
node client/scripts/headless-preview-e2e.cjs || node client/scripts/headless-preview-e2e.js

# run export smoke and extract text
# run server smoke-export (writes to a temp dir; CI copies artifacts to `server/test-artifacts/`)
bash server/scripts/smoke-export.sh
node server/scripts/extract-pdf-text.js /tmp/your-ebook.pdf

Note: runtime server logs are now written to `server/logs/` (ignored by `server/.gitignore`).
```

## How to verify V0.1 (quick)

Use these commands to run the deterministic smoke checks and produce artifacts you can inspect locally or upload from CI.

1. Run the server tests (fast verification):

```bash
# from the repo root
npm --prefix server test
```

2. Run the in-process export smoke (deterministic, fast):

```bash
# from the repo root
# This starts the server in-process and writes artifacts to /tmp and copies them to server/test-artifacts when running in CI
node server/scripts/run_export_test_inproc.js
```

3. Run the full export smoke with Chromium (CI-like):

```bash
# ensure Chrome is available on your PATH or set CHROME_PATH
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 CHROME_PATH=/usr/bin/google-chrome-stable npm --prefix server run verify-export
```

Artifact locations:

- `server/test-artifacts/` — artifacts copied here by the in-process smoke script when running in CI or when the directory exists locally.
- `/tmp/aetherpress-*` — temporary artifacts created by the smoke scripts (each run creates a unique temp dir).

Notes:

- For deterministic CI runs set `USE_REAL_AI=false` and `JOBS_DB=/tmp/tmp-jobs.db` to avoid external calls and shared DB state.
- If a PDF is generated, `server/pdfQuality.mjs` may be executed and its summary printed to stdout; CI workflows will fail on fatal validation errors.

## Scripts

- `scripts/ci-smoke-test.sh` — lightweight smoke test for the Generate→Preview endpoints. Usage: `./scripts/ci-smoke-test.sh http://localhost:3000` (requires `curl`, `jq`, and `python3`).
