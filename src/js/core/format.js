// Pure presentation helpers. Every function returns nothing for a missing value so callers never render empty labels.

const countFormat = new Intl.NumberFormat('en')

export const formatCount = (n) => countFormat.format(n)
export const pad = (n, width = 2) => String(n).padStart(width, '0')
export const accession = (n) => pad(n, 6)

export function formatTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return ''
  const s = Math.floor(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

export function titleLength(title) {
  const n = [...title].length
  if (n <= 22) return 'short'
  return n <= 48 ? 'medium' : 'long'
}

export function displayTitle(record) {
  return record.title?.trim() || record.tracks?.[0]?.title?.trim() || 'Untitled recording'
}

export function displayArtist(record) {
  const names = (record.artists ?? []).map((a) => a.name?.trim()).filter(Boolean)
  return names.length ? names.join(', ') : null
}

export function trackTitle(track, index) {
  return track.title?.trim() || `Track ${index + 1}`
}

export function originOf(record) {
  const text = [record.place?.region, record.place?.country].filter(Boolean).join(', ')
  return text || null
}

function totalRuntime(tracks) {
  if (!tracks.length || tracks.some((t) => !Number.isFinite(t.duration_s))) return null
  const minutes = Math.round(tracks.reduce((sum, t) => sum + t.duration_s, 0) / 60)
  return minutes >= 90 ? `${Math.floor(minutes / 60)} h ${pad(minutes % 60)} min` : `${minutes} min`
}

// Compact line under the artist; each fact appears only when the record states it
export function factsFor(record) {
  const dates = record.dates ?? {}
  const year = dates.year ?? dates.release_date?.slice(0, 4)
  const facts = []
  if (record.kind === 'recording' && dates.recording_date)
    facts.push({ key: 'recorded', text: `Recorded ${dates.recording_date}` })
  else if (year) facts.push({ key: 'year', text: String(year) })
  const origin = originOf(record)
  if (origin) facts.push({ key: 'origin', text: origin })
  const count = record.tracks.length
  if (record.kind === 'album') facts.push({ key: 'tracks', text: `${count} track${count === 1 ? '' : 's'}` })
  else {
    const duration = formatTime(record.tracks[0]?.duration_s)
    if (duration) facts.push({ key: 'duration', text: duration })
  }
  return facts
}

const TERM_TEXT = {
  BY: 'Credit the creator',
  NC: 'Non-commercial use only',
  ND: 'No derivative works',
  SA: 'Share alike',
}

export function attributionText(record) {
  const rights = record.rights
  if (rights.attribution_text) return rights.attribution_text
  const artist = displayArtist(record)
  const parts = [`“${displayTitle(record)}”`]
  if (artist) parts.push(`by ${artist}`)
  parts.push(`via ${record.source.name}`)
  if (rights.short) parts.push(`(${rights.short})`)
  return parts.join(' ')
}

const sameName = (a, b) => a?.trim().toLowerCase() === b?.trim().toLowerCase()

export function audioText(audioFormat) {
  const playing = audioFormat?.playing?.trim()
  if (!playing) return null
  const original = audioFormat.original?.trim()
  return original && !sameName(original, playing) ? `Playing ${playing} · original ${original}` : playing
}

// Sections for the details sheet. Rows exist only when there is something to say.
export function detailSections(record) {
  const dates = record.dates ?? {}
  const sections = []
  const artist = displayArtist(record)
  const performer = record.credits?.performer
  // Shown under the title already; repeating it adds nothing
  const performedBy = performer && !sameName(performer, artist) ? performer : null

  const about = []
  if (record.description) about.push({ kind: 'prose', value: record.description })
  if (record.tags?.length) about.push({ label: 'Source tags', value: record.tags.join(', ') })
  if (about.length) sections.push({ id: 'about', heading: 'About', rows: about })

  const facts = [
    ['Recorded', dates.recording_date],
    ['Released', dates.release_date ?? dates.year],
    ['Origin', originOf(record)],
    ['Language', record.language?.join(', ')],
    ['Composed by', record.credits?.composer],
    ['Performed by', performedBy],
    ['Label', record.credits?.label],
    ['Publisher', record.credits?.publisher],
    ['Audio', audioText(record.audioFormat)],
    ['Runtime', totalRuntime(record.tracks)],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => ({ label, value: String(value) }))
  if (facts.length) sections.push({ id: 'record', heading: 'Record', rows: facts })

  const source = [{ label: 'Found on', value: record.source.name, href: record.source.url }]
  if (record.collection?.label) source.push({ label: 'Collection', value: record.collection.label })
  if (record.source.item_id) source.push({ label: 'Item', value: record.source.item_id, mono: true })
  if (record.links?.original_url)
    source.push({ label: 'Originally', value: 'Original publication', href: record.links.original_url })
  sections.push({ id: 'source', heading: 'Source', rows: source })

  const rights = record.rights
  const rows = [{ label: 'Status', value: rights.label, href: rights.licence_url }]
  if (rights.terms?.length)
    rows.push({
      label: 'Terms',
      value: rights.terms
        .map((t) => TERM_TEXT[t])
        .filter(Boolean)
        .join('; '),
    })
  if (rights.statement) rows.push({ label: 'Statement', value: rights.statement })
  if (rights.attribution_required) rows.push({ kind: 'credit', value: attributionText(record) })
  rows.push({ kind: 'fineprint', value: 'Streaming here is not a licence to reuse this recording.' })
  sections.push({ id: 'rights', heading: 'Rights', rows })

  return sections
}

const dayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function dayLabel(timestamp, now = Date.now()) {
  const day = (t) => new Date(t).setHours(0, 0, 0, 0)
  const diff = Math.round((day(now) - day(timestamp)) / 86400000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return dayFormat.format(timestamp)
}
