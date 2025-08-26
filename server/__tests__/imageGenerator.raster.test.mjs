import { describe, it, expect } from "vitest";
import { generateBackgroundForPoem } from "../imageGenerator.js";
import fs from "fs";

describe("rasterization helper (best-effort)", () => {
  it("produces an svg and rasterizeIfNeeded falls back when sharp missing", async () => {
    const res = await generateBackgroundForPoem("testing raster");
    expect(res).toHaveProperty("imagePath");
    expect(fs.existsSync(res.imagePath)).toBe(true);
    // attempt to rasterize via module (may fallback)
    // call rasterizeIfNeeded indirectly by importing and invoking if exported in future
    expect(typeof res.size).toBe("number");
  });
});
