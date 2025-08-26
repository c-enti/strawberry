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

  it("runs the USE_REAL_AI gated path with dummy endpoint and still returns a prompt (non-fatal)", async () => {
    // Enable the gate but point to a non-routable/dummy URL so the implementation
    // attempts the real-path and then falls back safely. This ensures the code
    // path that handles real API calls is exercised without needing credentials.
    process.env.USE_REAL_AI = "true";
    process.env.GEMINI_API_URL = "https://127.0.0.1:1/nonexistent";
    process.env.GEMINI_API_KEY = "DUMMY_KEY";

    const res = await generateWithGemini({ text: "test poem for gated path" });
    expect(res).toHaveProperty("prompt");
    expect(typeof res.prompt).toBe("string");

    // Cleanup env to avoid leaking to other tests
    delete process.env.USE_REAL_AI;
    delete process.env.GEMINI_API_URL;
    delete process.env.GEMINI_API_KEY;
  });
});
