## @honeybook/hive [1.5.1](https://github.com/HoneyBook/hive/compare/@honeybook/hive@1.5.0...@honeybook/hive@1.5.1) (2026-07-09)

### Bug Fixes

- **packages:** add missing repository, license, and description metadata ([#23](https://github.com/HoneyBook/hive/issues/23)) ([caadc65](https://github.com/HoneyBook/hive/commit/caadc65e0be2f93a37195fdd26d071267ac31f69))

# Changelog

All notable changes to `@honeybook/hive` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

## [1.3.0] - 2026-05-26

### Added

- `TestKit#init()` lifecycle hook — runs once before the first `with*` call on a kit. Override for one-time setup (e.g., adapter wiring) that must not repeat. The existing `beforeWith()` continues to run on every `with*` call.
