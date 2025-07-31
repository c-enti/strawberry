# Roadmap

> **Note:** For detailed issues, API reference, and historical notes, see `/docs/addenda/`.

This document outlines the planned features, priorities, and future directions for ChronosCraft AI.

## Milestones

### v0.1 – MVP _(In Progress)_

Priority 1: Visual Impact

- [x] **Project Infrastructure**
      _Goal:_ Set up development environment, testing, and basic project structure.
      _Acceptance Criteria:_ Dev container working, all tests passing, proper configuration in place.

- [ ] **GenAI-powered background/header image generation**  
       _Goal:_ User can generate unique calendar backgrounds/headers using text prompts (e.g., via Google Gemini API).  
       _Acceptance Criteria:_ Images are generated, applied to calendar, and included in exports.
      _Demo Priority:_ High – Primary "wow factor" feature

- [ ] **Simple AI theme suggestions**  
       _Goal:_ System suggests color palettes, fonts, and themes based on user input or prompts.  
       _Acceptance Criteria:_ Suggestions are relevant and can be applied to the calendar.
      _Demo Priority:_ High – Shows AI understanding of design

Priority 2: Core Output

- [ ] **Basic PDF/PNG export**  
       _Goal:_ User can export the calendar as a print-ready PDF or PNG.  
       _Acceptance Criteria:_ Exported files match on-screen design and are high-resolution.
      _Demo Priority:_ High – Delivers tangible result

- [ ] **Basic calendar creation refinements**  
       _Goal:_ Polish year view and ensure visual appeal of layouts.  
       _Acceptance Criteria:_ Calendar displays professionally with AI-enhanced visuals.
      _Demo Priority:_ Medium – Foundation for showcasing AI features

Priority 3: User Content

- [ ] **Manual event input**  
       _Goal:_ User can add, edit, and remove events for specific dates.  
       _Acceptance Criteria:_ Events persist and display correctly on the calendar.
      _Demo Priority:_ Low – Can use sample data for demo

- [ ] **Project save/load functionality**  
       _Goal:_ User can save and reload calendar projects.  
       _Acceptance Criteria:_ Saved projects restore all settings, events, and designs.
      _Demo Priority:_ Low – Not critical for demo showcase

### v0.2 – AI Assistant & Integrations

- **Conversational AI assistant for design refinement**  
  _Goal:_ User can interact with an AI assistant to refine calendar design via chat or prompts.  
  _Acceptance Criteria:_ Assistant responds contextually and can make design changes as requested.

- **Google Calendar import**  
  _Goal:_ User can import events from Google Calendar.  
  _Acceptance Criteria:_ Imported events appear correctly in the calendar and can be edited.

- **More advanced GenAI features (icons, palettes, font pairing)**  
  _Goal:_ User can generate decorative icons, advanced palettes, and font pairings using AI.  
  _Acceptance Criteria:_ Generated assets are relevant, unique, and can be applied to the calendar.

- **Improved export fidelity**  
  _Goal:_ Exported files maintain high quality and accuracy, including all design elements.  
  _Acceptance Criteria:_ No loss of quality or missing elements in exported files.

### v1.0 – Public Launch

- **User authentication**  
  _Goal:_ Users can register, log in, and manage their accounts securely.  
  _Acceptance Criteria:_ Authentication is secure; user data is protected.

- **Project sharing (optional)**  
  _Goal:_ Users can share their calendar projects with others (e.g., via link or email).  
  _Acceptance Criteria:_ Shared projects are accessible to intended recipients only.

- **Analytics for user-created calendars**  
  _Goal:_ System tracks and displays analytics (e.g., number of calendars created, exports).  
  _Acceptance Criteria:_ Analytics are accurate and accessible to users/admins.

- **Performance and UX polish**  
  _Goal:_ Application is fast, responsive, and visually refined.  
  _Acceptance Criteria:_ Meets performance benchmarks; positive user feedback on UX.

## Technical Debt Sprint (May 2025)

- Migrate backend to TypeScript
- Expand and review test coverage
- Audit and update documentation for all APIs and modules

## Long-Term Ideas

- **More layout and customization options**  
  _Goal:_ Expand available calendar layouts and allow deeper customization.  
  _Acceptance Criteria:_ Users can select from more layouts and customize more aspects.

- **Mobile-friendly enhancements**  
  _Goal:_ Improve mobile usability and responsiveness.  
  _Acceptance Criteria:_ App is fully usable and visually appealing on mobile devices.

- **Support for additional calendar providers**  
  _Goal:_ Integrate with more calendar services beyond Google (e.g., Outlook, Apple).  
  _Acceptance Criteria:_ Users can import events from multiple providers.

- **Marketplace for community designs**  
  _Goal:_ Allow users to share and discover calendar designs from the community.  
  _Acceptance Criteria:_ Users can browse, upload, and use community-created designs.

---

_This roadmap is a living document and will evolve as the project progresses. For details on current work, see the changelog and project boards._
