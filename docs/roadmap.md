# Roadmap: what the prototype does not do yet

The prototype proves the interface and the interaction model on mock data. Everything below is still to build. Items marked **(decision)** need an owner decision first.

## Discovery engine (the core of the product)

- [ ] Partition-map builder script: count queries against the Internet Archive, windows of about 5,000 items, inclusive ranges ending one second early, a bucket for items with no `publicdate`.
- [ ] Sampler: one random rank per draw, located through the map, fetched with a single search call (one draw per window).
- [ ] Eligibility frame: the in-scope collection list from the Sources page, plus a metadata classifier for spoken word, radio and podcast material that leaks through.
- [ ] Album versus recording rule (four or more distinct songs is an album).
- [ ] Validation pipeline before a record is shown: metadata fetch, playable-file choice, a 2-byte range probe.
- [ ] Verified buffer of two or three ready records, filled in the background.
- [ ] Persistent exclusion: the History already exists; the sampler must use it (the mock only avoids repeats within a session).
- [ ] Duplicate handling: source ids, mirror links (Jamendo and Free Music Archive mirrors on the Archive), a title-and-artist fingerprint.
- [ ] Failure taxonomy: empty `{}` metadata, 503 and 404 downloads, HTML "busy" pages, 429 with back-off.

## Playback

- [ ] Real streams from archive.org replacing the synthesized drone; prefer the derived MP3, then Ogg.
- [ ] Stall detection with rescue from the item's own servers, as designed in the research.
- [ ] Seeking disabled for hosts that ignore range requests.
- [ ] Real-device verification of Media Session, lock-screen controls, and autoplay rules (iOS Safari especially).

## Artwork

- [ ] Real covers with the small-tile-then-full sequence; palette extraction only from CORS-readable images.
- [ ] Detect and never show the Archive's placeholder image for missing thumbnails.
- [ ] Decide whether the decorative waveform stays **(decision)**.

## Rights and metadata

- [ ] Map real licence fields (`licenseurl`, `rights`, `possible-copyright-status`) into the rights model; most items have none, which must read as "Licence not stated".
- [ ] Real source and original-publication links (replacing the `#mock` links).
- [ ] Defensive normalisation for real data shapes (scalar-or-array fields, `original` as a list, mixed duration formats).

## More sources (see the Sources page)

- [ ] Wikimedia Commons (next): adapter, licence filter, rate-limit handling.
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
- [ ] Performance check on a low-end phone: the cover reveal animates a blur for 900 ms.
- [ ] Run end-to-end tests in CI (currently local only: they need a Chrome install and have not been validated on the CI image).
