module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  roots: ['<rootDir>/tests/unit'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/serverless.ts',
    '!src/**/*.module.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  clearMocks: true,
  modulePathIgnorePatterns: ['<rootDir>/dist'],
};
