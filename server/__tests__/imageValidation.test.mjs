import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { validateImage } from "../imageValidation.mjs";

describe("imageValidation", () => {
  it("validates a small generated PNG buffer", async () => {
    const svg = `<svg width="32" height="16" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="16" fill="#ff0000"/></svg>`;
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();

    const res = await validateImage(buf);
    expect(res.ok).toBe(true);
    expect(res.width).toBeGreaterThan(0);
    expect(res.height).toBeGreaterThan(0);
    expect(res.format).toBeTruthy();
  });

  it("returns error for invalid input", async () => {
    const res = await validateImage(12345);
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });
});
