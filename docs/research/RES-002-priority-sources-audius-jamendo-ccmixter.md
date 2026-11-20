---
id: RES-002
title: 'Priority sources: Audius, Jamendo, ccMixter'
type: research
status: completed
created: 2026-11-20
updated: 2026-11-20
project: unmarked
tags: [sources, audius, jamendo, ccmixter, random-discovery, licensing]
related: [RES-001, ADR-003, ADR-007, ADR-009, ADR-011, ADR-012]
---

# RES-002: Priority sources: Audius, Jamendo, ccMixter

## TL;DR

- **Question:** For the three priority providers, can each deliver free, random, browser-playable music to a static app, and what blocks it?
- **Answer:**
  - **Audius: feasible now.** It has a real random endpoint, open CORS, no key in probes, and range-capable MP3. The catch is rights: about 97% of sampled tracks are not Creative Commons.
  - **Jamendo: feasible, but blocked on a key.** The catalogue is Creative Commons and the API is non-commercial-free. It has no random order, and its terms say the `client_id` must not be disclosed, which a static site cannot honour.
  - **ccMixter: possible only as a build-time snapshot.** True random exists, but the API sends no CORS header and its audio host refused a plain request.
- **Recommendation (not fact):** spike in this order: Audius, Jamendo, ccMixter. Each spike's first question is in the last section.
- **Confidence:** Medium-High for Audius (live probes), Medium for Jamendo (no key, so no live audio test), Medium-Low for ccMixter (audio host untested from a browser).

Background and the other providers: [RES-001](RES-001-alternative-music-sources.md).

## Method

- Live read-only probes with an `Origin` header, 2026-11-20. No key, account or personal data was sent.
- Audius OpenAPI spec read at `api.audius.co/v1/swagger.yaml`.
- Jamendo official docs and terms read through a fetch agent. No key could be obtained, so no live audio check.
- Sample sizes are small and taken at one moment. Percentages are rough.
- Not circumvented: the Audius terms page returned 403, and a retry with a changed User-Agent was blocked by the session's safety check. A second attempt, in a headed Chrome with its own default User-Agent, was also blocked (see "Audius terms check"). The Audius legal terms therefore stay Unknown. The ccMixter audio refusal was not worked around either.

## Summary table

| Criterion                        | Audius                                                   | Jamendo                                          | ccMixter                                           |
| -------------------------------- | -------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| Free listening via API           | Yes, no key needed in probes                             | Yes, free `client_id`, non-commercial            | Yes, no key                                        |
| Metadata callable from a browser | Yes (CORS `*`, probe)                                    | Yes (CORS `*` on an error reply, probe)          | **No** (no CORS header, probe)                     |
| Audio playable in `<audio>`      | Yes (206 `audio/mpeg`, probe)                            | Unknown (needs a key to test)                    | **Unknown** (plain request got 403)                |
| Random discovery                 | **Yes**, `/tracks/feeling-lucky`                         | No random order; random offset only              | **Yes**, `rand=1` (30 per call max)                |
| Licence stated                   | 3% Creative Commons, 59% "All rights reserved", 38% none | Creative Commons on every item (terms 3.1)       | Creative Commons on every item, 65% non-commercial |
| Terms read                       | **No** (blocked); plan page read                         | Yes (2013 text)                                  | No terms page found                                |
| Key in client code               | Not needed in probes                                     | **Required, and terms say keep it private**      | None                                               |
| Overall                          | Go for a spike, one owner decision on rights             | Blocked until key and terms question are settled | Snapshot only, plus a browser test                 |

## 1. Audius

### Access and API (Verified, probe and spec)

- Spec: `https://api.audius.co/v1/swagger.yaml`. Read endpoints list an anonymous option (`security: - {}`), so no login is needed for public reads.
- All probes answered `200` with `access-control-allow-origin: *` and no key. The docs also describe a free plan (10 requests/s, 500,000/month) with a key said to be safe in client code ([S], `docs.audius.co`). Whether the keyless path is meant for production apps: Unknown. Older docs ask production apps to send an `app_name` parameter.

### Random discovery (Verified, probe)

| Endpoint                       | What it does                                                                                          | Probe result                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `/tracks/feeling-lucky`        | "random tracks found on the Feeling Lucky smart playlist"; `limit` 1 to 100, optional `min_followers` | Two calls of 100 gave **200 unique tracks, zero overlap** |
| `/tracks/latest`               | Newest tracks; `offset`, `limit`, optional `genre`                                                    | 100 returned                                              |
| `/tracks/trending/underground` | Underground trending                                                                                  | 100 returned                                              |
| `/tracks/trending`             | Top trending, capped: `offset=900` returned **0**                                                     | A capped, popular pool, not a random one                  |
| `/tracks/search`               | Search with genre, mood, BPM, key filters                                                             | Not used: the product has no search                       |

- `feeling-lucky` fits the "no search, no genre" rule best. How Audius picks its tracks, and what the default follower threshold is: Unknown. It is a curated "smart playlist", not a uniform draw from the whole catalogue.
- Sampled genre mix (200 `feeling-lucky` tracks): Electronic 53, Hip-Hop/Rap 31, Pop 14, Alternative 8, Experimental 8, House 7. Expect a skew toward electronic and hip-hop.
- Playability: all 200 sampled tracks had `is_streamable` true, none were gated, median length 190 s, 7 tracks under 30 s.
- `latest` and `underground` also returned streamable, ungated tracks, but with even less licence data (below).

### Streaming (Verified, probe)

- `GET /v1/tracks/{id}/stream` answers `302`, then `307` to a creator node, which served `206 Partial Content`, `audio/mpeg`, `Accept-Ranges: bytes`, with CORS `*`. It works with the app's `<audio>` plus 2-byte range probe design.
- The creator-node URL carries a signed timestamp. Replaying one about 15 minutes later gave `307`, not `206`. Treat these URLs as short-lived (Inferred): resolve from the API stream path at play time and do not cache the redirect target.
- Playback rescue ([ADR-005](../decisions.md#playback-rescue)) has no second URL per track in the data seen. A fallback would mean calling the API again or drawing another track. Mirror use for audio: Unknown (documented only for images).

### Rights and terms

| Sampled field (200 `feeling-lucky` tracks)               | Count     |
| -------------------------------------------------------- | --------- |
| "All rights reserved"                                    | 118 (59%) |
| No licence given                                         | 75 (38%)  |
| Creative Commons (BY 3, BY-NC-SA 1, BY-ND 1, BY-NC-ND 1) | 6 (3%)    |

- Audius streams the track to anyone, but almost no track grants a reuse licence. The app would honestly show "All rights reserved" or "Licence not stated" for most records. That is the same position taken for the Archive ([ADR-003](../decisions.md#internet-archive-terms-read-in-full-2026-11-18)): stream from the source, never download or re-host, state rights as found. The Archive hosts mixed rights too, but this is a much higher share. **Owner decision (below).**
- **Legal terms: Unknown.** `audius.co` blocks this machine (next section). Commercial limits, attribution and app rules in the legal terms are unread. The developer plan page is read and is quoted below.

#### Audius terms check (headed Chrome, 2026-11-20)

Method: Chrome launched on this machine with a throwaway profile and its normal User-Agent, driven over DevTools by a scratchpad script outside the repo. No evasion flags or header changes.

| Page                                                             | Result                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `audius.co/terms`, `audius.co/legal/terms-of-use`                | **HTTP 403**, Cloudflare "Sorry, you have been blocked". Not read. |
| `api.audius.co/plans`                                            | 200, read                                                          |
| `docs.audius.co` overview, SDK page                              | 200, read; no terms link on either                                 |
| `docs.audius.co/developers/api/stream-track`, `/guides/rest-api` | 200, but only the empty page shell (144 characters)                |

What the readable developer pages say (Verified, page):

- **Plans:** "Free: No Restrictions. Always Free." with 10 requests/second and 500,000 requests/month. "Unlimited" is by contacting `api@audius.co`.
- **Keys:** create an API key and a bearer token on the plans page. The **API key is "safe to include in client-side code"**. The **bearer token is backend only** and "grants your app the ability to act on behalf of users". In a browser, initialise "with your API key only".
- **Scope:** the REST API is described as "read-only access" to "query, stream, and search for tracks, users & playlists across the network".
- **Not stated on any readable page:** attribution rules, backlink or logo requirements, commercial-use limits, caching or download rules, whether `app_name` or a key is mandatory for production, and whether stream requests count toward the monthly quota.

Implications (Inferred unless marked):

- **A free API key is the documented route for a browser app**, so register one rather than rely on the keyless calls that worked in probes. The key would sit in public JavaScript, which Audius explicitly allows.
- **The quota is shared by everyone using the app**, because all browsers use the same key. A `feeling-lucky` call returns up to 100 tracks, so draws need few calls; whether the stream request counts is Unknown. 500,000 a month is ample for a personal app.
- **"No Restrictions" is the plan's wording, not a legal term.** It does not answer attribution or commercial use. The personal, non-commercial scope already set for the app ([ADR-003](../decisions.md#internet-archive-terms-read-in-full-2026-11-18)) is the safer reading.
- **Showing the artist, a link back to the Audius track and the licence as stated is cheap and matches the app's accession style**, so doing it removes most attribution risk even without the legal text (Assumption: Audius wants none of this).
- **To close the gap:** the owner opens the legal terms in their normal browser, or asks `api@audius.co`, and pastes the relevant clauses. Until then the terms position is "streams from Audius's own API under its published free plan; legal terms unread".
- Gated tracks (follow, tip, purchase, token) need a signed request. Filter on `is_streamable` and access; none appeared in the samples.

### Reliability and fit

- The API host list is served by the node itself (`api.audius.co` returned its own host, 31 h uptime). Decentralised, young, no SLA found.
- Fit with the accession model: title, artist, genre, length, artwork and release date are available. Verdict: **technically the easiest next source**.

## 2. Jamendo

### Access (Verified, page and probe)

- Free developer account at `devportal.jamendo.com`. Applications get the **read-only plan by default**; only write access needs approval. The application description must contain "the direct link toward the published application(s)" (terms clause 2).
- Every call needs `client_id`. The documented shared test key answers "application has been suspended" (probe), so an owned key is needed.
- Quota: one page read said up to 35,000 requests/month for non-commercial apps; the terms mention contacting Jamendo above 500,000 hits and a possible temporary limit. A second read did not find the 35,000 figure. **Unresolved.**
- **Key exposure:** the docs call `client_id` "private" and the terms say credentials "shouldn't under any circumstances be shared with or disclosed to third parties". A static GitHub Pages app would ship the id in public JavaScript. Whether Jamendo accepts that for a read-only key: Unknown (docs silent). This needs a question to Jamendo, or a small server-side proxy, which the project does not have today.

### Random discovery (Verified, page)

- `order` offers relevance, buzzrate, downloads, listens, popularity, name, artist, album, releasedate, duration, id. **No random.**
- `/radios/stream` is documented as no longer working. Feeds are editorial, not random.
- Workable pattern (Inferred): a random `offset` within the total (`fullcount=true`, which the docs say costs performance), `limit` up to 200, or filtering by `datebetween` and `durationbetween`. A weekly build-time ID snapshot, like the Archive map ([ADR-011](../decisions.md#map-rebuild-internet-archive)), would avoid live offset math; not tested.

### Streaming and data (Verified, page)

- `audio` is the stream URL; `audioformat` picks `mp31` (96 kbps, default), `mp32` (VBR), `ogg`, `flac`. `include=licenses` returns licence data. Exact field names for licence and duration were not on the page and need a response with a key.
- **Audio in `<audio>`, range support, and audio-host CORS: Unknown.** No key, so no test.

### Terms (Verified, page, text dated 2013-09-17)

- Free for non-commercial use. Commercial use includes "any revenue arising from affiliation programs or advertising".
- Credit the member as creator, credit Jamendo, and give "a direct backlink from each Content" to its Jamendo page.
- No caching or offline access, except "to the extent reasonably necessary for the operation".
- Do not replicate the overall Jamendo experience; do not suggest the app is official.
- Streaming outside jamendo.com: not mentioned either way. No SLA; Jamendo may suspend or change the API at will.

### Fit

- Overlaps the Jamendo albums already reachable as Archive mirrors, where the licence is read from `License.txt` ([ADR-007](../decisions.md#jamendo-licences-internet-archive-mirror)). The API adds newer music and per-track licences.
- Verdict: **good content and clear licences, but blocked** by the key-exposure question and the unverified audio host.

## 3. ccMixter

### Access and random (Verified, probe)

- Query API: `https://ccmixter.org/api/query?f=json&rand=1&limit=N&tags=mp3`. No key.
- **`limit` tops out around 30.** 30 worked; 40 and 50 returned an empty body.
- Four random calls of 20 gave **80 unique records, no overlap**. The pool is large: a count call returned **50,871** uploads tagged audio. That includes stems and loops.
- Responses carry `files[].download_url` (direct MP3), `license_name`, `license_url`, tags, duration.

### What the 80 sampled records looked like

| Measure         | Result                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Licence         | Attribution-NonCommercial 3.0: 52 (65%); Attribution: 21; NonCommercial Sampling Plus: 2; Sampling Plus: 1 |
| Has an MP3      | 80 of 80                                                                                                   |
| Length          | median 212 s; 7 under 30 s; 1 over 10 min                                                                  |
| Tagged `sample` | 30 of 80, which are loops and stems, not finished songs. A filter would be needed                          |

### Blockers (Verified, probe)

- **No CORS header** on the API reply: a browser cannot read it directly.
- **Audio host:** plain `GET` and `Range` requests to `ccmixter.org/content/...mp3` returned `403 Forbidden`. The cause (hotlink or client filtering) is Unknown. A real browser test from the app's origin is required; it was not worked around.
- Responses are Latin-1 bytes labelled `text/plain` with no charset, so accents garble through `fetch().json()` (Inferred; a build step would fix it).
- The server runs PHP 5.4 on Debian: old, small community, best-effort.

### Pattern that would fit (Inferred, untested)

- A deploy-time snapshot of finished tracks (exclude `sample`), the way the Archive map works. Playback would still need `ccmixter.org` to serve audio to a page on another origin.
- Snapshot size depends on how many fields are kept; not measured.

### Fit

- Licences are plainly stated and mostly non-commercial, which suits a personal app. Verdict: **worth one cheap browser test of the audio host before any other work**; if it fails, drop it.

## Impact on project

- **Architecture:** the three sources split into two shapes: live API (Audius), live API behind a key (Jamendo), and snapshot (ccMixter, maybe Jamendo). None would change the UI, which never imports sources ([PROJECT_OVERVIEW](../PROJECT_OVERVIEW.md)).
- **Weights:** the current 80/20 Archive/Commons mix ([ADR-009](../decisions.md#wikimedia-commons-added-2026-11-18)) would need a rethink for three more sources. Not designed.
- **Code and operations:** unchanged. Nothing was built.

## Parked, not prioritised

[RES-001](RES-001-alternative-music-sources.md) keeps the notes on Openverse, Mixcloud, Freesound, SoundCloud, YouTube, Bandcamp, Spotify, Apple previews, Free Music Archive and the rest. **Radio Browser** is recorded as a future "internet radio" feature: [roadmap](../roadmap.md#more-sources-see-the-sources-page).

## Sources

| Source                                                                                            | Type             | Key info                                               | Confidence          | Accessed   |
| ------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------ | ------------------- | ---------- |
| `api.audius.co/v1/swagger.yaml`                                                                   | Primary          | Endpoints, anonymous read, `feeling-lucky`, stream     | High                | 2026-11-20 |
| `api.audius.co/v1/tracks/{feeling-lucky, latest, trending/underground, trending}`, `/{id}/stream` | Experiment       | CORS `*`, 206 MP3, licence mix, offset cap, URL replay | High                | 2026-11-20 |
| `docs.audius.co` (SDK page, gate guide)                                                           | Primary, partial | Free plan, key client-safe                             | Medium ([S])        | 2026-11-20 |
| `devportal.jamendo.com/api_terms_of_use`                                                          | Primary          | Terms 2, 3.1, 3.3, 4.1, 4.2, 5 to 8                    | High                | 2026-11-20 |
| `developer.jamendo.com/v3.0/{tracks, authentication, radios, radios/stream, read-methods, feeds}` | Primary          | Parameters, order values, plans, broken radio stream   | High                | 2026-11-20 |
| `api.jamendo.com/v3.0/tracks` with the documented test key                                        | Experiment       | CORS `*`; test key suspended                           | High                | 2026-11-20 |
| `ccmixter.org/api/query` (random, count, limit tests) and one audio URL                           | Experiment       | `rand`, limit cap, licences, no CORS, audio 403        | High (small sample) | 2026-11-20 |
| `ccmixter.org/query-api`                                                                          | Primary          | Query parameters                                       | Medium              | 2026-11-20 |

## Conclusion

Audius is the only one of the three that works end to end from a browser today, and its random endpoint matches the product. Its open question is rights and terms, not engineering. Jamendo has the cleanest licensing story but cannot be called safely from a static site until Jamendo says a public `client_id` is acceptable. ccMixter is a cheap test with a likely no.

## Follow-ups

- [x] **Owner decision (2026-11-20): yes.** A source with mostly "All rights reserved" tracks is acceptable for this personal listening app, on the same terms as the Archive: the app offers no download, never re-hosts audio, and states rights as found. This does not replace reading Audius's developer terms, which stay unread. Record it in ADR-015 if Audius is built.
- [ ] **Audius terms (blocked, owner needed):** the legal pages are blocked even in headed Chrome. The owner reads them in their own browser, or emails `api@audius.co`, and pastes attribution, commercial-use and app-policy clauses.
- [x] **Audius built (2026-11-20)** after the owner's go-ahead: [ADR-015](../decisions/ADR-015-audius-source.md). The items below that remain open are the key, the terms, and the phone check.
- [ ] **Audius spike (partly done):** register a free API key and confirm it works in a browser call; measure playable share and how many distinct tracks `feeling-lucky` yields over many calls; check the URL-expiry behaviour in a real `<audio>` element.
- [ ] **Jamendo spike:** register a read-only app; ask Jamendo whether a public `client_id` in a static page is acceptable; test `<audio>` and range from the audio host; confirm the licence and duration field names and the real monthly quota.
- [ ] **ccMixter spike:** one `<audio>` test from a page on another origin. If it plays, design a snapshot; if not, drop it.
- [ ] If a source is chosen, write ADR-015 with the terms position and source interface.
