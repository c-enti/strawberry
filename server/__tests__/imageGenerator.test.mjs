import { describe, it, expect } from "vitest";
import {
  generateBackgroundForPoem,
  generatePoemAndImage,
} from "../imageGenerator.js";
import fs from "fs";

describe("imageGenerator (offline)", () => {
  it("generateBackgroundForPoem returns svg path and size", async () => {
    const res = await generateBackgroundForPoem("soft background, test prompt");
    expect(res).toHaveProperty("imagePath");
    expect(res).toHaveProperty("size");
    expect(typeof res.size).toBe("number");
    expect(fs.existsSync(res.imagePath)).toBe(true);
  });

  it("generatePoemAndImage throws on missing poem and returns structure on success", async () => {
    await expect(generatePoemAndImage()).rejects.toThrow();

    const poem = "Short poem line one\nline two";
    const dest = await generatePoemAndImage(poem, {});
    expect(dest).toHaveProperty("visualPrompt");
    expect(dest).toHaveProperty("imagePath");
    expect(dest).toHaveProperty("size");
    expect(typeof dest.visualPrompt).toBe("string");
    expect(typeof dest.size).toBe("number");
  });
});
