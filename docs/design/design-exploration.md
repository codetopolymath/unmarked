# Unmarked: design exploration

Working title: **Unmarked**. A personal music-discovery app with no genres, regions, decades, moods, popularity or recommendations. One record at a time, drawn at random.

Status: living design spec. The app began as a mock-data prototype and now draws from live Internet Archive and Wikimedia Commons sources with real streaming, plus a deploy-time build step for cache busting. Mock mode (`?source=mock`) remains for design work and tests. Shipped behaviour and its reasons are in [decisions](../decisions.md) and the [roadmap](../roadmap.md); where they differ from this document, they win.

## 0. Context and constraints

- The project directory was empty at the start of this phase, so there was no existing stack to preserve. The architecture follows the earlier research recommendation: plain HTML, CSS and ES modules, no build step for development, no runtime dependencies (see section 8).
- Reference study was limited to what could be read as text. Are.na's homepage states "no ads, no algorithmic recommendations" and is set in a single typeface (matches our stance). Motion's homepage recommends springs and shared-element ("layout") transitions and cheap properties such as `scaleX` over `width`. Awwwards and Framer returned markup only (no styling). Dribbble returned an empty page. No visuals of any reference were seen, so the references informed principles, not pixels.
- The Deep Cut's interface was read in full from source (earlier phase). It informed what to keep (progressive cover loading, cover-derived tint, persistent player, honest "Artist not listed") and what to drop (five-album rail, era filters, an invented "Archive album" genre label, hover-only metadata, no licence display).

## 1. Three visual directions

### A. Editorial minimalism ("the liner note")

- **Premise:** the record as a printed sleeve with a liner note. Warm near-black page, serif titles, hairline rules, artwork as a framed plate with a caption below.
- **Type:** high-contrast display serif for titles, quiet grotesk for body, small mono for catalogue labels.
- **Layout:** generous margins, two columns, a lot of empty space.
- **Motion:** quiet cross-dissolves.
- **Strengths:** legible, timeless, calm; artwork stays the centre; cheap to render.
- **Risks:** reads as a generic editorial template; little sense of mystery; empty space can feel unfinished when metadata is sparse.

### B. Experimental immersive ("the darkroom")

- **Premise:** discovering a record is developing a print. The cover bleeds into a colour field behind the page; the reveal is slow and cinematic.
- **Type:** large, light-weight sans over the artwork.
- **Layout:** full-bleed artwork, floating text, a morphing player.
- **Motion:** blur-in, push-in, parallax, ambient drift.
- **Strengths:** most immersive; artwork drives all the variety.
- **Risks:** contrast depends on the artwork, so text can fail on bright covers; drifts into glassmorphism; always-on blur and ambient motion cost battery; every screen ends up looking the same.

### C. Brutalist archive ("the index card")

- **Premise:** an accession register. Hard borders, catalogue numbers, stamp-like labels, no rounded corners.
- **Type:** monospace throughout.
- **Layout:** visible grid and rules; data presented as fields.
- **Motion:** hard cuts.
- **Strengths:** strongest identity; makes sparse metadata look deliberate rather than broken; honest.
- **Risks:** cold and dense; low warmth; all-mono text is slow to read in long passages.

### Scorecard (1 = weak, 5 = strong)

| Criterion                                               | A   | B   | C   |
| ------------------------------------------------------- | --- | --- | --- |
| Artwork is the visual centre                            | 4   | 5   | 3   |
| "Unknown record in a mysterious archive"                | 2   | 4   | 4   |
| Legibility and contrast safety                          | 5   | 2   | 4   |
| Handles missing metadata gracefully                     | 3   | 3   | 5   |
| Battery and performance                                 | 5   | 2   | 5   |
| Distinctiveness                                         | 2   | 3   | 4   |
| Avoids named anti-patterns (Spotify clone, glass, neon) | 4   | 2   | 5   |
| Warmth and polish                                       | 4   | 4   | 2   |

## 2. Recommendation: "Accession"

A hybrid, with a clear division of labour:

- **From A:** the layout and the typography. Serif titles at large sizes, generous space, hairline rules, the artwork as a plate.
- **From C:** the data language. Mono catalogue labels, an accession number per discovery, a bordered rights mark, 2 px corners, an honest "Artist not listed", a dashed "Licence not stated". Sparse records look intentional because the system speaks in catalogue fields.
- **From B:** the colour behaviour, restrained. The cover "develops" on arrival and the page wash shifts toward the cover colour, but at most 16% strength and always contrast-guarded, so legibility never depends on the artwork.

Rejected on purpose: blurred glass panels, neon, large gradients, parallax, ambient looping motion, rounded pill buttons, a persistent sidebar, any navigation beyond Kept, History and Preferences.

Why this fits the brief: every discovery becomes an _accession_ (a numbered item in a private archive). The product has no categories, so the only structure on screen is the record itself and where it came from.

## 3. Design system

All values live in `src/css/tokens.css`. No other stylesheet defines raw colours, sizes or durations.

### Colour (dark; no pure black)

| Token       | Value     | Use                  | Contrast on `paper-0` / `paper-3` |
| ----------- | --------- | -------------------- | --------------------------------- |
| `--paper-0` | `#121110` | page                 | n/a                               |
| `--paper-1` | `#191817` | dock, sheet          | n/a                               |
| `--paper-2` | `#211f1e` | cards, panels        | n/a                               |
| `--paper-3` | `#2a2826` | raised, hover        | n/a                               |
| `--ink-1`   | `#f2ece1` | primary text         | 16.04 / 12.49                     |
| `--ink-2`   | `#bdb5a8` | secondary text       | 9.29 / 7.23                       |
| `--ink-3`   | `#a39b8e` | tertiary, labels     | 6.86 / 5.34                       |
| `--signal`  | `#ec7550` | marks and state only | 6.49 / 5.05                       |
| `--danger`  | `#ec8d7b` | errors               | 7.78 / 6.06                       |

Artwork supplies all other colour. `--wash`, `--tint` and `--tint-2` are set at runtime from the cover.

**Contrast-guarded wash.** A fixed percentage would fail on bright covers (a 22% wash from white drops tertiary text to 2.88:1). The wash starts at 16% and shrinks until `ink-3` keeps at least 4.6:1 on the result (`deriveTheme` in `js/services/palette.js`). Measured outcomes: bright yellow 16% (4.82:1), white 14% (4.65:1). The tint's lightness is also clamped to 0.22 to 0.60.

### Typography

Three self-hosted OFL families (about 85 KB total; Latin subset).

| Role                           | Family                                   | Size                                                                                                                                        |
| ------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Record title                   | Instrument Serif                         | `clamp(2.25rem, 1.4rem + 3.6vw, 5rem)`; medium titles `clamp(2rem, ...3.75rem)`; long titles `clamp(1.625rem, ...2.5rem)`; chosen by length |
| Artist                         | Instrument Serif italic                  | `clamp(1.375rem, 1rem + 1vw, 2rem)`                                                                                                         |
| Interface and body             | Hanken Grotesk                           | 14 to 18 px                                                                                                                                 |
| Catalogue labels, facts, times | IBM Plex Mono, uppercase, tracked 0.08em | 12 px                                                                                                                                       |

Rules: titles use `text-wrap: balance` and `overflow-wrap: anywhere`; times use tabular numerals; a made-up fallback title is set in the secondary ink so it never looks authoritative.

### Space, grid, shape

- 4 pt scale: 4, 8, 12, 16, 24, 32, 48, 72, 112.
- Breakpoints: mobile below 640, tablet 640 to 1023, laptop 1024 to 1439, desktop 1440 and up. Content max width 1440. Side margin `clamp(16px, 4vw, 72px)`. Stage: 7/5 columns on laptop and up.
- Radii: 2 px (buttons, plates), 4 px (panels), full round only for the play button.
- Shadows: one, for the artwork plate. Everything else uses hairlines (`rgb(242 236 225 / 0.10)` and `0.22`).

### Iconography

A custom 24 px sprite, 1.5 px stroke, round joins: play, pause, previous, next, keep, kept, info, external, arrow, back, close, chevrons, volume, mute, library, preferences. Icons never carry meaning alone (all have text or labels).

### Components

- **Buttons:** primary (bone fill, dark text), outline, text. 48 to 52 px high. Press scales to 0.975.
- **Discover another:** a large italic serif text-button with an underline that draws in on hover and a keyboard hint, deliberately not a pill.
- **Rights chip:** bordered mono label; dashed when the licence is unknown.
- **Artwork plate:** a square on a hairline mount offset 14 px, caption below (plate number, generated-art note).
- **Player:** 52 px circular play button, bar-style scrubber, volume range, dock and expanded sheet.

### Artwork presentation

- Real cover: shown as supplied, square, no crop distortion (`object-fit: cover`).
- No cover: a generated typographic card (the title's first letter on a palette from the record id), labelled "Generated artwork". It never imitates a photograph.
- Missing-image placeholder services must never be shown as artwork.

## 4. Page and component hierarchy

```
App (#app)
├─ Topbar            wordmark, prototype badge, Kept / History (or one library icon on phones), Preferences
├─ Main (#main)
│  ├─ Stage          the current record
│  │  ├─ Plate       artwork, caption
│  │  └─ Record column
│  │     ├─ Eyebrow  accession number / draw status
│  │     ├─ Title, Artist, Facts
│  │     ├─ Actions  Play, Keep, Details
│  │     ├─ Discover another, Previous discovery
│  │     ├─ Source line, Rights chip
│  │     └─ Tracklist (albums) or Scrubber (recordings)
│  └─ Library        tabs: Kept (artwork grid), History (dated list)
├─ Actionbar         phones: Play, Discover another
├─ Dock              persistent mini player
├─ NowPlaying        expanded player (dialog)
├─ Details sheet     about, record, source, rights (dialog)
├─ Preferences       autoplay, continue, motion, Documentation button, shortcuts (dialog)
├─ Docs sheet        the MkDocs site in an iframe (dialog); opens from the topbar "Docs" link or Preferences
├─ Proto panel       evaluation controls (not product UI)
└─ Toasts            visible plus a polite live region
```

Source layout: `js/core` (store, DOM helpers, formatting, motion), `js/data` (mock records and mock source), `js/services` (artwork, palette, synth, playback, library), `js/state/app.js` (state and actions), `js/ui/*` (one file per component).

## 5. Layouts

### Desktop and laptop (1024 and up)

```
┌────────────────────────────────────────────────────────────────────┐
│ ● Unmarked  [Prototype · mock data]               KEPT 7  HISTORY ⚙ │
├────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────┐   ● ACCESSION 000021 · DRAWN AT RANDOM  │
│  │                        │   Salt Meridian                         │
│  │        ARTWORK         │   The Placeholder Quartet               │
│  │         PLATE          │   1974 / PORT VELLUM / 9 TRACKS         │
│  │                        │   [▶ Play album] [🔖 Keep]  (i) Details │
│  └────────────────────────┘   Discover another →  [D]               │
│   PLATE 000021                Found on Mock Archive A ↗ [CC BY 4.0] │
│                               TRACKLIST                9 TRACKS     │
│                               01 Opening Tide              3:15     │
├────────────────────────────────────────────────────────────────────┤
│ [art] Opening Tide   ⏮ ⏯ ⏭   1:20 ▂▃▅▇▆▃▂▁ 3:15      🔊───●   ⌃ │
└────────────────────────────────────────────────────────────────────┘
```

On laptops shorter than 780 px the stage top-aligns and the plate becomes sticky so it stays visible while the tracklist scrolls.

### Tablet

A single centred column (max 760): plate, then the record column; landscape tablets keep two columns. The dock keeps the scrubber and drops the volume slider.

### Phone

```
┌──────────────────────┐
│ ● Unmarked      ▦  ⚙ │
│ ┌──────────────────┐ │
│ │     ARTWORK      │ │   plate capped at 40% of viewport height
│ └──────────────────┘ │
│ ● ACCESSION 000021   │
│ Salt Meridian        │
│ The Placeholder Q…   │
│ 1974 / PORT V… / 9   │   one line; only the origin truncates
│ [🔖 Keep] (i) Details│
├──────────────────────┤
│ [▶] Discover another→│   thumb reach (play hidden when the dock has it)
│ [art] Track  ⏯  ⏭  ⌃ │   dock, with a 2 px progress line on top
└──────────────────────┘
```

Tap the dock to open the full-screen player. Details opens as a bottom sheet.

## 6. Interaction specifications

**Discovery flow.** `idle` → press Discover (or D) → `drawing` (previous record stays, plate dims, scan line runs, eyebrow reads "Retrieving accession N · ...") → `ready` (new cover develops in, text rises in sequence, page wash tweens) → new record starts playing if auto-play is on. A failed draw shows an inline notice with "Try again" and keeps the previous record. A record that cannot play is skipped by the source with a toast.

**Controls.** Discover another is the dominant control. Previous discovery steps back through the last 20 of the session. Keep toggles a persistent favourite. Nothing asks for feedback and nothing learns.

**Play button semantics.** The stage button acts on the record on screen: Play album, Pause, Resume, Loading. The dock acts on whatever is playing. If auto-play is off, the old record keeps playing in the dock while a new one is viewed.

**Keyboard.** Space play/pause; D discover; B previous discovery; Left/Right previous/next track; K keep; I details; L library; E expand player; M mute; P prototype panel; ? preferences; Esc closes the topmost overlay. Native buttons keep Space and Enter; sliders keep their arrows.

**Documentation.** A "Docs" link in the topbar (640 px and up) and a "Documentation" button in Preferences (the phone path, where the topbar has no room) open a sheet holding the docs site in an iframe. It is a sheet, not a link, because leaving the page stops the music, and in an iOS home-screen app there is no tab to return to. The frame is created on first open and kept, so reopening shows the page you left. The header offers "New tab" as an escape hatch. Esc closes the sheet unless focus is inside the frame (then use the close button). No keyboard shortcut: single keys are reserved for in-app actions. The URL is the `docs/` folder beside the app over https, else the published site (`src/js/core/links.js`).

**Home-screen app.** `manifest.webmanifest` plus the `apple-*` tags make the site installable. The status bar style is `black`, so the page starts below it and no view has to handle the inset. The icon is an unlabelled record (paper ground, one groove, a blank ember label), drawn from the tokens in `src/assets/icons/icon.svg`; the 180 px iOS icon is opaque because iOS paints transparency black.

**Scrubber.** `role="slider"`, `aria-valuetext` like "1:20 of 3:15". Arrows seek 5 s, Page keys 30 s, Home/End. Pointer drag with capture.

**Dialogs (details, now playing, preferences).** Focus moves in, Tab is trapped, the background is `inert`, Esc closes, focus returns to the trigger.

**Missing metadata.** Never an empty label or a "N/A". Optional fields vanish with their separators. Artist reads "Artist not listed". Licence reads "Licence not stated" (dashed). Missing track titles read "Track N". Missing title falls back to the first track title, then "Untitled recording".

**Kept and History.** Kept is an artwork grid with no expiry, export and import as JSON. History is a dated diary, newest first, labelled Kept, Played or Seen. Neither can be sorted or filtered. History exists only to avoid repeats.

**Errors.** Source unreachable (inline notice), track will not play (dock shows the message, auto-skips after 2.2 s with a toast), autoplay blocked (toast asking to press play), import of a foreign file (rejected with a message).

## 7. Animation specifications

Only `opacity`, `transform`, `filter` and `clip-path` animate. Durations are tokens (`--dur-*`) read by both CSS and JavaScript.

| Name                       | Trigger                          | What changes                                                                                                                       | Timing                                                             | Reduced motion   |
| -------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------- |
| Develop                    | new cover shown                  | opacity 0 to 1, grayscale 1 to 0, brightness 0.55 to 1, contrast 1.25 to 1, blur 10 px to 0, scale 1.035 to 1; old cover fades out | 900 ms, `cubic-bezier(.2,.7,.2,1)`; old 520 ms                     | instant swap     |
| Wash tween                 | new cover                        | registered colour properties `--wash`, `--tint`, `--tint-2`                                                                        | 1000 ms ease-in-out                                                | instant          |
| Metadata rise              | new record                       | opacity and 10 px translate, up to 8 items                                                                                         | 520 ms, 55 ms stagger                                              | 1 ms, no stagger |
| Scan line                  | draw in flight only              | translateX loop on the plate                                                                                                       | 1.4 s linear, loops                                                | none             |
| Equaliser                  | current track while playing only | scaleY loop                                                                                                                        | 900 ms alternate                                                   | none             |
| Discover underline         | hover or focus                   | scaleX 0.16 to 1; arrow nudges 6 px                                                                                                | 520 ms                                                             | 1 ms             |
| Button press               | pointer down                     | scale 0.975 (0.94 for round buttons)                                                                                               | 120 ms                                                             | 1 ms             |
| Dock entrance              | first playback                   | translateY 100% to 0                                                                                                               | 520 ms                                                             | none             |
| Player expand and collapse | dock or Esc                      | shared-element morph of the cover (`view-transition-name: np-art`) plus a root cross-fade                                          | 520 ms and 260 ms; falls back to an instant swap where unsupported | none             |
| Details sheet              | open or close                    | slide in (right on desktop, up on phones) plus scrim fade                                                                          | 520 ms and 240 ms                                                  | 1 ms             |
| View change                | Kept, History, stage             | fade and 6 px rise                                                                                                                 | 240 ms                                                             | 1 ms             |
| Toast                      | notify                           | rise in, fade out                                                                                                                  | 240 ms                                                             | 1 ms             |
| Progress                   | `timeupdate` (about 4 Hz)        | `clip-path` or `scaleX` update, no animation loop                                                                                  | n/a                                                                | n/a              |

Preference model: Motion is System (follow the OS), Reduced or Full. The two overrides set `data-motion` on `<html>`.

## 8. Technical approach

- **Stack:** static HTML, CSS and native ES modules. No framework, bundler or runtime dependency. Serve with any static server (modules do not load from `file://`). Deploy only: `tools/stamp.mjs` copies `src/` to `dist/` with content-hashed URLs (see [decisions](../decisions.md#hosting-public-repository-github-pages)).
- **Boundaries:** presentation components receive `{ store, clock, actions }` and never import data sources. Sources live in `js/data/` (`ia/`, `commons/`, mock); only `main.js` constructs them. Swapping the mock source for the live ones changed `main.js` and the services, not the UI.
- **State:** a ~25-line observable store. The playback clock is a separate store so progress updates (about 4 Hz) never re-render the page.
- **Placeholder audio (mock mode only; live mode streams real files):** each track is a deterministic, synthesized drone (not music, not a recording), encoded as WAV in the browser and played through a normal `<audio>` element. That keeps seeking, volume, Media Session and the `ended` event real.
- **Artwork:** generated on a canvas from a seed (seven compositions, eight palettes, static grain); the palette is extracted from the rendered pixels with the same code a real cover would use.

## 9. Mock catalogue

Fourteen fictional records; each exists to test something.

| Id       | Kind             | Tests                                                                 |
| -------- | ---------------- | --------------------------------------------------------------------- |
| mock:001 | album, 9 tracks  | full metadata, CC BY, description                                     |
| mock:002 | recording        | single recording, public domain, label-scan artwork                   |
| mock:003 | album            | almost no metadata: no artist, year, durations, track titles, licence |
| mock:004 | album            | very long title, artist, origin, label, track names                   |
| mock:005 | recording        | no cover (generated artwork)                                          |
| mock:006 | album, 24 tracks | "show all tracks"                                                     |
| mock:007 | recording        | all rights reserved                                                   |
| mock:008 | album            | non-Latin text (system font fallback), bright artwork                 |
| mock:009 | album            | one track that fails to play (auto-skip), restricted                  |
| mock:010 | album            | unavailable: must never be shown                                      |
| mock:011 | recording        | long live recording, origin, CC BY-SA                                 |
| mock:012 | album            | fully saturated artwork (wash guard)                                  |
| mock:013 | album            | near-white artwork (wash guard)                                       |
| mock:014 | recording        | nothing but one untitled track                                        |

## 10. Verification

Run on desktop Chrome (headless) through the DevTools protocol, in real time:

- **Behaviour (50 checks):** discovery and history, theme change, keep and persistence, playback and keyboard, scrubber semantics, track-error skip, the unavailable record never appearing in 40 draws, details/player focus and inert handling, library reopen, export and import (including rejecting a foreign file), failure and retry, reduced motion, accessible names, alt text, 24 px minimum target size.
- **Motion (14 checks):** reveal runs for 900 ms, wash tweens, scan line only during a draw, equaliser only while playing, nothing loops at rest or when paused, reduced motion removes everything, the OS setting is honoured.
- **Layout:** 26 captures across five viewports (1440, 1280, 1180, 820, 390 wide) with no horizontal overflow.

Not verified: Safari, Firefox, real phones, touch gestures, a screen reader, real audio hardware, slow devices. See below.

## 11. Unresolved design decisions

1. **Name and wordmark.** _Name decided_ ([ADR-001](../decisions.md#name-unmarked)); the wordmark is still open.
2. **Auto-play defaults.** _Decided (refinement pass):_ new discoveries auto-play (the Discover click is the gesture browsers require); continuing after the last track is **off**, so an album ends, a toast says so, and D draws the next. Revisit if it feels too quiet.
3. **Old playback during a new discovery.** _Decided:_ with auto-play off the previous record keeps playing in the dock while the new one is viewed; with it on, the new record replaces it.
4. **Waveform.** Real waveforms need decoded audio, which streaming sources do not give cheaply. The bars are decorative today. Decide between keeping them (honestly decorative), a plain line, or optional analysis for sources that allow it.
5. **Generated artwork.** The typographic card is functional. A better generative language for missing covers (and a rule for covers that are scans of labels) needs a design pass.
6. **Non-Latin titles.** _Decided:_ the display font stack now ends in serif fallbacks for CJK, Cyrillic, Greek and Arabic (Hiragino Mincho, Yu Mincho, Noto Serif, Songti, Geeza Pro and others), verified on the Japanese mock record. Still open: bundling a web font for platforms that lack these system faces.
7. **Source tags.** Shown only in Details, as plain text. Any tag UI risks recreating genres by the back door.
8. **History wording.** _Decided:_ "Seen" replaces "Skipped"; passing on a record is not a verdict and nothing learns from it.
9. **Accession numbers.** Session counter or permanent? _Partly decided ([ADR-014](../decisions/ADR-014-facts-placement-and-draw-ticket.md)):_ Archive draws now show their real ticket and the size of the random universe ("Ticket 385,611 of 932,104") in the eyebrow, with a rolling counter while loading. Still open: session counter or permanent accession numbers.
10. **Rights prominence.** How loudly should "All rights reserved" read, and does that source belong in the product at all (legal question, not a design one).
11. **Phone chrome.** Action bar plus dock is 132 px of fixed UI. A merged bar might give the content more room.
12. **Library on phones.** A single icon hides the Kept and History split; check discoverability.
13. **Short laptops.** _Decided:_ keep the sticky plate (tested at 1280×720); a collapsed tracklist would add a tap for little gain. Revisit with real use.
14. **Light theme.** Tokens are structured for it, but only dark has been designed.
15. **Track-level favourites.** Not built. The data model allows them.
16. **Persistence.** The prototype uses `localStorage`. Safari can clear it after seven days without use, so export reminders and a home-screen install prompt need design.
17. **Real artwork loading.** _Partly done:_ real covers load and fall back to generated art; Archive thumbnails have no CORS header, so they are shown as plain images with a wash from the generated twin. Still open: the small-tile-then-full-cover sequence for slow connections (roadmap).
18. **Screen reader and assistive-technology testing** has not been done, and the live-region wording is unproven.
19. **Performance on weak phones.** The 720 px cover animates a blur filter for 900 ms; measure on a low-end device and consider dropping blur there.
20. **Audio-dependent decisions** (gapless playback, preloading the next track, loudness) were untested against the mock drones. Live streaming now exists; whether they were revisited is Unknown.
