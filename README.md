# Unmarked

A personal music-discovery app. One record at a time, drawn at random from open archives: no genres, regions, decades, moods, popularity rankings or recommendations, and nothing learns from what you play.

**Status: frontend prototype.** Everything shown is fictional mock data with synthesized placeholder audio. There is no Internet Archive integration yet; see the [roadmap](docs/roadmap.md).

**Live prototype:** https://codetopolymath.github.io/unmarked/

## Why this exists

Most "random" music apps shuffle a catalogue you already know how to reach. Unmarked treats each discovery as an _accession_: a numbered item drawn from archives of recordings (78 rpm sides, netlabel releases, digitized LPs) with its source and licence stated plainly, or stated as unknown when it is.

## Run it locally

Requires Node 22 or newer. The app itself has no runtime dependencies and no build step.

```sh
npm install   # dev tooling only: linter, formatter
npm start     # serves src/ at http://127.0.0.1:4173/
```

Click **Discover another** or press **D**. Press **?** for shortcuts and **P** for the prototype controls (jump to edge-case records, simulate failures).

## Scripts

| Command            | What it does                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `npm start`        | Static dev server for `src/`                                                                    |
| `npm run check`    | Lint, format check and unit tests (what CI runs)                                                |
| `npm test`         | Unit tests (Node's built-in runner)                                                             |
| `npm run test:e2e` | End-to-end suites in a real Chrome (needs Chrome; set `CHROME_PATH` if not on the default path) |
| `npm run lint`     | ESLint                                                                                          |
| `npm run format`   | Prettier, write                                                                                 |

## Layout

```
src/                  the deployed site (plain HTML, CSS, ES modules)
├─ index.html
├─ css/               tokens, base, components, layout, motion
├─ assets/fonts/      Instrument Serif, Hanken Grotesk, IBM Plex Mono (OFL)
└─ js/
   ├─ core/           store, DOM helpers, formatting, motion, seeded random
   ├─ data/           mock records, mock source, sources catalogue
   ├─ services/       artwork, palette, tone synth, playback, library storage
   ├─ state/app.js    state shape and every action
   └─ ui/             one module per component
tests/
├─ unit/              pure logic (formatting, palette, store, data invariants)
└─ e2e/               behaviour and motion contract, driven over DevTools
tools/serve.mjs       dependency-free static server
docs/                 design exploration, decisions, roadmap
.github/workflows/    CI and GitHub Pages deployment
```

Presentation components receive `{ store, clock, actions }` and never import mock data. Only `src/js/main.js` constructs the mock source, so replacing it with real adapters does not touch the UI.

## Documentation

- [Design exploration](docs/design/design-exploration.md): three visual directions, the chosen "Accession" direction, design system, interaction and animation specs
- [Decisions](docs/decisions.md): naming, sources, licensing position, defaults
- [Roadmap](docs/roadmap.md): what the prototype does not do yet

## Rights and licensing

- Code: [MIT](LICENSE).
- Fonts: SIL Open Font License 1.1 (see `src/assets/fonts/LICENSES.md`).
- The prototype contains no real recordings. When real sources are added, each record shows its stated licence, or says "Licence not stated"; streaming here is never a licence to reuse a recording, and nothing is downloaded or re-hosted.
