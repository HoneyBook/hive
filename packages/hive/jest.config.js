module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test-kits'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { diagnostics: false }]
  }
};
