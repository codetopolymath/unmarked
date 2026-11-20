# Unmarked

A personal music-discovery app. One record at a time, drawn at random from open archives: no genres, regions, decades, moods, popularity rankings or recommendations, and nothing learns from what you play.

**Status: early beta.** Records are drawn at random from the Internet Archive's music collections, Wikimedia Commons' music category and Audius (switchable in Preferences), and streamed from their servers. A mock mode with fictional records and synthesized audio remains for design work. See the [roadmap](docs/roadmap.md) for what is still missing.

**Live prototype:** https://codetopolymath.github.io/unmarked/

## Why this exists

Most "random" music apps shuffle a catalogue you already know how to reach. Unmarked treats each discovery as an _accession_: a numbered item drawn from archives of recordings (78 rpm sides, netlabel releases, digitized LPs) with its source and licence stated plainly, or stated as unknown when it is.

## Run it locally

Requires Node 22 or newer. The app itself has no runtime dependencies and needs no build step for development; only the deploy runs `npm run build` (content-hashed URLs for caching).

```sh
npm install   # dev tooling only: linter, formatter
npm start     # serves src/ at http://127.0.0.1:4173/
```

The app draws from the live Internet Archive, Wikimedia Commons and Audius by default. Add `?source=mock` to the URL to use the fictional catalogue instead (design work, tests, offline).

Click **Discover another** or press **D**. Press **?** for shortcuts and **P** for the prototype controls (jump to edge-case records, simulate failures).

## Scripts

| Command             | What it does                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `npm start`         | Static dev server for `src/`                                                                    |
| `npm run check`     | Lint, format check and unit tests (what CI runs)                                                |
| `npm test`          | Unit tests (Node's built-in runner)                                                             |
| `npm run test:e2e`  | End-to-end suites in a real Chrome (needs Chrome; set `CHROME_PATH` if not on the default path) |
| `npm run build`     | Copy `src/` to `dist/` with content-hashed URLs (what the deploy publishes)                     |
| `npm run check:map` | Report how old the Archive map is; warns after 45 days (`npm run build:map` rebuilds it)        |
| `npm run lint`      | ESLint                                                                                          |
| `npm run format`    | Prettier, write                                                                                 |

## Layout

```
src/                  the deployed site (plain HTML, CSS, ES modules)
├─ index.html
├─ css/               tokens, base, components, layout, motion
├─ assets/fonts/      Instrument Serif, Hanken Grotesk, IBM Plex Mono (OFL)
└─ js/
   ├─ core/           store, DOM helpers, formatting, motion, seeded random
   ├─ data/           sources: ia/, commons/, mock; shared http, licence, text and draw-loop modules
   ├─ services/       artwork, palette, tone synth, playback, library storage
   ├─ state/app.js    state shape and every action
   └─ ui/             one module per component
tests/
├─ unit/              pure logic (formatting, palette, store, data invariants)
└─ e2e/               behaviour and motion contract, driven over DevTools
tools/serve.mjs       dependency-free static server
tools/stamp.mjs       deploy-time cache busting: src/ -> dist/ with versioned URLs
tools/build-map.mjs   rebuilds the Internet Archive partition map (about monthly)
docs/                 design exploration, decisions, roadmap
.github/workflows/    CI and GitHub Pages deployment
```

Presentation components receive `{ store, clock, actions }` and never import mock data. Only `src/js/main.js` constructs the mock source, so replacing it with real adapters does not touch the UI.

## Documentation

Browse it as a site: https://codetopolymath.github.io/unmarked/docs/ (MkDocs Material, built from `docs/` by the Pages workflow). To preview locally: `python3 -m venv .venv-docs && .venv-docs/bin/pip install -r requirements-docs.txt && .venv-docs/bin/mkdocs serve`.

- [Design exploration](docs/design/design-exploration.md): three visual directions, the chosen "Accession" direction, design system, interaction and animation specs
- [Decisions](docs/decisions.md): naming, sources, licensing position, defaults
- [Roadmap](docs/roadmap.md): what the prototype does not do yet

## Rights and licensing

- Code: [MIT](LICENSE).
- Fonts: SIL Open Font License 1.1 (see `src/assets/fonts/LICENSES.md`).
- Unmarked stores no recordings. Audio is streamed from the Internet Archive's, Wikimedia Commons' and Audius's own servers (mock mode uses synthesized tones). Each record shows its stated licence, or says "Licence not stated" (most Audius tracks read "All rights reserved"); streaming here is never a licence to reuse a recording, and nothing is downloaded or re-hosted.
