import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Load the CommonJS implementation and re-export named functions for ESM callers
const cjs = require("./imageGenerator.js");

export const generateWithGemini = cjs.generateWithGemini;
export const generateBackgroundForPoem = cjs.generateBackgroundForPoem;
export const generatePoemAndImage = cjs.generatePoemAndImage;
export const verifyImageMatchesText = cjs.verifyImageMatchesText;

// Default export for consumers expecting default
export default {
  generateWithGemini,
  generateBackgroundForPoem,
  generatePoemAndImage,
  verifyImageMatchesText,
};
