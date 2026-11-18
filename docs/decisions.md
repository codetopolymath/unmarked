# Decisions

Short records of choices made, with the reasoning, so they are not re-litigated by accident.

## Name: Unmarked

- **Why:** it states the product rule (no categories or labels) and the object (an unlabelled record). It is short, easy to spell, and fits the archive/accession language of the interface.
- **Checked:** web searches found no music app, label or app-store listing called "Unmarked". Related names exist: "UNLABELED" is a registered mark for record-label services; random-music apps such as Univershuffle, Lazyrecords and True Shuffle exist and differ in approach (they shuffle a known catalogue). The repository name was free.
- **Rejected:** "Deadwax" (two existing iOS apps), "Foundling" (an abandoned-child connotation), "Accession" and "Provenance" (accurate but generic).
- **Risk:** low for a personal, non-commercial project. This was a web search, not a trademark clearance; do one before any commercial use.

## Hosting: public repository, GitHub Pages

- The repository is public under `codetopolymath`; GitHub Pages on a free plan requires it.
- The site is deployed from `src/` by a GitHub Actions workflow, so the repository keeps a conventional layout instead of putting app files at its root.
- The staging build carries `noindex`, since it only contains mock data.

## Internet Archive terms (read in full, 2026-11-18)

The live terms were read in a JavaScript-rendering Chrome. Relevant text:

- Access is "granted for scholarship and research purposes only".
- Users certify use "will be limited to noninfringing or fair use under copyright law".
- Creative Commons or other declared licences apply "to the extent you trust the declaration and declarer (which is rarely the Internet Archive)".
- Use is at the user's own risk; no warranty.
- Nothing about automated access, linking, or embedding was found.

**Position taken:** proceed. The app is personal and non-commercial, streams from the Archive's own URLs, never downloads or re-hosts audio, links to each item's page, and states unknown rights as unknown. The "scholarship and research" wording is the main residual ambiguity for a listening app; revisit if the project ever becomes more than personal.

## Sources: status board in the app

The Sources page lists Internet Archive collections as in scope (green) and every other researched source as unavailable (grey, with its todo). It is informational and never filters a discovery. The 78 rpm collections stay in scope.

## Jamendo licences (Internet Archive mirror)

- **Source of truth:** Jamendo albums mirrored on the Archive carry no licence in metadata, only a `License.txt` table (`Track | License URL`) inside the item. Surveyed 44 items from old and recent uploads: every one had the file, in one format, with a single Creative Commons licence per album. No cost: it is a 700-byte file on archive.org with CORS, fetched once per Jamendo record.
- **Mapping, not guessing:** one licence maps to its Creative Commons terms; differing track licences show the union of restrictions ("CC BY-NC-SA, varies by track"); anything uninterpretable or unreadable leaves "Licence not stated". The `artwork` row licenses the cover and is ignored.
- **What it means for you:** most Jamendo albums are non-commercial (NC), which fits a personal listening app. Streaming here is still not a licence to reuse a recording.

## Spoken-word filter (Internet Archive)

- **Why:** a podcast episode surfaced inside the music frame. Measured, about 1.5% of the frame is non-music: roughly 7.9k community-radio items, 4k nature soundscapes, 2k dialect interviews and 350 university podcasts, plus items the archive itself tags "Non-Music" or "Spoken Word".
- **Precision first.** A wrong "spoken" verdict hides real music for good, while a miss costs one skip. Keyword rules that sound sensible were wrong on the data: "podcast" is mostly netlabel music, the radio collections are live concerts, and a poetry collection also hosts live bands. Only explicit markers count (the catalogue tags, "Lecture", "Sermon", whole-subject "Speech", TV-style "(E01)"), plus a short collection denylist.
- **Unbiased measurement:** 300 uniform random frame items, 2 flagged (a community-radio episode and an oral-history interview), both correct. Nature soundscapes are excluded as non-music; remove `hamiltonbioacousticsfieldrecordings` from the list in `spoken.js` if you want them back.
- **Reopening is not filtered.** A record already in your History or Kept opens normally even if the filter later learns to reject it.

## Wikimedia Commons (added 2026-11-18)

- **At the same address, not a separate mode.** Every draw comes from one live source that tries the Internet Archive first about 80% of the time and Commons about 20%, falling back to the other if one is down. Commons has about 40,000 usable files against the Archive's roughly 930,000, so a purely proportional mix would show it about 4% of the time. The weights are a guess (`DEFAULT_WEIGHTS`); `?source=mock` is the only switch.
- **Frame:** `filetype:audio deepcategory:"Audio files of music"` (49,906 files), narrowed to files over 300 KB, no MIDI, and at least 30 s, which leaves about 40,000 and drops pronunciation and music-theory clips.
- **Licences:** every Commons file states one, so licence data is much better than the Archive's.
- **Playback:** WAV and FLAC originals are never streamed; Commons' MP3 transcodes are. Ogg plays directly only when no MP3 exists, because Safari cannot play Ogg Vorbis.
- **Etiquette:** browsers cannot send a custom User-Agent or `Api-User-Agent` under CORS, so the app identifies only as a browser. Wikimedia answers generic script clients with `429` (Retry-After 600): scripts and tests that call it must send a descriptive User-Agent. Real browsers were unaffected in testing.
- **Gotcha, fixed:** the Commons CDN caches identical API requests for an hour (`s-maxage=3600`), so the first version served the same five files to everyone. Each random call now carries a unique throwaway parameter. Unit tests cannot catch this; the live smoke test does.

## "Restricted" items (Internet Archive)

Internet Archive items can carry `access-restricted-item: true`. In our measurements about 5.05 million audio items are flagged, mostly radio programmes. The flag means the Archive limits how an item is accessed (lending, or streaming only without download). It did **not** reliably mean "will not play": two flagged items, one in a `stream_only` collection, streamed anonymously. **Default:** include a flagged item only if its audio verifies as playable, and say in Details that the source restricts it.

## Map rebuild (future, when the Internet Archive integration exists)

The discovery algorithm needs a small static file listing time windows of about 5,000 items each (see the sampling research). **Default:** rebuild it by hand about monthly with a repository script (about 12 minutes, an estimate from measured request times), then commit the result. About 30% of the music frame was uploaded in 2026, so a stale map misses new items but never breaks anything. A scheduled workflow is deferred because GitHub disables scheduled workflows in public repositories after 60 days without activity.

## Product defaults

- New discoveries auto-play (the Discover click is the user gesture browsers require); continuing after the last track is off.
- With auto-play off, the previous record keeps playing in the player bar while a new one is viewed.
- History labels are Kept, Played, Seen. Seen is neutral on purpose.
- Display fonts fall back to serif faces for CJK, Cyrillic, Greek and Arabic.

## Commit identity

Commits use the GitHub no-reply address for `codetopolymath` (set locally in this repository only). The machine's global git identity is a work address and must not appear in a public history.
