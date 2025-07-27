# ChronosCraft AI – Client (Frontend)

> **Babel Notice (May 2025):**
>
> The custom Babel configuration (`babel.config.js`) was removed to restore compatibility with Next.js 15+ and SWC-based features. No custom Babel plugins or transforms were in use. See `client/BABEL_REMOVAL.md` for details.

> **Directory Structure**
>
> - `src/app/` – Next.js app directory (pages, layouts, etc.)
> - `public/` – Static assets (images, icons, etc.)
> - `package.json`, `tsconfig.json`, `next.config.ts` – Project configuration files

## Vision & Vibe

- **The Feeling:** We want users to feel like creative wizards. They come with an idea (or just a vague mood) and leave with a beautiful, personalized calendar that sparks joy or perfectly serves its function. It should feel less like work and more like playful co-creation with an AI muse.
- **Core Purpose:** To democratize beautiful calendar design through intuitive AI, making personalization seamless and the output high-quality for both digital viewing and physical printing.
- **Elevator Pitch:** Think "Canva meets Midjourney, but hyper-focused on beautiful, printable calendars you design by describing your vibe."

## Target User Vibe (Persona: "Creative Casey")

- **Who:** Digitally savvy individual (hobbyist, parent, student, small business owner) who appreciates aesthetics but isn't a professional graphic designer. They value personalization for gifts, planning, or decor.
- **Frustrations:** Generic templates feel boring. Pro design tools are overkill and intimidating. Getting visuals just right is hard.
- **Motivations:** Wants unique, beautiful outputs with minimal hassle. Excited by AI potential if it's easy and fun. Values high-quality print results.

**Key User Goals:**

- Easily create a calendar that looks amazing.
- Incorporate personal events/dates simply.
- Generate unique visuals without needing external tools or skills.
- Get a print-ready file (PDF) or digital image (PNG).
- Feel proud of the result.

## Core Epics & Feature Vibes (Frontend)

**(Epic 1)** Calendar Foundation Vibe - "Solid & Dependable":

- Select year/month(s), standard grid/list layouts, basic regional holiday sets, simple manual event input.

**(Epic 2)** GenAI Magic Vibe - "Inspiring & Wow!":

- Generate unique background/header images via text prompts ("watercolor forest in winter").
- Get AI suggestions for themes, color palettes, font pairings based on prompts or images.
- Generate small decorative elements/icons.

**(Epic 3)** AI Assistant Vibe - "Helpful & Intuitive":

- Initiate calendar creation via description ("Make a minimalist photo calendar for my family using pics from this folder...").
- Refine the design via conversational feedback ("Make the text bigger," "Try a different background for March").

**(Epic 4)** Output & Persistence Vibe - "Tangible & Useful":

- Flawless PDF export (vector, print-ready).
- Crisp PNG export (digital use).
- Interactive online preview.
- Save/load projects within the app.

## Guiding Principles (Frontend)

- **Aesthetics First:** Prioritize visual appeal. Default outputs should look good. Beauty isn't an afterthought.
- **Simplicity & Flow:** Minimize cognitive load. Interactions should feel intuitive, almost invisible. Smooth transitions.
- **AI as Co-Pilot:** AI empowers and suggests, user guides and decides. Avoid AI feeling opaque or uncontrollable.
- **Personalization is Paramount:** The end product must feel uniquely tailored to the user's input and style.
- **Quality Output Matters:** Exports (especially PDF) must be high-resolution and print reliably. What You See Is What You Get (WYSIWYG).

## Technology Vibe (Frontend)

- **Frontend:** Modern, component-based JS framework (React). Focus on a clean, responsive UI.
- **Theme System:** Context API-based theming with dynamic CSS variables. See detailed documentation in [Theme System and Customization](../docs/addenda/THEME_SYSTEM.md).
- **Generative AI:** Leverage best-in-class third-party APIs for core GenAI (image generation, possibly LLM for assistant). Build custom logic for agent orchestration and workflow, not foundational models.
- **PDF Generation:** Use a proven, robust library.

## Out of Scope (Frontend)

- Building foundational AI models in-house.
- Complex multi-user collaboration features.
- Direct e-commerce integration (selling designs/prints).
- Mobile-native applications (focus on responsive web).
- Advanced, granular layout customization tools (lean on AI suggestions within defined layout types first).
- Advanced photo editing capabilities.

---

---

This project is a [Next.js](https://nextjs.org) app bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Testing

### Testing Philosophy & Unit Test Expectations

**Documentation Requirement:**

Every unit test in `client/__tests__` must have a corresponding `.md` file (e.g., `smoke.test.md`) that documents:

- The test's purpose
- Mocking philosophy
- Actionables performed by the test
- Hallmarks of a good unit test

A unit test cannot be created or considered valid unless this detailed documentation exists and is kept up to date. This ensures clarity, maintainability, and validation of the test's intent and quality.

All unit tests in this project are designed to confirm that real business logic works as intended. This means each test should:

- Validate the actual processing of options, structuring of content, handling of conditional inputs, and interactions with external libraries.
- Use mocks only to isolate the function from external network dependencies (such as `fetch`), ensuring tests run quickly and reliably.
- Avoid excessive mocking of internal logic, so the test suite provides true confidence in the code's behavior.

**In practice:**

- Each test in `client/__tests__` targets meaningful logic—such as calendar rendering, event handling, theme generation, and PDF export—rather than superficial implementation details.
- Mocks are employed only for network calls or external APIs, never for core business logic or internal data flow.
- This approach ensures the suite is fast, reliable, and genuinely effective at catching regressions and confirming correct behavior.

**Hallmarks of a good unit test in this codebase:**

- Tests real substance, not just surface rendering or trivial outputs.
- Isolates only true external dependencies.
- Runs quickly and deterministically.

The project uses Jest and React Testing Library for testing. The test setup includes:

- SWC-based transformation for TypeScript and JSX
- Proper mocking of Next.js components and features
- Jest DOM matchers for component testing

---

### Running Tests

```bash
npm test           # Run all tests
npm test -- --watch # Run tests in watch mode
```

### Test Files Location

- `__tests__/` - Contains all test files
- `jest.setup.ts` - Test environment configuration
- `jest.config.js` - Jest configuration

For more details about the testing setup and recent changes, see `BABEL_REMOVAL.md`.

## Known Issues

### Month Selection Bug (2025-05-27)

There is currently an issue with the month selection functionality in the calendar creation interface. When attempting to select multiple months, only January remains selected regardless of other selections. This issue is tracked in the main issues log and will be addressed in upcoming development work.

### Features Implementation Status

| Feature                        | Status         | Notes                     |
| ------------------------------ | -------------- | ------------------------- |
| Calendar month/year selection  | 🚧 In Progress | Multi-month selection bug |
| Event date input               | ✅ Complete    |                           |
| Background image generation    | ✅ Complete    |                           |
| Theme and style AI suggestions | 🚧 In Progress |                           |
| Calendar PDF export            | ✅ Complete    |                           |
| Calendar PNG export            | ✅ Complete    |                           |
| Interactive online preview     | 🚧 In Progress |                           |
| Save/load projects             | 🚧 In Progress |                           |
