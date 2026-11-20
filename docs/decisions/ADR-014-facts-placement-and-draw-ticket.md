---
id: ADR-014
title: 'Record facts live in Details; the real draw ticket is shown'
type: adr
status: accepted
created: 2026-11-20
updated: 2026-11-20
project: unmarked
tags: [metadata, details, motion, spoken-word]
related: [ADR-008, ADR-009, ADR-012]
---

# ADR-014: Record facts live in Details; the real draw ticket is shown

**Decision:** We will fix wrong facts in the data layer, show new facts (collection, composer, performer, audio format) only in the Details sheet, read the Archive `genre` field only as a spoken-word guard, and show the real random ticket on the stage.
**Status:** accepted (owner approved the placement rule and the animation approach in session, 2026-11-20) · **Date:** 2026-11-20

## Context

- A live sample (50 Archive items, 80 Commons files; small, so rough) showed rich but patchy metadata: Archive creator 88%, date 74%, language 34%, country 24%, genre 26%; Commons license and categories on every file, artist 68%, date 56%.
- Verified bug: `yearOf` took the first four digits, so Commons text like `Composition: 1885 / Performance: 1991` showed 1885, and an "original upload date" could show as the recording year.
- Verified: the Archive `genre` field was never read. Sampled values included "Sermon" and "Language".
- The product has no genres, moods or recommendations (ADR-012, design spec §11 item 7). Anything new must show facts without steering.
- The main screen is deliberately sparse; extra detail must not clutter it.

## Drivers

- Correct facts before more facts.
- Provenance, not genre: say where a record was filed.
- Keep the main screen unchanged except for the draw itself.
- Calm, battery-light motion in the existing "Accession" language.

## Options

| Option                       | Pros                                       | Cons                                               |
| ---------------------------- | ------------------------------------------ | -------------------------------------------------- |
| New facts on the main screen | Visible at once                            | Clutter; edges toward tag/genre UI                 |
| **New facts in Details**     | Sheet already shows rows only when present | One tap away                                       |
| Genre as filter or label     | Easy to build                              | Recreates genres, breaks the product rule          |
| **Genre as spoken guard**    | Removes non-music; invisible to the user   | A wrong match hides real music (precision-first)   |
| WebGL draw animation         | Spectacular                                | Battery cost; clashes with the index-card language |
| **CSS and Web Animations**   | Light, uses existing motion tokens         | Less spectacle                                     |
| No draw display              | Nothing to build                           | Hides the real randomness                          |

(WebGL and the "no display" option were considered now, not in earlier docs.)

## Rationale

- **Details only.** Rows appear only when the record states them, so sparse records stay clean. Performed by is hidden when it repeats the artist under the title. Verified in `format.js` and its tests.
- **Dates.** The performance year wins; composition-only and upload dates give no year rather than a wrong one. Verified by unit tests.
- **Genre guard.** Whole-value match only (`Sermon`, `Language`, `Spoken Word`, `Lecture`, `Speech`, `Interview`, `Audiobook`). Workflow agent measured it on 250 uniform items: 0 extra items flagged beyond the old rule. Targeted queries found about 240 "Language" items (mostly 78 rpm lesson records) that only this rule catches. Measurements were made by the agent, not re-run by the lead: treat as Verified (agent) and re-measure if the rule grows. "Story" was left out because many of those 78s are songs.
- **Draw ticket.** The Archive draw is one rank in the whole frame (ADR-011's map). Showing it ("Ticket 385,611 of 932,104", with the upload window) makes the draw honest, and it also answers the open question in design spec §11 item 9 about showing the size of the random universe. Commons has no ticket (its server picks), so it keeps the old status text.

## Consequences

- **Positive:** correct years, richer Details without clutter, about 240 more non-music records kept out, the randomness is visible.
- **Negative:** Commons queries now request categories (larger replies); the ticket line is longer on phones.
- **Risks:** genre guard false positives; Commons role parsing only handles label-first text (`Bach (composer), Gould (performer)` stays a plain artist); the animation has not been seen in a browser.

## Implementation Notes

- Record fields added: `collection {id,label}`, `credits.composer`, `credits.performer`, `audioFormat {playing, original?}`, `draw {rank,total,from,to}` (Archive only).
- Collection comes from the Archive collection id (frame collections only) or a Commons `Audio files from <Institution>` category; topic categories are ignored.
- Commits: `ab0afcd` (data), `4277f89` (Details rows), `bf42c18` (draw ticket).
- Evidence: `npm run check` PASS, 200 unit tests (2026-11-20). E2E suites: NOT RUN. Draw-ticket animation and phone wrapping: NOT RUN (no browser check yet).

## Revisit When

- A listener reports non-music still getting through, or real music missing, and genre is implicated.
- The Commons categories reply proves too heavy or unreliable on real draws.
- The ticket line wraps badly on a real phone, or the animation costs noticeable battery.

## References

- [ADR-008](../decisions.md#spoken-word-filter-internet-archive) · [ADR-009](../decisions.md#wikimedia-commons-added-2026-11-18) · [ADR-011](../decisions.md#map-rebuild-internet-archive) · [design spec §11](../design/design-exploration.md)
- `src/js/data/text.js` · `src/js/data/ia/spoken.js` · `src/js/core/format.js` · `src/js/ui/draw-ticket.js`
