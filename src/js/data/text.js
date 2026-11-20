// Text helpers for messy upstream metadata. Pure, no DOM, so they run in Node tests too.
export const asList = (value) => (value == null ? [] : Array.isArray(value) ? value : [value])

export const firstText = (value) => {
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

const plausible = (year) => (year >= 1850 && year <= new Date().getUTCFullYear() ? year : undefined)

// Dates stored without separators ("19270614") also occur
const YEAR = /\b(\d{4})\b|\b(\d{4})(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\b/
const yearIn = (text) => {
  const match = text.match(YEAR)
  return match ? plausible(Number(match[1] ?? match[2])) : undefined
}

const LABEL_BREAK = /\n|;|(?=\b(?:composition|performance|recording|recorded|uploaded?)\b[^\n\d]{0,12}:)/i
const PERFORMED = /\b(?:performance|performed|recording|recorded)\b/i
const NOT_PERFORMED = /\b(?:composition|composed|written|text|words|lyrics)\b\s*:/i
const UPLOAD = /\bupload/i

// First plausible four-digit year in a free-form date; recorded music starts around 1850.
// Commons dates may carry labels: the performance year wins, composition and upload dates are never the answer.
export function yearOf(value) {
  for (const text of asList(value)) {
    if (typeof text !== 'string') continue
    const segments = text
      .split(LABEL_BREAK)
      .map((s) => s.replace(/[^\n]*?\([^)]*\bupload[^)]*\)/gi, '').trim())
      .filter((s) => s && !UPLOAD.test(s))
    const labelled = segments
      .filter((s) => PERFORMED.test(s))
      .map(yearIn)
      .find(Boolean)
    if (labelled) return labelled
    const year = segments
      .filter((s) => !NOT_PERFORMED.test(s))
      .map(yearIn)
      .find(Boolean)
    if (year) return year
  }
  return undefined
}

const LANGUAGE_CODE = /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i
let displayNames
const languageName = (code) => {
  try {
    displayNames ??= new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' })
    return displayNames.of(code)
  } catch {
    return undefined
  }
}

// ISO 639 codes become readable names; anything else stays as the source wrote it
export function languageNames(value) {
  const names = asList(value)
    .filter((v) => typeof v === 'string')
    .flatMap((v) => v.split(/\s*[;,]\s*/))
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => (LANGUAGE_CODE.test(v) ? (languageName(v.toLowerCase()) ?? v) : v))
  const seen = new Set()
  return names.filter((name) => !seen.has(name.toLowerCase()) && seen.add(name.toLowerCase()))
}
