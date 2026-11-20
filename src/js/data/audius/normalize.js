// Pure mapping from an Audius track to the app's record model. No network, no DOM.
import { yearOf } from '../text.js'

const SITE = 'https://audius.co'
const MIN_SECONDS = 30
const MAX_DESCRIPTION = 2000

const isHttps = (url) => typeof url === 'string' && url.startsWith('https://')

// Licences are free text chosen by the artist; most are "All rights reserved" or absent
export function mapRights(license) {
  const text = typeof license === 'string' ? license.trim() : ''
  if (!text) return { state: 'unknown', short: 'Licence not stated', label: 'Licence not stated' }
  if (/^all rights reserved$/i.test(text)) {
    return { state: 'all_rights_reserved', short: 'All rights reserved', label: 'All rights reserved' }
  }
  // "Attribution-NonCommercial CC BY-NC": Audius gives no version, so no licence url is claimed
  const cc = text.match(/\bCC ((?:BY|NC|ND|SA)(?:-(?:BY|NC|ND|SA))*)\s*$/i)
  if (cc) {
    const terms = cc[1].toUpperCase().split('-')
    return {
      state: 'licensed',
      short: `CC ${terms.join('-')}`,
      label: text,
      terms,
      attribution_required: terms.includes('BY'),
    }
  }
  return { state: 'unknown', short: text, label: text }
}

// Gated, hidden or key-restricted tracks cannot stream anonymously
function isPlayable(track) {
  return Boolean(
    track?.id &&
    track.is_streamable &&
    track.access?.stream !== false &&
    !track.is_stream_gated &&
    !track.stream_conditions &&
    !track.is_unlisted &&
    !track.is_delete &&
    track.is_available !== false &&
    !track.allowed_api_keys?.length &&
    track.duration >= MIN_SECONDS,
  )
}

// Returns null for anything the app should not show or cannot link back to
export function normalizeTrack(track, { streamUrl }) {
  if (!isPlayable(track)) return null
  const title = typeof track.title === 'string' ? track.title.trim() : ''
  if (!title || !/^\/[^/\s]\S*$/.test(track.permalink ?? '')) return null

  const audio = { url: streamUrl(track.id), format: 'mp3' }
  // The pre-signed node url lapses, so it only backs up the API route
  if (isHttps(track.stream?.url)) audio.fallbacks = [track.stream.url]

  const artist = (track.user?.name || track.user?.handle || '').trim()
  const art = [track.artwork?.['480x480'], track.artwork?.['1000x1000']].find(isHttps)
  const year = yearOf(track.release_date)
  const description = typeof track.description === 'string' ? track.description.trim() : ''

  const record = {
    id: `audius:${track.id}`,
    kind: 'recording',
    title,
    artists: artist ? [{ name: artist }] : [],
    dates: year ? { year } : {},
    tracks: [{ index: 0, title, duration_s: Math.round(track.duration), audio }],
    rights: mapRights(track.license),
    links: {},
    source: { id: 'audius', name: 'Audius', url: SITE + track.permalink, item_id: String(track.id) },
    availability: { status: 'ok' },
    audioFormat: { playing: 'MP3' },
  }
  if (art) record.artwork = { origin: 'source', url: art }
  if (description) record.description = description.slice(0, MAX_DESCRIPTION)
  return record
}
