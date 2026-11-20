---
id: HANDOFF-2026-11-20-02
title: 'Handoff - alternative sources research and the Audius source'
type: handoff
status: active
created: 2026-11-20
updated: 2026-11-20
project: unmarked
tags: [handoff, sources, audius]
related: [RES-001, RES-002, ADR-015, HANDOFF-2026-11-20-01]
---

# Handoff - alternative sources research and the Audius source

## Resume Here ⟵ read this first

**Next action:** pick the next source. The owner's order is Jamendo, then ccMixter (see [RES-002](../research/RES-002-priority-sources-audius-jamendo-ccmixter.md) follow-ups). Before that, the owner reads the Audius legal terms in a normal browser and pastes any clauses on attribution, commercial use and third-party apps.
**Branch / state:** `main`, committed and pushed at the end of this session (see the git log). Anything after that is not covered here.
**Active task:** none (no task docs exist yet)

## Summary

Researched music sources beyond the Internet Archive and Commons (RES-001), dug into Audius, Jamendo and ccMixter in the owner's priority order (RES-002), then built Audius as a third source (ADR-015). The owner chose to stay on anonymous Audius access for now.

## Done

- RES-001: survey of about 20 providers in three tiers, with evidence labels. Radio Browser parked as a future internet-radio idea.
- RES-002: Audius, Jamendo and ccMixter deep dive from live probes and official pages.
- Owner decisions recorded: Audius's mostly "All rights reserved" catalogue is acceptable (no download, no re-hosting); stay anonymous (no API key) for now.
- Audius source built: about 20% of draws, Preferences switch, Sources page entry, rights and link back shown.

## Current State

- `src/js/data/audius/`: `config.js` (empty `apiKey`, `appName: 'unmarked'`), `client.js` (Feeling Lucky list, by-id, stream URL), `normalize.js` (track to record, rights mapping, drop rules), `audius-source.js` (buffered source with a range probe).
- `src/js/data/live-source.js`: `AUDIUS_WEIGHT = 0.25`, `audiusEnabled` and `audiusSource` options, a part's `enabled()` keeps it out of every draw. `src/js/main.js` passes `audiusEnabled` from the `audius` preference.
- `src/js/ui/preferences.js`, `src/js/state/app.js`: the "Draw from Audius too" switch, default on, hidden in mock mode.
- `src/js/data/sources-catalog.js`: Audius is a selected source in its own group.

## Files Changed

| File                                                                                                                                | Change                          | Why                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------- |
| `src/js/data/audius/*` (4 new)                                                                                                      | Audius client, mapping, source  | Third source (ADR-015)                               |
| `src/js/data/live-source.js`, `src/js/main.js`, `src/js/state/app.js`, `src/js/ui/preferences.js`, `src/js/data/sources-catalog.js` | Wire, weight, switch, catalogue | Make Audius selectable and drawn                     |
| `tests/unit/audius-*.test.js` (3 new), `tests/unit/live-source.test.js`                                                             | 24 new unit tests               | Cover mapping, client, source, mixing                |
| `docs/research/` (3 new), `docs/decisions/ADR-015-audius-source.md`, this handoff                                                   | Research, decision, handoff     | Keep findings and reasons                            |
| `README.md`, `docs/PROJECT_OVERVIEW.md`, `docs/roadmap.md`, `docs/CURRENT_STATUS.md`, indexes, `mkdocs.yml`                         | Sync                            | Docs match the code; nav gains Research and Handoffs |

## Decisions

- Audius streams from its own API, rights shown as found, no download or re-hosting - owner accepted the rights position (ADR-015).
- Stay anonymous, no API key, reconsider later - owner choice, 2026-11-20 (ADR-015).
- Audius weight 0.25 beside 0.8 and 0.2, giving 64% / 16% / 20% - a guess to revisit after listening (ADR-015).

## Verification

| Check                   | Result   | Evidence                                                                                                   |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run check`         | PASS     | Lint, format, 224 unit tests (2026-11-20)                                                                  |
| `npm run test:e2e`      | PASS     | built 14, rescue 10, plus the other suites (2026-11-20)                                                    |
| Audius in real Chrome   | PASS     | Scratch script, not committed: draw, probe, played past 1.5 s of 194 s, link back, rights chip, switch off |
| `npm run test:live`     | NOT RUN  | Audius is not in it                                                                                        |
| Audius on a phone       | NOT RUN  |                                                                                                            |
| `mkdocs build --strict` | NOT RUN  | mkdocs is not installed here. A script checked every relative link and anchor in `docs/`: 0 broken         |
| Audius legal terms      | NOT READ | `audius.co` returns a Cloudflare block even in a normal Chrome; not bypassed                               |

## Problems / Blockers

- **Problem:** Audius legal terms unread.
  - Tried: fetch tool (403), headed Chrome with its own User-Agent (Cloudflare block). A retry with a changed User-Agent was refused by the session's safety check and not repeated.
  - Current understanding: Unknown. The developer plan page says "No Restrictions. Always Free" and calls the API key safe in client code (Verified).
  - Next: the owner reads `audius.co` terms in their own browser, or emails `api@audius.co`.
- **Problem:** carried over from the previous handoff, the owner hears only instrumental audio.
  - Current understanding: Unknown (cause not found). See [HANDOFF-2026-11-20-01](2026-11-20-facts-and-draw-ticket.md).
  - Next: check for `?source=mock`; Audius is not the cause (it was not live then).

## Pending

- [ ] Owner: Audius legal terms; decide on an API key later.
- [ ] Look at the Audius record on a phone and in the Details sheet; revisit the 20% share after listening.
- [ ] Jamendo spike: register a key; ask Jamendo whether a public `client_id` in a static page is acceptable (its terms say keep it private); test the audio host.
- [ ] ccMixter spike: one `<audio>` test from another origin (the audio host answered 403 to a plain request; the API sends no CORS header).
- [ ] Radio Browser stays a parked idea (roadmap).
- [ ] Add Audius to the live suite; pick the Jamendo duplicate handling when Jamendo is built.

## Easy to Forget

- No Audius API key is set. Requests identify as `app_name=unmarked`. To add one, set `apiKey` in `src/js/data/audius/config.js`; it is sent as `api_key` on every call and in the stream URL.
- A signed Audius node URL (`track.stream.url`) stopped working about 15 minutes after it was issued, so it is only a fallback behind the API stream route.
- The ccMixter API caps `limit` at about 30 and sends Latin-1 text labelled `text/plain`.
- Jamendo's documented test `client_id` is suspended.
- The scratch scripts (headed Chrome page reader, real-Chrome Audius check, link checker) lived in the session scratchpad and are not in the repo.
- CI builds the docs with `mkdocs build --strict`; a broken link or missing page fails the deploy, and it could not be run locally.

## Suggested Next Prompt

> Read `docs/handoffs/2026-11-20-audius-source.md`, then `docs/CURRENT_STATUS.md`. Inspect the code and git state before changing anything. Continue from "Resume Here": start the Jamendo spike from RES-002 (no implementation until the owner approves), unless the owner has pasted the Audius terms, in which case record them in ADR-015 first.
