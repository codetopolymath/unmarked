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
  const artist = field(info, 'Artist')
  const credit = field(info, 'Credit')
  const description = field(info, 'ImageDescription')
  const year = yearOf(field(info, 'DateTimeOriginal'))
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
  if (credit && credit.length <= MAX_CREDIT) record.credits = { publisher: credit }
  const duplicateOf = mirrorOf(credit)
  if (duplicateOf) record.duplicateOf = duplicateOf
  return record
}
