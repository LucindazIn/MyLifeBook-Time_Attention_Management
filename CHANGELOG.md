# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-23

### Added

- Initial version tracking via `VERSION` and this changelog.

### Fixed

- `ChapterViewModal`: narrow `parseChapterAiPaste` result with `r.ok === false` so `tsc --noEmit` passes.
- `useAuth`: remove localhost debug ingest calls; authentication traffic uses Supabase only.

### Changed

- QA artifacts under `.gstack/` remain gitignored; run `/qa` locally to regenerate reports.
