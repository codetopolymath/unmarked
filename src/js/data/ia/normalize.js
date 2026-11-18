// Pure mapping from an archive.org /metadata reply to the app's record model. No network, no DOM.
import { mapLicenceUrl } from '../licence.js'
import { asList, firstText, htmlToText, yearOf } from '../text.js'

const SOURCE_NAME = 'Internet Archive'
const DETAILS_URL = 'https://archive.org/details/'
const DOWNLOAD_URL = 'https://archive.org/download/'

// Browser-playable formats, best first; everything else (WAV, FLAC, thumbnails) is skipped
const FORMAT_RANK = [/mp3/i, /ogg vorbis/i, /m4a|aac|mpeg4/i]

export { htmlToText }

// "218.31", "03:00" and "1:02:03" all occur in the same collections
export function parseDuration(value) {
  const text = firstText(value)
  if (!text) return undefined
  const parts = text.split(':').map(Number)
  if (parts.length > 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) return undefined
  const seconds = parts.reduce((total, n) => total * 60 + n, 0)
  return seconds > 0 ? Math.round(seconds * 100) / 100 : undefined
}

const stem = (name) => name.replace(/\.[^./]+$/, '')

function formatRank(file) {
  const index = FORMAT_RANK.findIndex((pattern) => pattern.test(file.format ?? ''))
  return index === -1 ? Infinity : index
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/')
}

// One entry per recording: the original and its derivatives collapse to the best playable file
export function pickTracks(identifier, files = []) {
  const groups = new Map()
  for (const file of files) {
    if (formatRank(file) === Infinity) continue
    const root =
      file.source === 'derivative' && file.original ? stem(firstText(file.original) ?? file.name) : stem(file.name)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(file)
  }

  const tracks = [...groups.entries()].map(([root, group]) => {
    const best = [...group].sort((a, b) => formatRank(a) - formatRank(b))[0]
    const withNumber = group.find((f) => Number.parseInt(firstText(f.track) ?? '', 10) > 0)
    const titled = group.find((f) => firstText(f.title))
    return {
      root,
      number: withNumber ? Number.parseInt(firstText(withNumber.track), 10) : undefined,
      title: firstText(titled?.title) ?? undefined,
      artist: firstText(titled?.artist ?? best.artist),
      duration_s: parseDuration(best.length),
      audio: { url: DOWNLOAD_URL + encodeURIComponent(identifier) + '/' + encodePath(best.name), format: best.format },
    }
  })

  const numbered = tracks.some((t) => t.number != null)
  tracks.sort((a, b) => {
    if (numbered && a.number !== b.number) return (a.number ?? Infinity) - (b.number ?? Infinity)
    return a.root.localeCompare(b.root, undefined, { numeric: true })
  })
  return tracks.map(({ root: _root, number: _number, ...track }, index) => ({ index, ...track }))
}

// Excludes the archive's own "Item Tile" and "JPEG Thumb" derivatives
const IMAGE_FORMAT = /^(JPEG|PNG|GIF)$/i
const FRONT_NAME = /(^|[^a-z])(cover|front|folder|artwork|album)([^a-z]|$)/i
const OTHER_SIDE = /(^|[^a-z])(back|rear|inlay|inside|booklet|tray|spine)([^a-z]|$)/i
// Spectrogram PNGs are small; a photo-sized JPEG is almost always artwork
const MIN_PHOTO_BYTES = 15000

function coverScore(identifier, file) {
  if (!IMAGE_FORMAT.test(file.format ?? '')) return -Infinity
  const bytes = Number(file.size) || 0
  const named = FRONT_NAME.test(file.name)
  // An image named after the item is its own scan (78 rpm labels, for instance)
  const own = stem(file.name) === identifier
  if (!named && !own && !(/^JPEG$/i.test(file.format) && bytes >= MIN_PHOTO_BYTES)) return -Infinity
  return (named ? 4 : 0) + (own ? 3 : 0) - (OTHER_SIDE.test(file.name) ? 5 : 0) + Math.min(bytes / 1e6, 1)
}

// Falls back to the archive's thumbnail; the image loader rejects a missing or non-square one
export function pickCover(identifier, files = []) {
  let best = null
  let bestScore = 0
  for (const file of files) {
    const score = coverScore(identifier, file)
    if (score > bestScore) [best, bestScore] = [file, score]
  }
  const name = best ? encodePath(best.name) : '__ia_thumb.jpg'
  return `${DOWNLOAD_URL}${encodeURIComponent(identifier)}/${name}`
}

// Absent fields mean "not stated"; never guess a licence
export function mapRights(metadata) {
  const url = firstText(metadata.licenseurl)
  const statement = firstText(metadata.rights)
  let rights
  if (url) rights = mapLicenceUrl(url)
  else {
    const status = firstText(metadata['possible-copyright-status'])?.toUpperCase()
    if (status === 'NOT_IN_COPYRIGHT') {
      rights = { state: 'public_domain', short: 'Not in copyright', label: 'Marked as not in copyright' }
    } else if (status === 'IN_COPYRIGHT') {
      rights = { state: 'all_rights_reserved', short: 'In copyright', label: 'Marked as in copyright' }
    } else rights = { state: 'unknown', short: 'Licence not stated', label: 'Licence not stated' }
  }
  if (String(firstText(metadata['access-restricted-item'])).toLowerCase() === 'true') {
    rights = {
      ...rights,
      state: 'restricted',
      short: 'Restricted',
      label: 'Restricted by the source',
    }
  }
  if (statement) rights.statement = htmlToText(statement)
  return rights
}

function splitTags(subject) {
  return asList(subject)
    .flatMap((value) => (typeof value === 'string' ? value.split(/\s*;\s*/) : []))
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12)
}

// Returns null when the item has nothing the app can play
export function normalizeItem(reply) {
  const metadata = reply?.metadata
  if (!metadata?.identifier) return null
  const { identifier } = metadata

  const tracks = pickTracks(identifier, reply.files)
  if (!tracks.length) return null

  const titles = new Set(tracks.map((t) => (t.title ?? t.audio.url).toLowerCase()))
  const artists = asList(metadata.creator)
    .filter((name) => typeof name === 'string' && name.trim())
    .map((name) => ({ name: name.trim() }))
  if (!artists.length) {
    const fromTracks = [...new Set(tracks.map((t) => t.artist).filter(Boolean))]
    for (const name of fromTracks.slice(0, 3)) artists.push({ name })
  }

  const year = yearOf(metadata.date)
  const record = {
    id: `ia:${identifier}`,
    // Two or more songs read as an album so every track stays reachable in the list
    kind: titles.size >= 2 ? 'album' : 'recording',
    title: firstText(metadata.title) ?? undefined,
    artists,
    artwork: { origin: 'source', url: pickCover(identifier, reply.files) },
    dates: year ? { year } : {},
    language: asList(metadata.language).filter((l) => typeof l === 'string'),
    description: metadata.description ? htmlToText(asList(metadata.description).join('\n\n')) : undefined,
    tags: splitTags(metadata.subject),
    tracks: tracks.map(({ artist: _artist, ...track }) => track),
    rights: mapRights(metadata),
    links: {},
    source: {
      id: 'internet-archive',
      name: SOURCE_NAME,
      url: DETAILS_URL + encodeURIComponent(identifier),
      item_id: identifier,
    },
    availability: { status: 'ok' },
  }
  const region = firstText(metadata.coverage)
  if (region) record.place = { region }
  const label = firstText(metadata.publisher)
  if (label) record.credits = { publisher: label }
  const original = firstText(metadata.source)
  if (original && /^https?:\/\//i.test(original)) record.links.original_url = original
  return record
}
