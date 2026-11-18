# Roadmap: what the prototype does not do yet

The prototype proves the interface and the interaction model on mock data. Everything below is still to build. Items marked **(decision)** need an owner decision first.

## Discovery engine (the core of the product)

Built and verified live (`npm run test:live`); opt in with `?source=ia`. Mock stays the default.

- [x] Partition-map builder (`npm run build:map`, `tools/build-map.mjs`): 262 windows of at most 5,000 items covering the full 932,104-item frame, plus a bucket for items with no `publicdate`. Takes about 20 minutes (593 count queries at roughly 5 s each).
- [x] Sampler: one random rank per draw, located through the map, one search call.
- [x] Eligibility frame derived from the Sources page (`src/js/data/ia/frame.js`).
- [x] Album versus recording: two or more distinct songs list as an album so every track stays reachable. The research rule was four; revisit if the UI gains a way to reach extra tracks on a "recording".
- [x] Validation before a record is shown: metadata fetch, playable-file choice (MP3, then Ogg, then M4A), 2-byte range probe of the first track.
- [x] Verified buffer of two records, refilled in the background; a draw never waits on the archive when one is ready.
- [x] Persistent exclusion: History ids, the current record and this session's draws are never repeated.
- [x] Failure handling: empty `{}` metadata, 429/5xx back-off with `Retry-After`, HTML busy pages (rejected by the probe), map drift (empty page retries another rank).
- [x] Spoken-word filter (`src/js/data/ia/spoken.js`): rejects lectures, sermons, speeches, interviews, TV-style episode numbering, the archive's own "Non-Music" and spoken-word tags, poetry readings in the mixed reading collection, and four collections of speech or field recordings (about 14k items). Runs on fields the search call already returns, so a rejected item costs no extra request. Measured on a uniform sample of the frame: about 1% of draws are skipped, no music was caught.
- [ ] Spoken-word misses: spoken podcasts outside the denylisted collections still get through, and the filter is deliberately precision-first. "Podcast" and the radio collections are not signals because on this frame they are overwhelmingly music (netlabel mixes, live broadcasts). Extend the denylist as new pockets are found.
- [ ] Duplicate handling across mirrors (Jamendo and Free Music Archive mirrors, title-and-artist fingerprint). Commons-to-Archive mirrors are already skipped.
- [ ] Map rebuild reminder: the map only knows items up to its build date; the staleness is silent.
- [ ] Hip-hop mixtapes download-count floor (the map currently includes the whole collection, matching the researched frame).

## Playback

- [x] Real streams from archive.org (CORS and range requests verified on the download hosts); the synthesized drone remains for mock mode.
- [x] Start-up watchdog: a streamed track that has not started within 15 s is reported as failed, so the existing skip and notice logic runs instead of waiting forever (seen once with a slow Wikimedia file).
- [ ] Mid-stream stall rescue from the item's own servers, as designed in the research.
- [ ] Seeking disabled for hosts that ignore range requests.
- [ ] Real-device verification of Media Session, lock-screen controls, and autoplay rules (iOS Safari especially).

## Artwork

- [x] Real covers: a `cover.jpg`-style file when the item has one, else the archive thumbnail; palette comes from the loaded image (CORS verified), and a missing or unreadable cover falls back to generated artwork.
- [x] Cover selection: the item's own image (78 rpm label scans are `<identifier>.jpg`), front-named files, or a photo-sized JPEG; spectrogram PNGs and the archive's tile derivatives are ignored. Item thumbnails carry no CORS header on any route (`/download`, `/services/img`, direct server), so they are shown as plain images with a wash taken from the generated twin. Non-square thumbnails (the archive auto-makes 180x45 spectrogram strips for field recordings) are rejected in favour of generated art. In a 14-draw browser sample, 11 showed real art and 3 had only a strip.
- [ ] Small-tile-then-full sequence for slow connections.
- [ ] Decide whether the decorative waveform stays **(decision)**.

## Rights and metadata

- [x] Licence fields (`licenseurl`, `rights`, `possible-copyright-status`, `access-restricted-item`) map into the rights model; absent fields read as "Licence not stated".
- [x] Jamendo mirror items: the Creative Commons licence is read from the `License.txt` table inside each item (one small free request, only for Jamendo items without a licence in metadata). One shared licence maps as usual; tracks that differ show the union of their restrictions. If the file cannot be read the record stays playable and reads "Licence not stated".
- [x] Real source links (item page); original-publication link only when the item's `source` is a URL.
- [ ] Defensive normalisation for real data shapes (scalar-or-array fields, `original` as a list, mixed duration formats).

## More sources (see the Sources page)

- [x] Wikimedia Commons: drawn alongside the Internet Archive at the same address (80% / 20% first-choice mix, the other source is the fallback). Music category, 300 KB floor, no MIDI, at least 30 s; one random search returns five candidates with licence, duration and MP3 transcodes; each is range-probed before it is shown. Recordings Commons re-hosts from the Archive are skipped when the Archive item is already in History.
- [ ] Commons mix is a guess: revisit the 80/20 weights after listening (`DEFAULT_WEIGHTS` in `src/js/data/live-source.js`) **(decision)**.
- [ ] Commons has no cover art, so every Commons record shows generated artwork.
- [ ] Jamendo, Europeana, Audius, ccMixter: each needs a key or a terms review first.

## Product

- [ ] Light theme **(decision)**.
- [ ] Track-level favourites **(decision)**.
- [ ] Share link to a discovery.
- [ ] Offline shell and installable app (service worker), once real data exists.
- [ ] Remove prototype scaffolding: the "Prototype · mock data" badge, the prototype panel, URL scenarios, and the load-error recorder in `index.html`.

## Quality

- [ ] Cross-browser runs (Safari, Firefox) and real phones.
- [ ] Screen-reader pass (VoiceOver, NVDA) on the discovery, details and library flows.
- [x] First-draw speed: cover loading overlaps the audio probe, covers of buffered records load in the background (later draws take about 10 ms), connections to the three hosts are opened during page load, and the deploy preloads every module and the map. The first draw is still network-bound: about 5 s for an Archive record and 2 s for Commons. See `docs/decisions.md` for what was measured and rejected.
- [ ] Performance check on a low-end phone: the cover reveal animates a blur for 900 ms.
- [ ] Run end-to-end tests in CI (currently local only: they need a Chrome install and have not been validated on the CI image).
