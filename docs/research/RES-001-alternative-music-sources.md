---
id: RES-001
title: 'Alternative music sources beyond the Internet Archive and Wikimedia Commons'
type: research
status: completed
created: 2026-11-20
updated: 2026-11-23
project: unmarked
tags: [sources, providers, licensing, api, playback]
related: [RES-002, ADR-003, ADR-005, ADR-007, ADR-009, ADR-012]
---

# RES-001: Alternative music sources

> **Priorities set 2026-11-20 (owner):** investigate Audius, then Jamendo, then ccMixter. Deep dive: [RES-002](RES-002-priority-sources-audius-jamendo-ccmixter.md). Everything else here is kept as reference for later. **Radio Browser** is parked as a possible future "internet radio" feature, not prioritised.

## TL;DR

- **Question:** Which other platforms could act as interchangeable, free-to-listen sources for random discovery in Unmarked?
- **Answer:** Only providers that hand a browser a **direct audio URL** fit the app today. That is a small set: **Audius**, **Jamendo** (API), **ccMixter**, and **Radio Browser** (live streams, a different model). Every big-name platform (SoundCloud, YouTube, Spotify, Bandcamp, Apple, Deezer, Free Music Archive) is blocked by policy, by a paid or Premium requirement, or by an iframe-only player.
- **Recommendation (not a fact):** Run short spikes on Audius and Jamendo first, then ccMixter. Treat Radio Browser as a product decision, not a technical one. Do not pursue SoundCloud, YouTube, Bandcamp, Spotify or FMA.
- **Confidence:** Medium. Official pages were read and several APIs were probed live, but some terms pages were blocked (Audius, Europeana, Musopen) and a few pages came back summarised. Each gap is labelled.

## Question and constraints

- Question: which providers can supply free, legitimate, random-discoverable music to this app, and how well does each fit?
- Constraints that decide feasibility (Verified: [PROJECT_OVERVIEW](../PROJECT_OVERVIEW.md), [ADR-002](../decisions.md#hosting-public-repository-github-pages)):
  - Static site on GitHub Pages: **no backend, no secrets**. Anything needing a server-side secret or a proxy is out unless that changes.
  - Plain `<audio>` playback with fallback URLs, 2-byte range probes and Media Session ([ADR-005](../decisions.md#playback-rescue)). Iframe players bypass all of this.
  - Personal, non-commercial; stream from the provider, never re-host ([ADR-003](../decisions.md#internet-archive-terms-read-in-full-2026-11-18)).
  - Product rule: no search, genres or recommendations ([ADR-012](../decisions.md#product-defaults)). Random draw only.
- Out of scope: implementation. Nothing in the app was changed.

## Method

- Read official docs and terms through fetch agents (2026-11-20). Where a page came back truncated or summarised, the finding is marked **[S]**.
- Ran read-only `curl` probes with an `Origin` header to check CORS, key requirements, range support and response shape (2026-11-20). No account, key or personal data was sent.
- Not done: no key was registered, no browser test, no listening test.

## Evidence labels

**Verified (probe)** = observed in a live request. **Verified (page)** = read on an official page. **[S]** = from a summarised page, treat as Inferred. **Unknown** = could not be read.

## What the app needs from a source

| Need                                                    | Why                                                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Metadata call works from a browser (CORS, no secret)    | No backend to proxy it                                                                          |
| A direct audio URL playable in `<audio>`, range support | Keeps the rescue, probe and Media Session pipeline ([ADR-005](../decisions.md#playback-rescue)) |
| A way to pick something at random                       | Product rule; search-only APIs force workarounds                                                |
| Licence stated per item, or honestly "not stated"       | The accession model shows licence plainly                                                       |
| Free access, allowed for a non-commercial app           | Project scope                                                                                   |

## Overview matrix

| Provider                   | Free, no account to listen   | Direct audio in `<audio>`               | Official API                | CORS from browser                | Random discovery            | Tier           |
| -------------------------- | ---------------------------- | --------------------------------------- | --------------------------- | -------------------------------- | --------------------------- | -------------- |
| Internet Archive (in use)  | Yes                          | Yes                                     | Yes (search, metadata)      | Yes                              | Yes (static partition map)  | In use         |
| Wikimedia Commons (in use) | Yes                          | Yes                                     | Yes (MediaWiki)             | Yes                              | Yes (random search)         | In use         |
| Audius                     | Yes                          | Yes (probe)                             | Yes                         | Yes (probe)                      | Partial (trending pools)    | 1              |
| Jamendo API                | Yes (dev `client_id` needed) | Yes (field `audio`)                     | Yes                         | Yes (probe)                      | Partial (random offset)     | 1              |
| ccMixter                   | Yes                          | Yes (probe)                             | Yes (Query API, `rand=1`)   | **No** (probe)                   | Yes                         | 2              |
| Radio Browser              | Yes                          | Yes (live streams)                      | Yes                         | Yes (probe)                      | Yes (`order=random`)        | 2              |
| Openverse (aggregator)     | Yes                          | Yes (probe)                             | Yes                         | Yes (probe)                      | Not documented              | 2              |
| Mixcloud                   | Yes                          | **No** (widget only)                    | Yes (no audio)              | Yes (page)                       | Partial (popular/new lists) | 2              |
| Freesound                  | Key needed                   | Previews only                           | Yes                         | Secret must stay off the browser | Not documented              | 3              |
| SoundCloud                 | Yes (listen)                 | Widget; API stream needs Artist Pro app | Yes (gated)                 | Unknown                          | No                          | 3              |
| YouTube / YouTube Music    | Yes (listen)                 | **No** (iframe only)                    | Data API; none for YT Music | n/a                              | Search only                 | 3              |
| Bandcamp                   | Yes (listen)                 | **No** (embed only)                     | **None public**             | n/a                              | No                          | 3              |
| Spotify                    | **No** (Premium)             | SDK, Premium only                       | Yes                         | n/a                              | n/a                         | 3              |
| Apple iTunes Search        | Yes                          | 30 s previews only                      | Yes                         | Unknown (JSONP)                  | No                          | 3              |
| Free Music Archive         | Yes (site)                   | Hotlinking banned                       | **Shut down**               | n/a                              | No                          | 3              |
| Deezer                     | Unknown                      | Unknown                                 | Unknown (login wall)        | Unknown                          | Unknown                     | 3 (unverified) |

## Tier 1: strong candidates

### Audius

- **What it is:** decentralised, artist-uploaded streaming platform. Mostly independent and electronic music (Inferred from a one-track sample; catalogue mix Unknown).
- **Free access:** listening needs no payment. A free API plan exists: 10 requests/second and 500,000 requests/month, with an API key "safe to include in client-side code" (Verified, page: `docs.audius.co` SDK page, [S]). Create keys at `api.audius.co/plans`.
- **Verified (probe, 2026-11-20):**
  - `GET https://api.audius.co/v1/tracks/trending?limit=1` returned 200 **without any key**, with `access-control-allow-origin: *`.
  - `GET /v1/tracks/{id}/stream` answers `302` to a creator node (`creatornode.audius.co/tracks/cidstream/...?signature=...`), which served `206 Partial Content`, `audio/mpeg`, `Accept-Ranges: bytes`, `Access-Control-Allow-Origin: *`. This is exactly what `<audio>` plus range probes need.
  - Track JSON has `is_streamable`, `access.stream`, `genre`, `duration`. The sample's `license` field was `null`.
- **Discovery:** trending (genre and time filters), underground trending, trending playlists, search with genre filter ([S]). No documented random endpoint. A probe with `limit=100&offset=900` on trending returned **0 items**, so trending pools are capped and a draw from them is "random among the popular", not random across the catalogue. How deep search or browse can go: Unknown.
- **Limits and risks:**
  - The signed stream URL carries a timestamp. Whether it expires, and after how long: Unknown.
  - Gated tracks (follow, tip, purchase, token gates) return 401 without a signature; filter on `access.stream` and `is_streamable` (Verified, page [S]).
  - Docs are inconsistent on key vs `app_name` vs bearer token. The older guide asks production apps to send `app_name` (Verified, page via search snippet).
  - **Developer terms: Unknown.** `audius.co/terms` returned 403. Read them before any build.
  - Rights are artist-declared; the licence is often missing. The app would show "Licence not stated" for many records.
- **Feasibility: High technically, Medium on rights clarity.**

### Jamendo (direct API)

- **What it is:** a catalogue of independent artists under Creative Commons; roughly half a million tracks ([S] docs say "half-a-million"; Openverse indexes 644,709 Jamendo items, Verified probe). Pop, rock, electronic, ambient, classical, instrumental.
- **Free access:** free for **non-commercial** use: "The API may be used freely for non-commercial uses" (Verified, page: API terms 3.3). Needs a developer account and a private `client_id` from `devportal.jamendo.com`; read access is the default plan (Verified, page). Quota: the docs home says up to 35,000 requests/month for non-commercial apps; the terms say contact them above 500,000 hits. These figures conflict (Verified, page). The documented test key `709fa152` answers **"application has been suspended"** (Verified, probe), so a real key is required.
- **Playback:** the track objects carry `audio` (stream URL, default low-bitrate MP3, `audioformat` can request `mp32`, `ogg`, `flac`) (Verified, page). The API answers with `access-control-allow-origin: *` (Verified, probe). Audio-element playback and range support from the audio hosts: Unknown (not tested without a key).
- **Discovery:** the `order` values are relevance, popularity, listens, downloads, dates, names and similar; **no random order** (Verified, page). Random draws need a random `offset` (max `limit` 200; needs `fullcount=true`, which the docs say costs performance). Feasible, not elegant.
- **Terms that matter (Verified, page, terms last modified 2013-09-17):**
  - Must credit the Jamendo member as creator, credit Jamendo as provider, and give a direct backlink from each item (4.1).
  - "Applications must not be specifically designed to cache the content nor offering an offline access" (3.3).
  - Must not "replicate the overall experience of JAMENDO services" (3.3).
  - No SLA; Jamendo may suspend, change or terminate the API at any time (5, 7, 8).
- **Overlap:** the app already reaches many Jamendo albums through Internet Archive mirrors and reads their licence ([ADR-007](../decisions.md#jamendo-licences-internet-archive-mirror)). The direct API adds fresher and more complete coverage and per-track licences.
- **Feasibility: High**, once a key exists. The public `client_id` would sit in client code; abuse is the owner's quota (Inferred).

## Tier 2: possible candidates

### ccMixter

> **Update 2026-11-23: moved to Tier 3, unsuitable.** Its audio host answers 403 to every request that does not come from a `ccmixter.org` page (Referer-based hotlink protection), so the app cannot play it. Tested in real Chrome: [RES-002 section 3](RES-002-priority-sources-audius-jamendo-ccmixter.md#3-ccmixter). The notes below are the original survey.

- **What:** remix and sample community; Creative Commons music; electronic, hip-hop, ambient, vocal remixes.
- **API:** Query API 2.0 with `rand=1` for random order and `f=json` (Verified, page). Probe returned track JSON with `files[].download_url` (a direct MP3), `license_name` and `license_url` (Verified, probe). Many items are `by-nc`.
- **Blocker:** **no `Access-Control-Allow-Origin` header** on the API response (Verified, probe). A browser on GitHub Pages cannot read it. Audio itself may still play through `<audio>` without CORS (Inferred; no probe of the audio host).
- **Workaround that fits the existing design (Inferred):** build a static snapshot at deploy time, the way the Archive map works ([ADR-011](../decisions.md#map-rebuild-internet-archive)), instead of live calls. No proxy, no secret.
- **Reliability:** the server runs PHP 5.4 on Debian (Verified, probe headers). Old stack, small community. Treat as best-effort.
- **Feasibility: Medium.**

### Radio Browser (internet radio directory)

- **What:** a free, open, community directory of radio streams (station count not checked). Content is live radio, not catalogued tracks.
- **Access:** no key; asks for a descriptive `User-Agent`; "completely free and open source"; "without guarantee to work"; one volunteer maintainer since 2015 (Verified, page).
- **Verified (probe):** `all.api.radio-browser.info/json/stations/search?order=random&limit=1&hidebroken=true&is_https=true` returned 200 with `access-control-allow-origin: *`. A sample of 100 random stations had **63 with an `https` stream**, so mixed content is real and the `is_https` filter matters.
- **Discovery:** `order=random`, tag and country filters, `url_resolved` (use this one in browsers), `codec`, `bitrate`, `lastcheckok` (Verified, page).
- **Limits:** no track, album or duration; no seeking; stream URLs die; some use HLS or odd codecs; the directory says nothing about stream rights (Verified, page: not found). Playback rescue would mean "next random station".
- **Fit:** technically easy, but it changes the product from "one record, an accession" to "tune in". That is an owner decision before it is an engineering one.
- **Feasibility: High technically, Low on product fit.**

### Openverse (aggregator)

- **What:** a catalogue search over open-licensed media. Its audio index lists **Jamendo (644,709), Wikimedia Commons (4,004,378) and Freesound (591,899)** (Verified, probe: `/v1/audio/stats/`). Free Music Archive is not listed.
- **Verified (probe):** `GET /v1/audio/?q=piano&page_size=1` returned 200, `access-control-allow-origin: *`, and per item a direct `url` (for example a `cdn.freesound.org` preview MP3), `license`, `license_url`, `creator` and `foreign_landing_url`. A request without `q` failed to return in the probe window (not investigated).
- **Gaps:** no random order documented ([S] search-algorithm page). Anonymous rate limits: Unknown (docs describe tiers qualitatively). Terms for automated app use: Unknown.
- **Why it is only Tier 2:** it mostly repeats sources the app already has or can reach directly (Commons, Jamendo), and Freesound is largely sound effects (Inferred from one sample item; share Unknown). Its value would be reaching Jamendo without a key (Inferred, unverified).
- **Feasibility: Medium.**

### Mixcloud

- **What:** DJ mixes, radio shows, long-form sets.
- **Verified (page):** the REST API needs no key to read, **sends CORS headers**, and has `popular`, `popular/hot` and `new` lists. "Audio streams are not available through the Mixcloud API"; the sanctioned path is the **embedded widget**, controllable through `Mixcloud.PlayerWidget`, and "the widget must be visible on the page for the API to work".
- **Consequence:** discovery is easy, playback is an iframe. A visible widget, no `<audio>`, so the rescue logic and Media Session handling do not apply. Rate limits are not numbered. Terms page: not read.
- **Feasibility: Medium for discovery, Low for playback consistency.**

## Tier 3: experimental or unsuitable

| Provider                | Verdict    | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SoundCloud**          | Unsuitable | Registering an API app needs an **Artist Pro subscription** (page: `register-app`). Terms prohibit "any playback experience which aggregates and streams User Content with content from other services", any "on-demand listening service" built from multiple users' content, and persistent caching; attribution and backlinks are required; playback is capped at 1,500 stream calls per 24 h per app (page: terms, rate-limits; terms page was truncated, last section [S]). Widget needs no key but is an iframe. No random or charts endpoint found. Mixing with Archive or Commons is exactly what the terms forbid. |
| **YouTube**             | Unsuitable | Embedded player only; "must not display overlays... in front of any part of a YouTube embedded player"; minimum 200x200 viewport; Referer identification required (page: required-minimum-functionality, verbatim). Developer policies bar separating audio from video and "background player" features, and merging YouTube results with other sources ([S] for the first two, verbatim for the third). No audio-only mode, no hiding the player. Data API quota and Creative Commons filter: **not verified** (pages not fetched).                                                                                        |
| **YouTube Music**       | Unsuitable | No official public API found in this research (Unknown, not directly verified); unofficial wrappers would be a terms violation (Assumption).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Bandcamp**            | Unsuitable | The API is for partners: "To register for API use, contact us". Terms license content "solely for personal, non-commercial use". Only Bandcamp's own embed code is sanctioned; the oEmbed endpoint is undocumented (page: developer, terms; search snippets).                                                                                                                                                                                                                                                                                                                                                               |
| **Spotify**             | Unsuitable | "The Web Playback SDK requires a Spotify Premium subscription"; streaming "shall only be made available to subscribers to the Premium Spotify Service"; the developer account also needs Premium (page: web-playback-sdk, policy, Feb 2026 migration guide). Breaks "no subscription". The claimed Nov 2024 removal of `preview_url` was **not verified**.                                                                                                                                                                                                                                                                  |
| **Apple iTunes Search** | Unsuitable | 30-second previews only, allowed "for the purposes of promoting", next to a store badge, "streamed only, and not downloaded, saved, cached" (page). About 20 calls per minute. No full tracks.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Free Music Archive**  | Unsuitable | "we unfortunately had to shut down our API"; "We do not allow hotlinking"; forwarding search queries and scraping results is not allowed (page: `/app-developers`). FMA content that is mirrored on the Internet Archive is already reachable there (see roadmap, duplicate handling).                                                                                                                                                                                                                                                                                                                                      |
| **Freesound**           | Poor fit   | API key; "Do not include your client secret in browser JavaScript"; previews need no OAuth but originals do; 60 requests/minute, 2,000/day; non-commercial only; sound-effects heavy, no random order documented (page).                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Deezer**              | Unverified | Docs sit behind a login wall, so nothing could be verified. Do not assume.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Not researched or inconclusive

| Provider                                          | Status                                                          |
| ------------------------------------------------- | --------------------------------------------------------------- |
| Europeana, Musopen                                | Pages returned 403 to the fetch tool; Unknown                   |
| HearThis.at                                       | Redirects to RapidAPI; not followed                             |
| Audiomack, Napster, Qobuz, Radio Garden, Dogmazic | Not looked at; probably paid or no public API (Assumption)      |
| Self-hosted (Funkwhale, Navidrome/Subsonic)       | Need a user's own server; out of scope for a shared random draw |

## Cross-cutting findings

- **Two integration families.** Direct-URL providers (Archive, Commons, Audius, Jamendo, ccMixter, Radio Browser) can share one playback pipeline. Embed providers (YouTube, SoundCloud widget, Mixcloud, Bandcamp) force a different player. A consistent "switch providers and nothing changes" experience is only realistic inside the first family.
- **Mixing sources is itself a policy risk.** SoundCloud's terms and YouTube's search-merging rule both prohibit blending their content with other services' content (Verified, page). The "random from every enabled provider" idea is incompatible with them by design.
- **Random is the weak point.** Only Radio Browser (`order=random`), ccMixter (`rand=1`) and the existing Archive map and Commons search give true random. Audius and Jamendo need a sampling workaround (a random offset, or a build-time snapshot). A provider with a capped pool (Audius trending) is "random among popular", which cuts against the unmarked, no-popularity principle.
- **Licence statements are uneven.** Jamendo and ccMixter state Creative Commons licences per item. Audius often returns none. Radio Browser says nothing about rights.
- **Keys and quotas.** Jamendo needs a `client_id` in client code. Audius keys are described as client-safe. Public keys can be copied by anyone, so the quota is shared with whoever finds it (Inferred).
- **Reliability.** Audius is decentralised but young; Radio Browser has one maintainer and warns it can go down; Jamendo's terms are from 2013 and allow suspension at will; ccMixter runs on an old stack. None has an SLA. The Archive and Commons remain the steady core.

## Recommended shortlist (recommendation, not fact)

| Order | Provider            | Why                                                       | First spike to run                                                                                                                                                              |
| ----- | ------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Audius              | Probed live: no key, CORS, range-capable MP3 stream       | Read developer terms; test stream-URL expiry; find how deep search or browse reaches beyond trending; measure how many records are playable                                     |
| 2     | Jamendo (API)       | Free non-commercial CC catalogue, CORS, audio URL in JSON | Register a `client_id`; resolve the 35,000 vs 500,000 quota conflict; test `<audio>` and range on the audio host; test random-offset sampling; plan credit and backlink display |
| 3     | ccMixter            | True random and licence data, direct MP3                  | **Failed 2026-11-23:** audio is hotlink-protected, see RES-002. Dropped unless ccMixter allows our origin                                                                       |
| 4     | Radio Browser       | Easy and random, but a different product model            | Owner decision: is a live "tune in" mode in scope? Skip if not                                                                                                                  |
| Watch | Openverse, Mixcloud | Openverse overlaps; Mixcloud is iframe-only               | Revisit only if the shortlist falls short                                                                                                                                       |

Do not pursue: SoundCloud, YouTube and YouTube Music, Bandcamp, Spotify, Apple previews, Free Music Archive, Freesound.

## Impact on project

- **Architecture:** a multi-provider setup is plausible for direct-URL providers behind one source interface (the code already isolates sources from the UI; Verified: PROJECT_OVERVIEW). A per-provider on/off setting fits that shape. Not designed or built.
- **Code:** none changed.
- **Legal:** each added source needs its own terms position, as [ADR-003](../decisions.md#internet-archive-terms-read-in-full-2026-11-18) did for the Archive. Jamendo and any future commercial scope need a re-read.
- **Operations:** keys and quotas appear for the first time (Audius, Jamendo). The app has no place to keep secrets (static hosting), so only client-safe keys qualify.

## Sources

| Source                                                                                | Type                | Key info                                    | Confidence            | Accessed   |
| ------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------- | --------------------- | ---------- |
| `api.audius.co/v1/tracks/trending`, `/v1/tracks/{id}/stream`                          | Experiment          | No key, CORS `*`, 206 MP3, offset cap       | High                  | 2026-11-20 |
| `docs.audius.co` (llms-full, SDK, gate guide)                                         | Primary, partial    | Free plan, key safe client-side, gating     | Medium                | 2026-11-20 |
| `developer.jamendo.com/v3.0` (auth, tracks), `devportal.jamendo.com/api_terms_of_use` | Primary             | `client_id`, order values, terms 3.1 to 8   | High                  | 2026-11-20 |
| `api.jamendo.com/v3.0/tracks` with the documented test key                            | Experiment          | CORS `*`; test key suspended                | High                  | 2026-11-20 |
| `ccmixter.org/query-api`, `ccmixter.org/api/query?f=json&rand=1`                      | Primary, experiment | `rand`, file URLs, licences; no CORS header | High                  | 2026-11-20 |
| `docs.radio-browser.info`, `api.radio-browser.info`, live search probe                | Primary, experiment | Random order, CORS `*`, 63 of 100 https     | High                  | 2026-11-20 |
| `api.openverse.org/v1/audio/`, `/audio/stats/`, `docs.openverse.org`                  | Experiment, primary | Sources, CORS `*`, licence fields           | Medium                | 2026-11-20 |
| `developers.soundcloud.com` (register-app, terms, rate-limits, guide, html5-widget)   | Primary             | Artist Pro, mixing ban, limits, widget      | High (terms tail [S]) | 2026-11-20 |
| `developers.google.com/youtube/terms/*`, `/iframe_api_reference`                      | Primary             | Player rules, no overlays, source merging   | Medium ([S] parts)    | 2026-11-20 |
| `mixcloud.com/developers` and `/widget`                                               | Primary             | CORS, no audio API, visible widget          | High                  | 2026-11-20 |
| `bandcamp.com/developer`, `/terms_of_use`                                             | Primary             | Partner-only API, personal-use licence      | Medium                | 2026-11-20 |
| `developer.spotify.com` (web-playback-sdk, policy, terms, Feb 2026 guide)             | Primary             | Premium required                            | High                  | 2026-11-20 |
| `performance-partners.apple.com/search-api`                                           | Primary             | 30 s previews, promo-only terms             | High                  | 2026-11-20 |
| `freemusicarchive.org/app-developers`, `/about`                                       | Primary             | API shut down, hotlinking banned            | High                  | 2026-11-20 |
| `freesound.org/docs/api/*`                                                            | Primary             | Key, 60/min, non-commercial                 | High                  | 2026-11-20 |

## Conclusion

The free, legitimate, browser-playable set is small. Four providers hand a static page a direct audio URL, and only Audius and Jamendo are credible catalogue-scale additions. The famous platforms are closed to this use by their own terms, not by technical difficulty. Randomness, not playback, is the real engineering cost for every new source.

## Follow-ups

- [ ] Owner: pick which shortlist items to spike, and decide whether a live-radio mode fits the product (Radio Browser).
- [ ] Spike: Audius (terms, URL expiry, catalogue depth) and Jamendo (key, quota, audio host behaviour, attribution).
- [ ] Open items: Deezer, Europeana, Musopen, HearThis.at, YouTube Data API quota and `videoLicense` need a reachable source before any verdict.
- [ ] If a provider is chosen, write an ADR (next is ADR-015) covering its terms position, the source interface, and the 80/20 weight model ([ADR-009](../decisions.md#wikimedia-commons-added-2026-11-18)).
