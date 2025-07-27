# ChronosCraft AI – Server (Backend)

> **Directory Structure**
>
> - `__tests__` – Tests for all critical logic
> - `controllers/` – Request handlers and business logic
> - `models/` – Database models and schemas
> - `routes/` – Express route definitions
> - `services/` – Service layer for business logic and integrations
> - `utils/` – Utility functions

## Implementation Status (as of May 27, 2025)

### Completed Features

- Calendar API with full CRUD operations
  - Get all calendars and specific calendar by ID
  - Create new calendars with events
  - Update existing calendars
  - Delete calendars

### Known Issues and Planned Improvements

> For detailed tracking of these issues, see `docs/addenda/issues.md`

1. **Error Handling Enhancement**

   - Current error handling needs expansion beyond CalendarError
   - Development-mode specific error messages needed

2. **Project Management API Completion**

   - UPDATE and DELETE endpoints pending implementation
   - Pagination needed for list endpoint

3. **Input Validation**

   - Express-validator implementation planned
   - More comprehensive validation needed

4. **Database Error Handling**
   - Incomplete Prisma error code handling
   - Transaction handling guidance needed

- TypeScript migration for calendar routes
- Comprehensive test coverage (100% statements, 84.21% branches)
- Error handling for all endpoints

### Next Steps

- Database integration with PostgreSQL and Prisma
- PDF export functionality
- External calendar service integration
- Project save/load features
- GenAI integration for themes

For detailed API documentation, see [API Documentation](../docs/API.md).

## Backend Vision & Role

- **Project Goal:** Orchestrate a magical, effortless experience for crafting stunningly unique, personalized, printable calendars using AI.
- **Core Purpose:** Provide a scalable, reliable backend to support AI-powered calendar generation, user/project persistence, and high-quality export.

## Core Epics & Feature Vibes (Backend)

**(Epic 1)** Calendar Foundation Vibe - "Solid & Dependable":

- API endpoints for calendar data (year/month, layouts, holidays, events).
- Data validation and normalization.

**(Epic 2)** GenAI Magic Vibe - "Inspiring & Wow!":

- Integrate with third-party GenAI APIs for image and theme generation.
- Orchestrate AI suggestions for themes, palettes, fonts.
- Theme system integration (see [Theme System and Customization](../docs/addenda/THEME_SYSTEM.md) for frontend implementation details)
- Serve generated assets to frontend.

**(Epic 3)** AI Assistant Vibe - "Helpful & Intuitive":

- Natural language processing endpoints for design assistant features.
- Google Calendar integration for event import.
- Conversational refinement endpoints.

**(Epic 4)** Output & Persistence Vibe - "Tangible & Useful":

- PDF/PNG export endpoints (vector, print-ready).
- Project save/load endpoints.
- User authentication and project metadata storage.

## Guiding Principles (Backend)

- **Simplicity & Flow:** API should be intuitive and easy to consume.
- **Scalability:** Ready to orchestrate multiple API calls and scale as needed.
- **Quality Output:** Ensure exports are high-fidelity and reliable.
- **Security:** Protect user data and API keys.

## Technology Vibe (Backend)

- **Backend:** Node.js/Express.
- **Persistence:** Standard database for user accounts, projects, preferences, asset metadata.
- **Generative AI:** Integrate with third-party APIs (not building foundational models).

## Out of Scope (Backend)

- Building foundational AI models in-house.
- Integration with all calendar providers (start with Google).
- Advanced, granular layout customization tools.
- Direct e-commerce integration.

## Known Issues

### Server Startup Issue (2025-05-27)

Currently experiencing issues with server startup using `npm run dev` or `ts-node`. The error relates to module resolution for the `www` file. This will be addressed in the next development session. For now, the frontend can be developed and tested independently.

### Getting Started

To get started with the ChronosCraft AI server:

1. **Clone the repository:**

   ```bash
   git clone https://github.com/yourusername/chronoscraf
   ```
