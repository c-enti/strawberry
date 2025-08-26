import { describe, it, expect } from "vitest";
import { generateWithGemini } from "../imageGenerator.js";

describe("generateWithGemini (gated)", () => {
  it("falls back to offline stub when env not set", async () => {
    delete process.env.GEMINI_API_URL;
    delete process.env.GEMINI_API_KEY;
    const res = await generateWithGemini({ text: "test poem" });
    expect(res).toHaveProperty("prompt");
    expect(typeof res.prompt).toBe("string");
  });
});
