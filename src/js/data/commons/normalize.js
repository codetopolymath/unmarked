// Pure mapping from a Commons videoinfo page to the app's record model. No network, no DOM.
import { mapLicenceUrl } from '../licence.js'
import { firstText, htmlToText, yearOf } from '../text.js'

const SOURCE_ID = 'wikimedia-commons'
const MIN_SECONDS = 30
const MAX_NAME = 120
const MAX_CREDIT = 140
const MAX_DESCRIPTION = 2000

const withoutQuery = (url) => url?.split('?')[0]
const stripExtension = (name) => name.replace(/\.[^./]+$/, '')

const field = (info, key) => {
  const value = info.extmetadata?.[key]?.value
  return value == null ? undefined : htmlToText(value).replace(/\s+/g, ' ').trim() || undefined
}

const derivativeUrl = (info, type) => {
  const src = info.derivatives?.find((d) => d.type?.startsWith(type))?.src
  return src ? withoutQuery(src) : undefined
}

// Original when browsers can play it directly, otherwise the MP3 transcode Commons makes for WAV and FLAC.
// Fallbacks are the other small format: a transcode that stalls or 404s is common right after upload.
function pickAudio(info) {
  const original = withoutQuery(info.url)
  const isOgg = /ogg/.test(info.mime ?? '')
  const withFallbacks = (audio, urls) => {
    const fallbacks = urls.filter((url) => url && url !== audio.url)
    return fallbacks.length ? { ...audio, fallbacks } : audio
  }

  if (info.mime === 'audio/mpeg') {
    return withFallbacks({ url: original, format: 'mp3' }, [derivativeUrl(info, 'audio/ogg')])
  }
  const mp3 = derivativeUrl(info, 'audio/mpeg')
  if (mp3) {
    // An Ogg original is itself small; a WAV or FLAC one is not, so only the Ogg transcode backs those up
    return withFallbacks({ url: mp3, format: 'mp3' }, [isOgg ? original : derivativeUrl(info, 'audio/ogg')])
  }
  // Ogg plays in every engine but Safari; still better than skipping a record with no transcode
  if (isOgg) return { url: original, format: 'ogg' }
  return null
}

// Role labels seen in Commons "Artist" text; only composer and performer are surfaced, the rest just end a value
const ROLE_LABEL = new RegExp(
  '(?<![^\\s;])' +
    '(?<role>composition|composed by|composer|music by|music|text|words by|words|lyrics by|lyrics|libretto|' +
    'arrangement|arranged by|translation|translated by|conductor|performance|performed by|performers?|played by)' +
    '(?:(?<colon>\\s*:)|(?=\\s|$))',
  'gi',
)
const COMPOSER_ROLES = new Set(['composition', 'composed by', 'composer', 'music by', 'music'])
const PERFORMER_ROLES = new Set(['performance', 'performed by', 'performer', 'performers', 'played by'])
// "Music" and "Text" are ordinary words, so they only count as a label with their colon
const COLON_OPTIONAL = new Set([
  'composed by',
  'music by',
  'words by',
  'lyrics by',
  'performed by',
  'played by',
  'arranged by',
  'translated by',
])

// Returns { composer, performer } when the text is role-labelled, otherwise null
export function parseRoles(text) {
  if (!text) return null
  const marks = [...text.matchAll(ROLE_LABEL)].filter(
    (m) => m.groups.colon || COLON_OPTIONAL.has(m.groups.role.toLowerCase()),
  )
  if (!marks.length || marks[0].index !== 0) return null
  const roles = {}
  marks.forEach((mark, i) => {
    const end = marks[i + 1]?.index ?? text.length
    const value = text
      .slice(mark.index + mark[0].length, end)
      .replace(/\s+/g, ' ')
      .replace(/^[\s:,;-]+|[\s,;-]+$/g, '')
    const role = mark.groups.role.toLowerCase()
    const key = COMPOSER_ROLES.has(role) ? 'composer' : PERFORMER_ROLES.has(role) ? 'performer' : null
    if (key && value && value.length <= MAX_NAME && !roles[key]) roles[key] = value
  })
  return roles
}

function mapRights(info) {
  const url = firstText(info.extmetadata?.LicenseUrl?.value)
  const name = field(info, 'LicenseShortName')
  let rights
  if (url) rights = mapLicenceUrl(url)
  else if (/public domain|^pd\b/i.test(name ?? '')) {
    rights = { state: 'public_domain', short: 'Public domain', label: 'Public domain' }
  } else if (name) rights = { state: 'unknown', short: name, label: name }
  else rights = { state: 'unknown', short: 'Licence not stated', label: 'Licence not stated' }
  if (field(info, 'AttributionRequired') === 'true') rights.attribution_required = true
  const terms = field(info, 'UsageTerms')
  if (terms && rights.state === 'unknown') rights.statement = terms
  return rights
}

const MIME_LABELS = {
  'audio/wav': 'WAV',
  'audio/x-wav': 'WAV',
  'audio/wave': 'WAV',
  'audio/flac': 'FLAC',
  'audio/x-flac': 'FLAC',
  'application/ogg': 'Ogg',
  'audio/ogg': 'Ogg',
  'audio/mpeg': 'MP3',
}
const PLAYING_LABELS = { mp3: 'MP3', ogg: 'Ogg Vorbis' }

function audioFormatOf(info, audio) {
  const playing = PLAYING_LABELS[audio.format]
  if (!playing) return undefined
  const original = MIME_LABELS[info.mime]
  // An Ogg master that plays as itself is the same format under two names
  const same = !original || original === playing || (original === 'Ogg' && playing === 'Ogg Vorbis')
  return { playing, ...(!same && { original }) }
}

// Only a "from <institution>" file category says where a file was filed; other categories are topics
const PROVENANCE = /^Category:Audio files from (.+)$/

function collectionOf(page) {
  for (const { title } of page.categories ?? []) {
    const label = title?.match(PROVENANCE)?.[1]?.trim()
    if (label) return { id: title.replace(/^Category:/, ''), label }
  }
  return undefined
}

// Commons often re-hosts Internet Archive items; naming the original lets the sources dedupe
function mirrorOf(credit) {
  const match = credit?.match(/Internet Archive identifier:\s*([^\s,;]+)/i)
  return match ? `ia:${match[1]}` : undefined
}

// Returns null for anything the app should not show: not audio, too short, or no playable file
export function normalizeFile(page) {
  const info = page?.videoinfo?.[0]
  if (!page?.pageid || info?.mediatype !== 'AUDIO' || !(info.duration >= MIN_SECONDS)) return null
  const audio = pickAudio(info)
  if (!audio) return null

  const bare = page.title.replace(/^File:/, '')
  const title = field(info, 'ObjectName') || stripExtension(bare).replace(/_/g, ' ')
  const rawArtist = info.extmetadata?.Artist?.value == null ? undefined : htmlToText(info.extmetadata.Artist.value)
  const roles = parseRoles(rawArtist)
  const artist = roles ? roles.performer : field(info, 'Artist')
  const credit = field(info, 'Credit')
  const description = field(info, 'ImageDescription')
  const dated = info.extmetadata?.DateTimeOriginal?.value
  const year = yearOf(dated == null ? undefined : htmlToText(dated))
  const pageUrl = withoutQuery(info.descriptionurl) ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(bare)}`

  const record = {
    id: `commons:${page.pageid}`,
    kind: 'recording',
    title,
    // A long "Artist" is a licence blurb or credit line, not a name
    artists: artist && artist.length <= MAX_NAME ? [{ name: artist }] : [],
    dates: year ? { year } : {},
    tracks: [{ index: 0, title, duration_s: Math.round(info.duration), audio }],
    rights: mapRights(info),
    links: {},
    source: { id: SOURCE_ID, name: 'Wikimedia Commons', url: pageUrl, item_id: bare },
    availability: { status: 'ok' },
  }
  if (description) record.description = description.slice(0, MAX_DESCRIPTION)
  const credits = {}
  if (credit && credit.length <= MAX_CREDIT) credits.publisher = credit
  if (roles?.composer) credits.composer = roles.composer
  if (roles?.performer) credits.performer = roles.performer
  if (Object.keys(credits).length) record.credits = credits
  const collection = collectionOf(page)
  if (collection) record.collection = collection
  const audioFormat = audioFormatOf(info, audio)
  if (audioFormat) record.audioFormat = audioFormat
  const duplicateOf = mirrorOf(credit)
  if (duplicateOf) record.duplicateOf = duplicateOf
  return record
}
