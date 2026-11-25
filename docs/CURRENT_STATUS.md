---
id: STATUS-001
title: 'Current Project Status'
type: status
status: active
created: 2026-11-19
updated: 2026-11-23
project: unmarked
tags: [status]
related: [DOC-001]
---

# Current Status

> Describes **now**, not history. Rewrite, don't append.

**Phase:** early beta · **Focus:** Audius as a third source (ADR-015), then device checks · **Updated:** 2026-11-25

## Health

> 2026-11-25: UX audit fixes landed (undo, Kept remove and backup line, Library paging, tab keys, Media Session state; see [roadmap](roadmap.md) and [RES-004](research/RES-004-ux-audit.md)). A second pass added Keep in the dock, modal Preferences, a failure notice that names the sources, a Docs fallback, a folded Sources list and 44 px touch targets. `npm run check` PASS (225 unit tests) and `npm run test:e2e` PASS (91 interaction checks). Not yet seen on a real phone.

| Area                                 | Status      | Note                                                                                                            |
| ------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------- |
| Discovery (Archive + Commons)        | Active      | Live; roadmap items mostly done                                                                                 |
| Playback rescue                      | Active      | Fallback URLs shipped (ADR-005)                                                                                 |
| Map freshness                        | Active      | Built 2026-11-18, fresh (`npm run check:map`)                                                                   |
| Record facts and Details rows        | Built       | Year fix, readable languages, Commons roles, collection, audio format; unit-tested (ADR-014)                    |
| Audius source                        | Built       | About 1 draw in 5, Preferences switch; played in real Chrome; anonymous by choice; legal terms unread (ADR-015) |
| Draw ticket (rolling counter)        | Built       | Unit-tested; not yet seen in a browser or on a phone                                                            |
| Real-device and cross-browser checks | In progress | iPhone: Docs sheet and Preferences OK (owner, 2026-11-19); lock screen, background audio, VoiceOver open        |
| E2E in CI                            | Planned     | Local only today                                                                                                |

## In Progress

- Three commits (`ab0afcd`, `4277f89`, `bf42c18`) are pushed and deployed (2026-11-20). They still need a look in a browser (ticket animation, phone wrapping). The owner also reported hearing only instrumental "soundtrack" audio: cause Unknown, see the [handoff](handoffs/2026-11-20-facts-and-draw-ticket.md).
- Audius is built, committed and pushed (2026-11-20), see [ADR-015](decisions/ADR-015-audius-source.md). Research behind it: [RES-001](research/RES-001-alternative-music-sources.md), [RES-002](research/RES-002-priority-sources-audius-jamendo-ccmixter.md). Anonymous access, by owner choice (no API key for now). Open: the Audius legal terms (blocked here; owner reads them) and a phone check. ccMixter was tested in real Chrome on 2026-11-23 and ruled out (hotlink-protected audio, see RES-002). Jamendo is next: it needs the owner's key and an answer from Jamendo on a public `client_id`.
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
- Checks: `npm run check` PASS (lint, format, 224 unit tests, 2026-11-20); `npm run test:e2e` PASS (2026-11-20)
- Live suite (`test:live`) and Audius on a phone: NOT RUN; draw-ticket animation visual check: NOT RUN
- Audius real-Chrome check: PASS, scratch script, not committed (draw, probe, play past 1.5 s, link back, rights chip, switch off)
- Deployment: GitHub Pages via `pages.yml`. The push run failed at the deploy step (artifact lookup); a manual `workflow_dispatch` run succeeded and the live site serves `draw-ticket.js` (Verified: `gh run list`, `curl`, 2026-11-20)
- Known issues: spoken-word misses outside the denylist; Commons records have generated art only; Commons role text that is not label-first stays a plain artist; Commons categories request only probed on about 40 to 80 pages

## Risks

| Risk                                               | Impact                             | Mitigation                                                |
| -------------------------------------------------- | ---------------------------------- | --------------------------------------------------------- |
| Stale Archive map                                  | New uploads missed, nothing breaks | Sources page age, CI warning (ADR-011)                    |
| Archive terms wording ("scholarship and research") | Residual ambiguity                 | Personal use only; revisit if scope grows (ADR-003)       |
| Audius legal terms unread                          | Could limit third-party apps       | Owner reads them; switch lets listeners opt out (ADR-015) |

## Resume

Read the [latest handoff](handoffs/2026-11-20-audius-source.md), then [roadmap](roadmap.md). Decision records: [ADR-015](decisions/ADR-015-audius-source.md), [ADR-014](decisions/ADR-014-facts-placement-and-draw-ticket.md). The earlier [handoff](handoffs/2026-11-20-facts-and-draw-ticket.md) still holds the open "only instrumental audio" question.
