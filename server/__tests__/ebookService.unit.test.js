import { describe, it, expect, beforeEach, vi } from "vitest";

// Helper to inject mocked aiService behavior before importing ebookService
async function mockAI(mockImpl) {
  vi.resetModules();
  vi.doMock("../aiService", () => ({ createAIService: () => mockImpl }));
}

describe("ebookService.handle() - unit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.skip("happy path: AI returns JSON structure and per-chapter JSON", async () => {
    const mockGen = {
      generateContentWithRotation: async (p) => {
        const s = String(p || "");
        if (s.includes("Create a detailed structure")) {
          return {
            content: {
              body: JSON.stringify({
                title: "Mock Title",
                chapters: 2,
                outline: [
                  { chapter: 1, title: "One", estimated_topics: ["a"] },
                  { chapter: 2, title: "Two", estimated_topics: ["b"] },
                ],
              }),
            },
          };
        }
        if (s.includes("You are writing Chapter")) {
          const m = s.match(/Chapter (\d+)/);
          const n = (m && Number(m[1])) || 1;
          return {
            content: {
              body: JSON.stringify({
                chapter: n,
                title: `Title ${n}`,
                content: `Content ${n}`,
                summary: `Summary ${n}`,
                image: {
                  concept: `Concept ${n}`,
                  suggested_style: "whimsical",
                  tone: "mysterious",
                },
              }),
            },
          };
        }
        return { content: { body: "fallback" } };
      },
    };

    await mockAI(mockGen);
    const mod = await import("../ebookService");
    const svc = mod.default || mod;

    const payload = {
      prompt: "A detective short",
      metadata: {
        pageCount: 4,
        theme: "light",
        colorPalette: "vibrant",
        fontSizeScale: 1,
      },
    };
    const res = await svc.handle(payload);

    expect(res).toBeDefined();
    expect(Array.isArray(res.pages)).toBe(true);
    // NAT-CONT_0: Structure + Opening + Middle (2 chapters batched) + Closing = 4 pages
    expect(res.pages.length).toBe(4);

    // Check image contract fields
    const img = res.pages[0].image;
    expect(img).toBeDefined();
    expect(img.concept).toMatch(/Concept 1/);
    expect(img.style).toBeDefined();
    expect(img.palette_hint).toBe("vibrant");

    // Metadata
    expect(res.metadata).toBeDefined();
    expect(res.metadata.model).toBe("nat-cont_0");
    expect(res.metadata.pages_count).toBe(4);
  });

  it("non-JSON AI path: falls back to heuristic outline", async () => {
    const mockGen = {
      generateContent: async (_p) => ({
        content: { body: "Some plain text that is not JSON" },
      }),
    };

    await mockAI(mockGen);
    const mod = await import("../ebookService.js");
    const svc = mod.default || mod;

    const payload = {
      prompt: "Short text",
      metadata: {
        pageCount: 3,
        theme: "dark",
        colorPalette: "standard",
        fontSizeScale: 1,
      },
    };
    const res = await svc.handle(payload);

    expect(res).toBeDefined();
    expect(Array.isArray(res.pages)).toBe(true);
    // NAT-CONT_0 fallback: generates heuristic chapters from non-JSON response
    expect(res.pages.length).toBeGreaterThan(0);
  });

  it("throws on missing prompt", async () => {
    const mockGen = {
      generateContent: async () => ({ content: { body: "{}" } }),
    };
    await mockAI(mockGen);
    const mod = await import("../ebookService.js");
    const svc = mod.default || mod;

    await expect(svc.handle({})).rejects.toThrow(/prompt is required/);
  });

  it("throws on invalid pageCount", async () => {
    const mockGen = {
      generateContent: async () => ({ content: { body: "{}" } }),
    };
    await mockAI(mockGen);
    const mod = await import("../ebookService.js");
    const svc = mod.default || mod;

    const payload = { prompt: "X", metadata: { pageCount: 2 } };
    await expect(svc.handle(payload)).rejects.toThrow(
      /pageCount must be between 3 and 20/
    );
  });
});

describe("ebookService.handle() - strategy dispatch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("uses NAT-CONT_0 strategy", async () => {
    const mockGen = {
      generateContentWithRotation: vi.fn(async (prompt, callIndex) => {
        // Structure (callIndex 0)
        if (callIndex === 0) {
          return {
            content: {
              body: JSON.stringify({
                title: "NAT-CONT Test",
                chapters: 3,
                outline: [
                  { chapter: 1, title: "Ch1", estimated_topics: ["topic1"] },
                  { chapter: 2, title: "Ch2", estimated_topics: ["topic2"] },
                  { chapter: 3, title: "Ch3", estimated_topics: ["topic3"] },
                ],
              }),
            },
          };
        }
        // Any other callIndex returns single chapter
        return {
          content: {
            body: JSON.stringify({
              chapter: callIndex || 1,
              title: `Chapter ${callIndex || 1}`,
              content: `Content for chapter ${callIndex || 1}`,
              summary: `Summary ${callIndex || 1}`,
              image: {
                concept: "Concept",
                suggested_style: "contemporary",
                tone: "narrative",
              },
            }),
          },
        };
      }),
      generateContent: vi.fn(async () => ({
        content: {
          body: JSON.stringify({
            chapter: 1,
            title: "Chapter",
            content: "Content",
            summary: "Summary",
            image: { concept: "Concept", suggested_style: "contemporary" },
          }),
        },
      })),
    };
    await mockAI(mockGen);
    const mod = await import("../ebookService.js");
    const svc = mod.default || mod;

    const payload = {
      prompt: "Test story",
      metadata: { pageCount: 3 },
    };
    const result = await svc.handle(payload);

    expect(result).toBeDefined();
    expect(result.metadata.model).toBe("nat-cont_0");
    expect(Array.isArray(result.pages)).toBe(true);
    expect(result.pages.length).toBe(3);
  });

  it("returns correct output format for NAT-CONT_0", async () => {
    const mockGen = {
      generateContentWithRotation: vi.fn(async (prompt, callIndex) => {
        if (callIndex === 0 || prompt.includes("Create a detailed structure")) {
          return {
            content: {
              body: JSON.stringify({
                title: "Test Title",
                chapters: 3,
                outline: [
                  { chapter: 1, title: "Ch1", estimated_topics: ["t1"] },
                  { chapter: 2, title: "Ch2", estimated_topics: ["t2"] },
                  { chapter: 3, title: "Ch3", estimated_topics: ["t3"] },
                ],
              }),
            },
          };
        }
        return {
          content: {
            body: JSON.stringify({
              chapter: 1,
              title: "Test",
              content: "Test content",
              summary: "Test summary",
              image: {
                concept: "Test concept",
                suggested_style: "contemporary",
                tone: "narrative",
              },
            }),
          },
        };
      }),
      generateContent: vi.fn(async (prompt) => {
        if (prompt.includes("Create a detailed structure")) {
          return {
            content: {
              body: JSON.stringify({
                title: "Test Title",
                chapters: 3,
                outline: [
                  { chapter: 1, title: "Ch1", estimated_topics: ["t1"] },
                  { chapter: 2, title: "Ch2", estimated_topics: ["t2"] },
                  { chapter: 3, title: "Ch3", estimated_topics: ["t3"] },
                ],
              }),
            },
          };
        }
        return {
          content: {
            body: JSON.stringify({
              chapter: 1,
              title: "Test",
              content: "Test content",
              summary: "Test summary",
              image: {
                concept: "Test concept",
                suggested_style: "contemporary",
              },
            }),
          },
        };
      }),
    };
    await mockAI(mockGen);
    const mod = await import("../ebookService.js");
    const svc = mod.default || mod;

    // Test legacy strategy
    const legacyResult = await svc.handle({
      prompt: "Test",
      metadata: { pageCount: 3, theme: "dark" },
    });

    // Test NAT-CONT_0 strategy
    const natContResult = await svc.handle({
      prompt: "Test",
      metadata: { pageCount: 3, theme: "dark", strategy: "nat-cont_0" },
    });

    // Both should have same output shape
    expect(legacyResult).toHaveProperty("title");
    expect(legacyResult).toHaveProperty("pages");
    expect(legacyResult).toHaveProperty("metadata");
    expect(legacyResult).toHaveProperty("actions");

    expect(natContResult).toHaveProperty("title");
    expect(natContResult).toHaveProperty("pages");
    expect(natContResult).toHaveProperty("metadata");
    expect(natContResult).toHaveProperty("actions");

    // Both should have theme in metadata
    expect(legacyResult.metadata.theme).toBe("dark");
    expect(natContResult.metadata.theme).toBe("dark");

    // Both should support persist/export actions
    expect(legacyResult.actions.generate_pdf).toBe(true);
    expect(natContResult.actions.generate_pdf).toBe(true);
  });
});
