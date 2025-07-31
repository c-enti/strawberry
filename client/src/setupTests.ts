import "@testing-library/jest-dom";

// Reset environment variables before each test
beforeEach(() => {
  process.env = {
    ...process.env,
    NEXT_PUBLIC_GEMINI_API_URL: "https://api.gemini.test",
    NEXT_PUBLIC_GEMINI_API_KEY: "test-key",
  };
});
