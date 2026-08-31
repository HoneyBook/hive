# @honeybook/hive-mock-adapter-jest [1.0.0](https://github.com/HoneyBook/hive/compare/@honeybook/hive-mock-adapter-jest@0.2.0...@honeybook/hive-mock-adapter-jest@1.0.0) (2026-08-31)

- fix(mock-adapter-jest)!: move the **mocks** resolvers off the root entry ([c132091](https://github.com/HoneyBook/hive/commit/c132091b0b321191e2e9c0d24f04d7de08c4bb99))

### BREAKING CHANGES

- siblingMockResolver, mocksDirResolver and the MockResolver
  type move from the root entry to the ./resolvers subpath. Update jest config
  imports to require('@honeybook/hive-mock-adapter-jest/resolvers'). The ready-
  made ./resolver CJS shim and ./setup are unchanged.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

# @honeybook/hive-mock-adapter-jest [0.2.0](https://github.com/HoneyBook/hive/compare/@honeybook/hive-mock-adapter-jest@0.1.1...@honeybook/hive-mock-adapter-jest@0.2.0) (2026-08-30)

### Features

- **mock-adapter:** let a consumer choose what cleanup does between tests ([#25](https://github.com/HoneyBook/hive/issues/25)) ([b7c0abe](https://github.com/HoneyBook/hive/commit/b7c0abe5d0f741fd98fbf19b88c214bce1e61c73))

### Dependencies

- **@honeybook/hive-mock-adapter:** upgraded to 0.2.0

## @honeybook/hive-mock-adapter-jest [0.1.1](https://github.com/HoneyBook/hive/compare/@honeybook/hive-mock-adapter-jest@0.1.0...@honeybook/hive-mock-adapter-jest@0.1.1) (2026-07-09)

### Bug Fixes

- **packages:** add missing repository, license, and description metadata ([#23](https://github.com/HoneyBook/hive/issues/23)) ([caadc65](https://github.com/HoneyBook/hive/commit/caadc65e0be2f93a37195fdd26d071267ac31f69))

### Dependencies

- **@honeybook/hive-mock-adapter:** upgraded to 0.1.1
