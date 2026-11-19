---
id: DOC-001
title: 'Project Overview'
type: overview
status: active
created: 2026-11-19
updated: 2026-11-19
project: unmarked
tags: [overview]
related: [DOC-002, STATUS-001]
source: README.md
---

# Unmarked

**TL;DR:** A personal music-discovery web app. One record at a time, drawn at random from the Internet Archive and Wikimedia Commons: no genres, regions, decades, moods, popularity or recommendations, and nothing learns from what you play. Early beta, live at https://codetopolymath.github.io/unmarked/.

## Goals

- Treat each discovery as an "accession": a numbered item with its source and licence stated plainly, or stated as unknown.
- Stream from the archives' own servers; never download or re-host audio.

## Non-goals

- Categories, filters, recommendations, learning from listening (product rule, see [ADR-001](decisions.md#name-unmarked)).
- Commercial use (see [ADR-003](decisions.md#internet-archive-terms-read-in-full-2026-11-18)).

## Users

- Personal, non-commercial project (Verified: README, decisions.md). Other stakeholders: Unknown.

## Stack

| Layer       | Tech                                                                    | Evidence                                                                   |
| ----------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| App         | Plain HTML, CSS, native ES modules; no runtime dependencies             | `src/`, `package.json`                                                     |
| Dev tooling | ESLint, Prettier, Node built-in test runner; Node >=22                  | `package.json`                                                             |
| E2E         | Real Chrome over DevTools                                               | `tests/e2e/`                                                               |
| Deploy      | GitHub Actions to GitHub Pages; `tools/stamp.mjs` content-hashes URLs   | `.github/workflows/`, `tools/stamp.mjs`                                    |
| Data        | Internet Archive (about 80% of draws) and Wikimedia Commons (about 20%) | `src/js/data/`, [ADR-009](decisions.md#wikimedia-commons-added-2026-11-18) |

## How It Fits Together

- UI components receive `{ store, clock, actions }` and never import data sources; `src/js/main.js` wires sources in.
- Sampling uses a static partition map of the Archive (`src/data/ia-map.json`), rebuilt about monthly with `npm run build:map`.
- Every record is validated (metadata, playable file, 2-byte range probe) before it is shown; playback falls back across URLs.

## Key Entry Points

- Run: `npm start` (Verified: `package.json`)
- Test: `npm test`, `npm run check` (Verified: 158 unit tests PASS, 2026-11-19)
- Main code: `src/js/main.js`, `src/js/state/app.js`, `src/js/data/`

## Unknowns

- Whether `design-exploration.md` is a frozen record or a living spec (treated as historical for now).
- Whether the two open `(decision)` items in the roadmap are still wanted.

## Links

- [Current status](CURRENT_STATUS.md) · [Index](INDEX.md) · [Roadmap](roadmap.md) · [README](../README.md)
