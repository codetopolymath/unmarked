---
id: STATUS-001
title: 'Current Project Status'
type: status
status: active
created: 2026-11-19
updated: 2026-11-20
project: unmarked
tags: [status]
related: [DOC-001]
---

# Current Status

> Describes **now**, not history. Rewrite, don't append.

**Phase:** early beta · **Focus:** record facts and the draw ticket (ADR-014), then device checks · **Updated:** 2026-11-20

## Health

| Area                                 | Status      | Note                                                                                                     |
| ------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------- |
| Discovery (Archive + Commons)        | Active      | Live; roadmap items mostly done                                                                          |
| Playback rescue                      | Active      | Fallback URLs shipped (ADR-005)                                                                          |
| Map freshness                        | Active      | Built 2026-11-18, fresh (`npm run check:map`)                                                            |
| Record facts and Details rows        | Built       | Year fix, readable languages, Commons roles, collection, audio format; unit-tested (ADR-014)             |
| Draw ticket (rolling counter)        | Built       | Unit-tested; not yet seen in a browser or on a phone                                                     |
| Real-device and cross-browser checks | In progress | iPhone: Docs sheet and Preferences OK (owner, 2026-11-19); lock screen, background audio, VoiceOver open |
| E2E in CI                            | Planned     | Local only today                                                                                         |

## In Progress

- Three commits (`ab0afcd`, `4277f89`, `bf42c18`) are pushed and deployed (2026-11-20). They still need a look in a browser (ticket animation, phone wrapping). The owner also reported hearing only instrumental "soundtrack" audio: cause Unknown, see the [handoff](handoffs/2026-11-20-facts-and-draw-ticket.md).
- Real-device checks on iPhone (see Health). The PKB docs migration and the docs site are finished.

## Blocked

- None known.

## Next (priority order)

Source: [roadmap](roadmap.md), open items only; owner decisions marked.

1. Find out why only instrumental audio is heard (check for `?source=mock`; then see the handoff), and look at the draw ticket and new Details rows in a browser and on a phone.
2. Real-device verification of Media Session and autoplay (iOS Safari).
3. Run e2e tests in CI.
4. Decide (owner confirmed still wanted, 2026-11-19): scheduled map-age workflow, Commons 80/20 weights, light theme.

## Current Facts

- Branch: `main`, in sync with `origin/main` for code; these docs changes are uncommitted (Verified: `git status -sb`, 2026-11-20)
- Checks: `npm run check` PASS (lint, format, 200 unit tests, 2026-11-20)
- E2E and live suites: NOT RUN this session; draw-ticket animation visual check: NOT RUN
- Deployment: GitHub Pages via `pages.yml`. The push run failed at the deploy step (artifact lookup); a manual `workflow_dispatch` run succeeded and the live site serves `draw-ticket.js` (Verified: `gh run list`, `curl`, 2026-11-20)
- Known issues: spoken-word misses outside the denylist; Commons records have generated art only; Commons role text that is not label-first stays a plain artist; Commons categories request only probed on about 40 to 80 pages

## Risks

| Risk                                               | Impact                             | Mitigation                                          |
| -------------------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| Stale Archive map                                  | New uploads missed, nothing breaks | Sources page age, CI warning (ADR-011)              |
| Archive terms wording ("scholarship and research") | Residual ambiguity                 | Personal use only; revisit if scope grows (ADR-003) |

## Resume

Read the [latest handoff](handoffs/2026-11-20-facts-and-draw-ticket.md), then [roadmap](roadmap.md). Decision record: [ADR-014](decisions/ADR-014-facts-placement-and-draw-ticket.md).
