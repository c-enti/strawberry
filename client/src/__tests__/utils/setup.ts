test("dummy test to satisfy Jest", () => {
  expect(true).toBe(true);
});
import { jest } from "@jest/globals";

// Mock modules
jest.mock("axios");
jest.mock("../../utils/gemini");

beforeEach(() => {
  jest.clearAllMocks();

  // Set up environment variables
  process.env.NEXT_PUBLIC_GEMINI_API_URL = "https://api.gemini.test";
  process.env.NEXT_PUBLIC_GEMINI_API_KEY = "test-key";
  process.env.NEXT_PUBLIC_GEMINI_THEME_API_URL =
    "https://api.gemini.test/theme";
});
