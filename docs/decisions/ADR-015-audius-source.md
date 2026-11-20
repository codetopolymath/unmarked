---
id: ADR-015
title: 'Audius is a third source, drawn from its Feeling Lucky list'
type: adr
status: accepted
created: 2026-11-20
updated: 2026-11-20
project: unmarked
tags: [sources, audius, rights, preferences]
related: [RES-001, RES-002, ADR-003, ADR-005, ADR-009, ADR-012]
---

# ADR-015: Audius is a third source, drawn from its Feeling Lucky list

**Decision:** We will draw about one record in five from Audius through its official REST API (`/tracks/feeling-lucky`), stream it directly from Audius, show its rights as stated, link back to the Audius track, and let the listener switch Audius off in Preferences.
**Status:** accepted (owner approved the rights position and the build, 2026-11-20) · **Date:** 2026-11-20

## Context

- [RES-002](../research/RES-002-priority-sources-audius-jamendo-ccmixter.md) found Audius the only priority candidate that works end to end from a static browser app: open CORS, a random endpoint, range-capable MP3 (Verified, probes 2026-11-20).
- In a 200-track sample, 59% of tracks said "All rights reserved", 38% stated nothing and 3% were Creative Commons. The owner accepted this for a personal listening app that offers no download and never re-hosts audio.
- Audius's legal terms are **unread**: `audius.co` blocks this machine even in a normal Chrome, and was not bypassed. The readable developer plan page says "No Restrictions. Always Free" and calls the API key safe in client code.
- The app has no backend, so anything it calls must work from the browser and hold no secret.

## Drivers

- Random draw with no search, genre or popularity steering ([ADR-012](../decisions.md#product-defaults)).
- Reuse the existing playback pipeline, probing and rescue ([ADR-005](../decisions.md#playback-rescue)).
- State rights as found, never imply a licence to reuse.

## Options

| Option                           | Pros                                                       | Cons                                                             |
| -------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| **Feeling Lucky endpoint**       | A random batch of up to 100 per call                       | A curated list, not a uniform draw; leans electronic and hip-hop |
| Trending or underground trending | Simple                                                     | Capped pool of popular tracks, against "unmarked"                |
| Search by genre or random query  | Reaches deeper                                             | Search steers; breaks the product rule                           |
| **Switch in Preferences**        | Listener can leave a mostly all-rights-reserved source out | One more setting                                                 |
| Always on                        | No setting                                                 | No way to opt out of the highest-risk source                     |

## Rationale

- **Feeling Lucky.** Two calls of 100 gave 200 unique tracks with no overlap; all were streamable and ungated (Verified, probe). Whether Audius picks them uniformly is Unknown.
- **Weight.** Weights are relative, so Audius at 0.25 beside the Archive (0.8) and Commons (0.2) gives 64% / 16% / 20% and keeps the Archive-to-Commons ratio ([ADR-009](../decisions.md#wikimedia-commons-added-2026-11-18)). The share is a guess to revisit after listening.
- **Rights.** The artist's text maps to "All rights reserved", "Licence not stated" or a Creative Commons label with terms. No licence URL is claimed because Audius gives no version (Inferred). Details already ends with "Streaming here is not a licence to reuse this recording."
- **Attribution.** Every Audius record shows the artist and a "Found on Audius" link to the track page, which also appears in the copyable credit. No attribution rule could be read in the terms; this is the conservative reading (Assumption).
- **Key.** The API key is public by design. **Owner decision (2026-11-20): stay anonymous for now and reconsider later.** Requests go anonymous, identified by `app_name=unmarked` (the spec lists anonymous read access; Verified, `swagger.yaml`). A registered key is a one-line config change.

## Consequences

- **Positive:** a catalogue of independent music beyond archives, drawn at random, with the same playback, rescue and Details as the others.
- **Negative:** most Audius records read "All rights reserved" or "Licence not stated"; the mix leans electronic and hip-hop.
- **Risks:**
  - The legal terms are unread. They could forbid third-party apps or require attribution we do not show.
  - Quota is shared by all listeners through one key (500,000 requests a month on the free plan; whether stream requests count is Unknown).
  - The signed node URL lapses (a 15-minute-old one stopped answering), so it is only a fallback behind the API stream route.
  - Audius is young, decentralised and has no stated SLA.

## Implementation Notes

- Files: `src/js/data/audius/` (`config.js`, `client.js`, `normalize.js`, `audius-source.js`), wired in `src/js/data/live-source.js` and `src/js/main.js`.
- Tracks are dropped when gated, unlisted, deleted, key-restricted, not streamable, under 30 s, or without a title or a link back. Each candidate's stream is range-probed before it is shown.
- Preference `audius` (default on) is read at draw time; switching it off removes Audius from every draw, including as a fallback.
- The Sources page lists Audius as in scope under its own group.
- Evidence: `npm run check` PASS, 224 unit tests; `npm run test:e2e` PASS. A real-Chrome run drew an Audius record through the app, played it (clock past 1.5 s, 194 s long), showed the artist, rights chip and a `noopener` link back, and drew no Audius record while switched off (2026-11-20, scratch script, not committed).
- Not done: a registered API key; a phone check; live (`test:live`) coverage of Audius.

## Revisit When

- The Audius legal terms are read and say anything about third-party apps, attribution or commercial use.
- A key is registered (set `apiKey` in `config.js`) or Audius starts rejecting anonymous reads.
- Listening shows the 20% share or the genre lean is wrong.
- The project stops being personal and non-commercial.

## References

- [RES-001](../research/RES-001-alternative-music-sources.md) · [RES-002](../research/RES-002-priority-sources-audius-jamendo-ccmixter.md) · [ADR-003](../decisions.md#internet-archive-terms-read-in-full-2026-11-18) · [ADR-005](../decisions.md#playback-rescue)
- `src/js/data/audius/` · `src/js/data/live-source.js` · `tests/unit/audius-*.test.js`
