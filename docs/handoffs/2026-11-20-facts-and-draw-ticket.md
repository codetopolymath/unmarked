---
id: HANDOFF-2026-11-20-01
title: 'Handoff - record facts, Details rows and draw ticket'
type: handoff
status: active
created: 2026-11-20
updated: 2026-11-20
project: unmarked
tags: [handoff]
related: [ADR-014]
---

# Handoff - record facts, Details rows and draw ticket

## Resume Here ⟵ read this first

**Next action:** find out why the owner hears only instrumental "soundtrack" audio. First check whether the address has `?source=mock` (mock mode plays a synthesized drone from `src/js/services/tone-synth.js`, "not music"). If it does not, ask for example record names and look at the draw mix (see Problems).
**Branch / state:** `main`, code in sync with `origin/main` (Verified: `git status -sb`). **Uncommitted:** the docs changes listed below, including the new untracked ADR-014 and this handoff.
**Active task:** none (no task docs exist yet)

## Summary

Explained how the random draw works (with a visual explainer), researched Internet Archive and Commons metadata, then built and shipped three changes: fixed wrong facts, new Details rows, and a rolling draw ticket (ADR-014). Pushed and deployed. The session ended with an open question about why no sung music seems to play.

## Done

- Visual explainer of the draw (private artifact, 4 boards): https://claude.ai/artifact/SzVUdAQ2wYAbXbdbgx58HZ
- Three commits pushed to `main`: `ab0afcd` (data fixes), `4277f89` (Details rows), `bf42c18` (draw ticket).
- Deployed: the push run failed at the deploy step; a manual `workflow_dispatch` run succeeded and the live site serves `draw-ticket.js` (Verified).
- Docs: ADR-014, ADR index row, roadmap ticks, status, design spec §11 item 9, this handoff.

## Current State

- Data layer (`src/js/data/text.js`, `ia/normalize.js`, `commons/normalize.js`, `commons/client.js`, `ia/spoken.js`): performance year wins, readable languages, Commons composer/performer, `collection`, `audioFormat`, genre as a spoken-word guard.
- Details sheet (`src/js/core/format.js`): Collection, Composed by, Performed by, Audio rows, shown only when present.
- Draw ticket (`src/js/ui/draw-ticket.js`, `sampler.js`, `ia-source.js`, `buffered-source.js`, `state/app.js`, `ui/stage.js`): odometer counter to the real ticket; Archive draws only.

## Files Changed

| File                                                                                                                         | Change                                       | Why                 |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------- |
| `src/js/data/**`, `tests/unit/**`                                                                                            | Committed in `ab0afcd`, `4277f89`, `bf42c18` | See ADR-014         |
| `docs/decisions/ADR-014-facts-placement-and-draw-ticket.md`                                                                  | New, uncommitted                             | Record the decision |
| `docs/decisions/INDEX.md`, `docs/roadmap.md`, `docs/CURRENT_STATUS.md`, `docs/INDEX.md`, `docs/design/design-exploration.md` | Edited, uncommitted                          | Sync docs with code |
| `docs/handoffs/` (this file and `INDEX.md`)                                                                                  | New, uncommitted                             | Session handoff     |

## Decisions

- New facts go only in the Details sheet; genre is a guard, never shown; CSS/Web Animations, not WebGL (ADR-014, accepted on the owner's in-session approval).

## Verification

| Check                                 | Result         | Evidence                                                                   |
| ------------------------------------- | -------------- | -------------------------------------------------------------------------- |
| `npm run check` (lint, format, tests) | PASS           | 200 unit tests, 2026-11-20, run after the workflow's own review            |
| E2E suites                            | NOT RUN        | Need a browser                                                             |
| Draw-ticket animation, phone wrapping | NOT RUN        | Never seen in a browser                                                    |
| Live deploy                           | PASS           | `gh run list` success for run 44727613487; `curl` 200 on `draw-ticket.js`  |
| Genre guard measurement               | Agent-reported | 0 extra of 250 flagged; about 240 "Language" items; not re-run by the lead |

## Problems / Blockers

- **Problem:** owner hears only instrumental "soundtracks", no singing.
  - Tried: sampled 120 live Archive draws and 60 Commons files (scratch script, not kept in the repo). Keyword tally: about 22% instrumental, about 17% vocal, about 60% unclear. Many sung items exist in the frame (78 rpm songs, opera, live rock, hip-hop).
  - Current understanding: **Unknown.** Hypotheses: (1) `?source=mock` plays the drone (Inferred from `tone-synth.js`; live is the default per `main.js`); (2) electronic and instrumental sources are common (Jamendo, netlabels, Commons piano/classical).
  - Next: ask for the address and example titles; if live, measure the real mix by listening, and decide whether any response is wanted (a draw rule would break the no-steering stance, ADR-012).
- **Problem:** first deploy run failed ("Found 0 artifact(s)"). Re-running the failed job made it worse (2 artifacts in one run). A fresh `workflow_dispatch` run fixed it. Cause: Unknown (likely transient on GitHub's side).

## Pending

- [ ] Commit the docs (needs `git add docs`, which the assistant may not run): `docs: Record ADR-014 and sync status`, then push.
- [ ] Look at the draw ticket and Details rows in a browser and on a phone.
- [ ] Answer the "no singing" question (see Problems).
- [ ] Commons categories request: check on real draws (probed on only about 40 to 80 pages).

## Easy to Forget

- Do not re-run a failed Pages deploy job; start a new run with `gh workflow run pages.yml --ref main`.
- The explainer artifact is private; share it from its Share menu if needed.
- Probe scripts lived in the session scratchpad and may be gone.
- `yearOf` now returns no year for a composition-only date, on purpose.

## Suggested Next Prompt

> Read `docs/handoffs/2026-11-20-facts-and-draw-ticket.md` and ADR-014. Check git state first. The docs are uncommitted. Then help me work out why I only hear instrumental audio: I will tell you whether my address has `?source=mock` and give example record titles.
