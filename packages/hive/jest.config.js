module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test-kits'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node16',
        ignoreDeprecations: '5.0',
        strict: true,
        esModuleInterop: true,
        experimentalDecorators: true,
        skipLibCheck: true,
      }
    }]
  }
};
