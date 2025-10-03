# AetherPress - AI-Powered eBook Creation

Document Version: dv01
Datetime: 2025-10-01 10:00 UTC
Branch: aether-rewrite/client-phase0

AetherPress is an AI-powered eBook creation platform focused on delivering a streamlined experience from concept to publication. The project follows a prototype-first approach, starting with V0.1 to establish core functionality before expanding to V1.0.

The initial prototype (V0.1) demonstrates the foundational workflow:
Prompt → AI Processing → Preview → Basic Override → PDF Export

Current focus: Building a robust proof-of-concept through an A4 eBook of public-domain summer poems — one poem per page with AI-generated decorative backgrounds that complement each poem's theme.

## Getting Started

### Quick Start (Client-v2 + Server)

Use these commands from the repo root to run the latest client-v2 with server proxy:

```bash
# Terminal 1: Start client-v2 dev server
npm --prefix client-v2 run dev

# Terminal 2: Start server with preview proxy
PREVIEW_CLIENT_V2_ENABLED=1 CLIENT_V2_PROXY_URL=http://127.0.0.1:5174 node server/index.js
```

### Legacy Setup (Original Client)

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

## Project Structure

- `client-v2/` — New Svelte frontend (current focus)
- `server/` — Express server, Puppeteer, modules
- `client/` — Legacy Svelte frontend
- `data/` — Database files
- `samples/` — Sample files (PNGs, PDFs)
- `docs/` — Project documentation
- `shared/` — Code shared between client and server
- `config/` — Configuration files

## Technology Stack

- **Frontend:**
  - Client-v2: Modern Vite/Svelte stack with Vitest
  - Legacy: Original Svelte SPA
- **Server:** Express/Node.js for API and service orchestration
- **Database:** PostgreSQL with JSONB support
  - Production: Any PostgreSQL-compatible service
  - Local/CI: Built-in Postgres for testing
- **AI Integration:**
  - Primary: Google's Gemini for text/image generation
  - Fallback: GitHub Models for experimentation
- **PDF Generation:** Puppeteer for HTML-to-PDF conversion
- **Testing:** Unified Vitest setup for client and server

## Testing & Verification

### Running Tests

1. **Client-v2 Tests** (from repo root):

   ```bash
   npm --prefix client-v2 test
   ```

2. **Server Tests**:

   ```bash
   npm --prefix server test
   ```

3. **Integration Tests**:

   ```bash
   # Fast in-process export test
   node server/scripts/run_export_test_inproc.js

   # Full export smoke with Chromium
   PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 CHROME_PATH=/usr/bin/google-chrome-stable \
     npm --prefix server run verify-export
   ```

### Development Scripts

1. **Preview Testing**:

   ```bash
   # Generate preview artifacts
   node client/scripts/headless-preview-e2e.cjs
   ```

2. **Export Validation**:

   ```bash
   # Run smoke export
   bash server/scripts/smoke-export.sh

   # Extract and validate PDF text
   node server/scripts/extract-pdf-text.js /tmp/your-ebook.pdf
   ```

3. **Quick Smoke Test**:
   ```bash
   # Test Generate→Preview flow
   ./scripts/ci-smoke-test.sh http://localhost:3000  # requires curl, jq, python3
   ```

### CI/CD Environment

For detailed workflow information, see `.github/workflows/WORKFLOWS.md`.

Key Points:

- Test artifacts write to `test-artifacts/` (git-ignored)
- Server logs write to `server/logs/` (git-ignored)
- CI Settings:
  - `USE_REAL_AI=false` for deterministic runs
  - `JOBS_DB=/tmp/tmp-jobs.db` to avoid shared state
  - PDF validation errors fail CI

## Core Features

- **Prompt Engine ("The Magic Wand"):**
  Natural language processing for creative prompt interpretation

- **AI Orchestrator ("The Conductor"):**
  Manages AI Content, Image, Layout, and Assembly Engines

- **Modular Dashboard ("The Control Panel"):**
  Distinct modules for content, images, layout, and settings

- **Dynamic Preview & Export:**
  Real-time preview and high-fidelity PDF export

## API Endpoints

1. **POST /prompt** — Process creative prompt
2. **GET /preview** — Generate HTML preview
3. **POST /override** — Apply content overrides
4. **GET /export** — Generate PDF output

## Architecture Principles

1. **Always-Working Frontend First**

   - Consistent, working state
   - Independent component testing
   - Clear display/logic separation
   - Predictable data flow

2. **"Dumb" Preview Component**
   - Display-only responsibility
   - Store-driven updates
   - Clean business logic separation

## Project Vision

### V0.1 Goals

- Core AI-powered generation
- Fundamental user workflow
- Technical architecture validation

### V1.0 Vision

- Effortless eBook creation
- Precise AI control
- Production-quality output

## Documentation

See `docs/` for:

- Architectural decisions
- Development guides
- API documentation
- Testing strategies
- Deployment procedures
