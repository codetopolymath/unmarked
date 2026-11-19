---
id: STATUS-001
title: 'Current Project Status'
type: status
status: active
created: 2026-11-19
updated: 2026-11-19
project: unmarked
tags: [status]
related: [DOC-001]
---

# Current Status

> Describes **now**, not history. Rewrite, don't append.

**Phase:** early beta · **Focus:** discovery reliability and docs · **Updated:** 2026-11-19

## Health

| Area                                 | Status      | Note                                          |
| ------------------------------------ | ----------- | --------------------------------------------- |
| Discovery (Archive + Commons)        | Active      | Live; roadmap items mostly done               |
| Playback rescue                      | Active      | Fallback URLs shipped (ADR-005)               |
| Map freshness                        | Active      | Built 2026-11-18, fresh (`npm run check:map`) |
| Real-device and cross-browser checks | Not started | iOS Safari, lock screen, VoiceOver            |
| E2E in CI                            | Planned     | Local only today                              |

## In Progress

- Docs migration to PKB format (this session).

## Blocked

- None known.

## Next (priority order)

Source: [roadmap](roadmap.md), open items only; owner decisions marked.

1. Real-device verification of Media Session and autoplay (iOS Safari).
2. Run e2e tests in CI.
3. Decide: scheduled map-age workflow, Commons 80/20 weights, light theme, waveform, track favourites.

## Current Facts

- Branch: `main`
- Unit tests: PASS, 158 (`npm test`, 2026-11-19)
- E2E and live suites: NOT RUN this session
- Deployment: GitHub Pages via `pages.yml`; live state not checked this session (Unknown)
- Known issues: spoken-word misses outside the denylist; Commons records have generated art only

## Risks

| Risk                                               | Impact                             | Mitigation                                          |
| -------------------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| Stale Archive map                                  | New uploads missed, nothing breaks | Sources page age, CI warning (ADR-011)              |
| Archive terms wording ("scholarship and research") | Residual ambiguity                 | Personal use only; revisit if scope grows (ADR-003) |

## Resume

Start with [roadmap](roadmap.md). No handoffs yet.
