module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testTimeout: 30000, // 30 seconds timeout for integration tests
  
  // Setup file to load test environment
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Separate test patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
  ],
  
  // Don't transform node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(supertest)/)'
  ],
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
  
  // Verbose output
  verbose: false,
  
  // Detect open handles (useful for debugging)
  detectOpenHandles: false,
  forceExit: true,
};
