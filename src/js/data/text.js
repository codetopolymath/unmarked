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

// First plausible four-digit year in a free-form date; recorded music starts around 1850
export function yearOf(value) {
  const match = firstText(value)?.match(/\b(\d{4})\b/)
  const year = match ? Number(match[1]) : NaN
  return year >= 1850 && year <= new Date().getUTCFullYear() ? year : undefined
}
