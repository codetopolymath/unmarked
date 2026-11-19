// How old the Archive partition map is. It only knows items uploaded before its build date, so an old map
// silently stops drawing new uploads. Shared by the in-app Sources page and the CI check.
const DAY_MS = 86400000

// About 30% of the music frame was uploaded in 2026, so a month-old map already misses a visible slice
export const STALE_AFTER_DAYS = 45

export function mapAge(builtAt, now = Date.now()) {
  const built = Date.parse(builtAt)
  if (!Number.isFinite(built)) return { days: null, stale: true, text: 'at an unknown date' }
  const days = Math.max(0, Math.floor((now - built) / DAY_MS))
  const text = days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`
  return { days, stale: days >= STALE_AFTER_DAYS, text }
}
