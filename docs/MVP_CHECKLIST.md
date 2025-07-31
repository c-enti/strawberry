# ChronosCraft AI – MVP Development Checklist

> **Note:** For detailed issues, API reference, and historical notes, see `/docs/addenda/`.

## Bootstrapping & Dependency Management

> **Note:** The development environment uses a dev container with Node.js, npm, and ESLint pre-installed. Manual installation of these tools is not required. Focus on configuration and project-specific setup.

### Frontend

- [x] Initialize Next.js app with TypeScript in `client/`
- [x] Add Tailwind CSS or styled-components for styling
- [x] Set up ESLint, Prettier, Jest, and React Testing Library (ESLint is already available via dev container)
- [x] Use environment variables for API endpoints and keys

### Backend

- [✓] Initialize Node.js/Express app with TypeScript in `server/`
- [ ] Add Prisma ORM for PostgreSQL
- [ ] Use dotenv for local config, environment variables in devcontainer
- [✓] Set up Jest, Supertest, and ESLint with full test coverage

### Shared Code

- [ ] Create a `shared/` package for types/utilities (npm workspaces for v0.1)

---

## MVP Implementation Roadmap

### Phase 1: Visual Impact (Priority)

- [✓] Bootstrap both apps with minimal code
- [ ] Set up GenAI API integration
  - [ ] Google Gemini API connection
  - [ ] Image generation pipeline
  - [ ] Theme suggestion system
  - [ ] Asset optimization workflow
- [ ] Implement showcase features
  - [ ] 5 premium-quality preset themes
  - [ ] 3 distinctive background styles
  - [ ] High-impact typography selections
  - [ ] Smooth theme transitions

### Phase 2: Output Quality

- [ ] PDF/PNG export system
  - [ ] Vector-based calendar grid
  - [ ] High-resolution asset handling
  - [ ] Print-ready color profiles
  - [ ] Layout consistency checks
- [ ] Visual polish
  - [ ] Professional typography
  - [ ] Spacing and alignment
  - [ ] Color harmony validation
  - [ ] Responsive behaviors

### Phase 3: Core Features

- [ ] Calendar interactions
  - [✓] Basic calendar grid component
  - [✓] Calendar creator component
  - [ ] Sample event data
  - [ ] Basic state persistence
- [ ] Demo preparation
  - [ ] Example calendars
  - [ ] Guided walkthrough
  - [ ] Performance optimization
  - [ ] Error prevention
- [ ] Add project save/load functionality
- [ ] Add user authentication (if needed for MVP)

### Phase 3: AI Assistant & Integrations

- [ ] Add conversational AI assistant endpoints and UI
- [ ] Integrate Google Calendar import
- [ ] Enhance GenAI features (icons, palettes, font pairing)

### Phase 4: Polish & Launch

- [ ] User testing and feedback
- [ ] Performance optimization
- [ ] Documentation
- [ ] Deployment preparation

---

_Check off each item as you complete it to track MVP progress!_

## Estimated Time for Completion

- Directory & Codebase Organization: 1 day
- Initial Implementation Steps: 1 day
- Development Best Practices: 1 day
- Backend MVP: 3–4 days
- Frontend MVP: 3–4 days
- Export & Persistence: 2 days
- Maintenance & Polish: Ongoing

**Total Estimate:** ~10–12 working days for a basic MVP (single developer, focused effort).

# ChronosCraft AI MVP Checklist

## Core Functionality

- [x] Clean and standardized Next.js client directory structure
- [x] Frontend test infrastructure set up (Jest, Testing Library, SWC, TypeScript config)
- [x] All frontend tests in `client/__tests__/` passing as of 2025-05-25
- [x] Sample smoke test in `client/__tests__/` verifies frontend test setup
- [x] Backend bootstrapped with Express, Mocha, and working test suite
- [x] `/calendar` API endpoint implemented and tested
- [ ] Core calendar creation UI (select year/month, event input, etc.)
- [ ] API integration with backend endpoints
- [ ] GenAI prompt UI and output preview

## Developer Experience

- [x] Dev container with Node.js, npm, and ESLint pre-installed
- [x] TypeScript configuration for both frontend and backend
- [x] All code passes linting and tests before merging to `dev`
- [x] Removed Babel in favor of SWC for better performance
- [x] Jest and testing infrastructure properly configured

## Backend

- [ ] Gradual migration to TypeScript
- [ ] Expand API endpoints: calendar data, event CRUD, PDF/PNG export, project save/load
- [ ] Database integration (PostgreSQL with Prisma)
- [ ] Authentication and user/project persistence
- [ ] Add/expand backend tests for new endpoints and business logic

## Documentation

- [x] NEXT_STEPS.md up to date as of 2025-05-24
- [ ] Documentation updated as features are added
- [ ] Roadmap and checklist reviewed/updated as milestones are reached

---

_Keep this checklist updated as you progress!_
