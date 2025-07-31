module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
  coveragePathIgnorePatterns: ["/node_modules/", "/__tests__/"],
  moduleNameMapper: {
    "^@shared/(.*)$": "<rootDir>/../shared/$1",
  },
  // Enforce serial test execution for integration tests
  maxWorkers: 1,
};
