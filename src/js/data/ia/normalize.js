// Pure mapping from an archive.org /metadata reply to the app's record model. No network, no DOM.
const SOURCE_NAME = 'Internet Archive'
const DETAILS_URL = 'https://archive.org/details/'
const DOWNLOAD_URL = 'https://archive.org/download/'

// Browser-playable formats, best first; everything else (WAV, FLAC, thumbnails) is skipped
const FORMAT_RANK = [/mp3/i, /ogg vorbis/i, /m4a|aac|mpeg4/i]

const asList = (value) => (value == null ? [] : Array.isArray(value) ? value : [value])
const firstText = (value) => {
  const text = asList(value).find((v) => typeof v === 'string' && v.trim())
  return text?.trim()
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export function htmlToText(html) {
  return String(html)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
      if (code[0] === '#') {
        const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
        return Number.isFinite(point) && point > 0 && point < 0x110000 ? String.fromCodePoint(point) : match
      }
      return ENTITIES[code.toLowerCase()] ?? match
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

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

// Track-numbered PNGs are spectrograms, so only files named like a cover count
const COVER_NAME = /(^|[^a-z])(cover|front|folder|artwork|album)([^a-z]|$)/i

// Falls back to the archive's own thumbnail; the image loader handles a missing one
export function pickCover(identifier, files = []) {
  const cover = files.find((f) => /^(JPEG|PNG)$/i.test(f.format ?? '') && COVER_NAME.test(f.name))
  const name = cover ? encodePath(cover.name) : '__ia_thumb.jpg'
  return `${DOWNLOAD_URL}${encodeURIComponent(identifier)}/${name}`
}

const CC_NAMES = { by: 'Attribution', nc: 'NonCommercial', nd: 'NoDerivs', sa: 'ShareAlike' }

function mapLicence(url) {
  const link = url.replace(/^http:/, 'https:')
  const cc = link.match(/creativecommons\.org\/licenses\/([a-z-]+)\/(\d\.\d)/i)
  if (cc) {
    const terms = cc[1].toUpperCase().split('-')
    return {
      state: 'licensed',
      short: `CC ${terms.join('-')} ${cc[2]}`,
      label: `Creative Commons ${cc[1]
        .toLowerCase()
        .split('-')
        .map((t) => CC_NAMES[t] ?? t)
        .join('-')} ${cc[2]}`,
      terms,
      licence_url: link,
      attribution_required: terms.includes('BY'),
    }
  }
  if (/creativecommons\.org\/publicdomain\/zero/i.test(link)) {
    return { state: 'public_domain', short: 'CC0 1.0', label: 'CC0 1.0 Universal', licence_url: link }
  }
  if (/creativecommons\.org\/publicdomain\/mark/i.test(link)) {
    return { state: 'public_domain', short: 'Public domain', label: 'Public domain mark', licence_url: link }
  }
  return { state: 'unknown', short: 'Licence not recognised', label: 'Licence not recognised', licence_url: link }
}

// Absent fields mean "not stated"; never guess a licence
export function mapRights(metadata) {
  const url = firstText(metadata.licenseurl)
  const statement = firstText(metadata.rights)
  let rights
  if (url) rights = mapLicence(url)
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

function yearOf(value) {
  const match = firstText(value)?.match(/\b(\d{4})\b/)
  const year = match ? Number(match[1]) : NaN
  return year >= 1850 && year <= new Date().getUTCFullYear() ? year : undefined
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
