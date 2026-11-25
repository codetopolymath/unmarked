---
id: RES-004
title: 'UX audit: usability gaps and improvement roadmap'
type: research
status: completed
created: 2026-11-25
updated: 2026-11-25
project: unmarked
tags: [ux, accessibility, library, mobile, audit]
related: [RES-003, ADR-001, ADR-012, ADR-014, ADR-015]
---

# RES-004: UX audit

> Code and docs review only. The app was **not run** in a browser or on a phone for this audit (NOT RUN). Nothing in the app was changed.

## TL;DR

- **Question:** What are the real usability gaps in the current app, and in what order should they be fixed?
- **Answer:** The discovery loop (Discover, play, Keep, Details) is strong and should be left alone. The gaps are around it: protecting and managing Kept, phone navigation, undo, Library scale, a few accessibility semantics, and a Sources page that mixes listener and developer content.
- **Recommendation (not fact):** Verify background audio on iOS first, then protect Kept and add undo, then fix the Library and phone navigation. No redesign: refine the existing tokens and components.
- **Confidence:** Medium-High for code-derived findings, Low for anything about real use (no analytics, no device session).

## Product reading

- **Category (Inferred):** a consumer listening product with an editorial voice, plus a trust layer (accession, source, rights, "not a licence"). Not an admin or dashboard product, so dense power-user patterns do not apply.
- **Users:** personal project; other stakeholders Unknown ([PROJECT_OVERVIEW](../PROJECT_OVERVIEW.md)).
- **Constraint:** no genre, filter, recommendation or learning ([ADR-012](../decisions.md#product-defaults)). Any list-narrowing idea below is marked as needing an owner decision.

## Method

- Read: `src/index.html`, `src/js/main.js`, `src/js/state/app.js`, every `src/js/ui/*.js` module, `src/css/tokens.css` and `layout.css`, the roadmap, ADR-015, RES-003, and the reference screenshots `l01-laptop.png` and `m01-phone.png` (mock-data era).
- Greps: `playbackState`, `loading="lazy"`, `focus-visible`, `pointer: coarse`, `forced-colors`, tab key handling.

## Findings

| #   | Finding                                                                                                                                           | Label      | Evidence                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| 1   | Kept, History and prefs live only in `localStorage`; Export and Import exist but nothing prompts a backup                                         | Verified   | `library-view.js`, RES-003                                 |
| 2   | Kept tiles only open the record; no remove action in the Library                                                                                  | Verified   | `library-view.js` `renderKept`                             |
| 3   | Unkeep, Clear history ("press again", 4 s) and Import have no undo                                                                                | Verified   | `app.js` `toggleKeep`, `clearHistory`; `library-view.js`   |
| 4   | Clearing History also clears the repeat-exclusion list                                                                                            | Verified   | `main.js` `excluded`, `app.js` `clearHistory`              |
| 5   | History renders every row (cap 5,000) with an image each; no `loading="lazy"`                                                                     | Verified   | `library-view.js` `renderHistory`, grep                    |
| 6   | Library tabs use `role=tab` with no arrow-key handling or `aria-controls`; the global key handler skips tabs on the assumption they handle arrows | Verified   | `library-view.js`, `keyboard.js` `OWN_ARROWS`              |
| 7   | Keep and Mute change their label and also set `aria-pressed` (double announcement)                                                                | Verified   | `stage.js`, `dock.js`                                      |
| 8   | The topbar `<nav>` is named "Library" but holds Sources, Docs and Preferences                                                                     | Verified   | `topbar.js`                                                |
| 9   | On phones the Kept count and History link disappear; Library is an unlabeled icon                                                                 | Verified   | `topbar.js`, `layout.css` (`.navlink` hidden below 640 px) |
| 10  | `ArrowRight` on the last track starts a new draw                                                                                                  | Verified   | `app.js` `nextTrack`, `keyboard.js`                        |
| 11  | The dock has no Keep action                                                                                                                       | Verified   | `dock.js`                                                  |
| 12  | Media Session sets metadata and handlers but never `playbackState` or position state                                                              | Verified   | grep, `app.js`                                             |
| 13  | Lock-screen and background audio on iPhone is unverified                                                                                          | Unknown    | CURRENT_STATUS                                             |
| 14  | Preferences is `role=dialog` with a focus trap but not modal or inert, unlike the Details and Docs sheets                                         | Verified   | `preferences.js` vs `details.js`                           |
| 15  | The shortcut list shows on touch devices; no `pointer: coarse`, `forced-colors` or `prefers-contrast` rules                                       | Verified   | `preferences.js`, grep                                     |
| 16  | The Audius switch gives no reason to turn it off                                                                                                  | Verified   | `preferences.js`, ADR-015 (mostly all rights reserved)     |
| 17  | Sources page carries "what is still to build" and "Todo" lines; the ccMixter note is outdated                                                     | Verified   | `sources-view.js`, roadmap                                 |
| 18  | The waveform is decorative (seeded per record), which can read as real audio data                                                                 | Verified   | `scrubber.js` comment; roadmap decision pending            |
| 19  | The Docs iframe has no load-failure state                                                                                                         | Verified   | `docs-sheet.js`                                            |
| 20  | A failed draw says "The archive is not answering" regardless of which source failed                                                               | Verified   | `stage.js`                                                 |
| 21  | Toast offsets are hardcoded (108 px, 176 px) to the dock height                                                                                   | Verified   | `layout.css`                                               |
| 22  | Safari may evict `localStorage` for sites not used for about a week, which would put Kept at risk outside an installed home-screen app            | Inferred   | General Safari storage policy; not tested here             |
| 23  | Touch target sizes below 44 px (for example the 32 px rights chip) need a real check                                                              | Assumption | `components.css`                                           |
| 24  | Real usage, the "only instrumental audio" report, and the draw ticket on a phone                                                                  | Unknown    | CURRENT_STATUS (open)                                      |

## Recommendation (not fact)

**Phase 1, quick wins**

- `loading="lazy"` and `decoding="async"` on Library images.
- Rename the topbar nav; fix tab semantics and the `aria-pressed` label pattern.
- Audius helper text; hide shortcuts on touch.
- Docs iframe fallback; Kept count on the phone Library icon.
- `playbackState` and `setPositionState`; reword the ccMixter Sources entry.

**Phase 2, meaningful**

- Actionable undo toast, then Unkeep, Clear history and Import use it.
- Remove from a Kept tile; chunked History rendering.
- Backup nudge on Kept with a last-export date; request persistent storage.
- Keep in the dock; phone navigation labels; Preferences made modal and inert.
- Failure messages that name the source.
- Split Sources into a listener view and developer status.

**Phase 3, strategic (owner decisions)**

- Share link to a discovery.
- Text find inside Kept and History (needs a ruling on ADR-012).
- Optional sync ([RES-003](RES-003-optional-accounts-and-free-tier-backend.md)), only after local-first protection.
- Service worker, light theme, waveform decision.

**Order and risks**

1. Verify iOS background audio and a VoiceOver pass first.
2. Build undo before anything uses it.
3. Library changes share one file; do them together.
4. Undo for Clear history must keep the exclusion list consistent.
5. Moving Docs or Sources on phones changes muscle memory.
6. Lazy images change artwork-resolution timing; e2e covers it.

## Conclusion

The product's core interaction needs no redesign. Risk sits in data safety (Kept), reversibility, and phone navigation. A refinement of the existing design system is enough.

## Impact on Project

- Architecture: none. Undo needs one new shared toast variant.
- Code: UI modules only (`library-view.js`, `topbar.js`, `preferences.js`, `dock.js`, `toasts.js`, `app.js` actions).
- Operations / cost: none.

## Follow-ups

- [ ] Owner answers: audience, main listening context, strictness of the no-filter rule, the instrumental-audio report.
- [ ] Device check of background audio (finding 13). Touch targets (finding 23) were measured on an emulated phone and fixed; a real-phone look is still open.
- [x] Phase 1 and 2 built 2026-11-25 (see the roadmap section "UX audit follow-through"); findings 1 to 12 and 14 to 21 are addressed.
- [ ] ADR if a Kept text find or share link is chosen.
