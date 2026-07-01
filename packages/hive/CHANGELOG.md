# Changelog

All notable changes to `@honeybook/hive` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

## [1.3.0] - 2026-05-26

### Added

- `TestKit#init()` lifecycle hook — runs once before the first `with*` call on a kit. Override for one-time setup (e.g., adapter wiring) that must not repeat. The existing `beforeWith()` continues to run on every `with*` call.
