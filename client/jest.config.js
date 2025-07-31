/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    // Handle module aliases (if you're using them in tsconfig.json)
    "^@/(.*)$": "<rootDir>/src/$1",
    // Handle CSS imports (if you're using them)
    "^.+\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  testEnvironmentOptions: {
    url: "http://localhost:3000",
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "/playwright/", // Ignore Playwright tests
    "/playwright-report/",
  ],
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{js,jsx,ts,tsx}",
    "!src/**/*.test.{js,jsx,ts,tsx}",
    "!src/**/index.{js,jsx,ts,tsx}",
    "!src/app/layout.tsx", // Next.js boilerplate
    "!src/app/page.tsx", // Next.js page will be tested in e2e
    "!**/node_modules/**",
  ],
  coverageReporters: [
    "text",
    "lcov",
    "json-summary",
    "html", // Added HTML for better local visualization
  ],
  // Starting with achievable thresholds
  coverageThreshold: {
    global: {
      statements: 30,
      branches: 25,
      functions: 35,
      lines: 30,
    },
    // Specific thresholds for critical paths
    "./src/utils/": {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
};
