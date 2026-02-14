module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Use V8 coverage provider to avoid the Istanbul/glob@13 incompatibility
  // (glob@13 exports an object, breaking test-exclude's util.promisify(glob) call)
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    // Type-only files (no runtime code)
    '!src/types/**',
    // Re-export barrel (no logic)
    '!src/index.ts',
    // Action entry points — require GitHub Actions runtime context;
    // covered by integration tests, not unit tests
    '!src/actions/**/index.ts',
    // GitHub API wrapper — requires Octokit integration tests
    '!src/core/github-api.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
};
