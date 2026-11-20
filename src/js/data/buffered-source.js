// Draw loop shared by every remote source: exclusion, retry budget, background buffer, by-id cache.
// A source supplies only `attempt` (try one candidate) and `fetchById`.
import { SourceUnreachable } from './errors.js'

export function createBufferedSource({
  prefix,
  label,
  attempt,
  fetchById,
  excluded = () => [],
  onCandidate = () => {},
  bufferSize = 2,
  maxAttempts = 10,
  maxFailures = 3,
}) {
  // Prototype-panel hooks the mock also offers: force the next record, or make it fail
  const settings = { failNext: false, nextId: null }
  const seen = new Set()
  const cache = new Map()
  const buffer = []
  let filling = null

  // Told about a candidate before its audio is verified, so slow work (loading the cover) overlaps the probe.
  // A hint must never break or delay a draw.
  const warm = (record) => {
    try {
      Promise.resolve(onCandidate(record)).catch(() => {})
    } catch {
      // Ignored on purpose
    }
  }

  // One verified record, or SourceUnreachable once the budget is spent
  async function produce({ signal, current, onSkip, onAttempt } = {}) {
    const blocked = new Set([...excluded(), ...seen, ...buffer.map((record) => record.id)])
    if (current?.id) blocked.add(current.id)
    const remember = (id) => seen.add(id)
    let failures = 0
    for (let n = 0; n < maxAttempts; n++) {
      try {
        const record = await attempt({ signal, blocked, remember, onSkip, onAttempt, onCandidate: warm })
        if (record) {
          cache.set(record.id, record)
          return record
        }
      } catch (error) {
        if (error.name === 'AbortError') throw error
        // A dead network will not improve on the next candidate
        if (++failures >= maxFailures) {
          throw new SourceUnreachable(`${label} is not answering right now`, { cause: error })
        }
      }
    }
    throw new SourceUnreachable('Could not find a playable record. Try again.')
  }

  // Keeps a couple of verified records ready so Discover feels instant; never blocks a draw
  function refill() {
    if (filling || buffer.length >= bufferSize) return
    filling = (async () => {
      try {
        while (buffer.length < bufferSize) buffer.push(await produce())
      } catch {
        // The next draw will surface a real failure; background misses stay quiet
      } finally {
        filling = null
      }
    })()
  }

  async function byId(id) {
    if (cache.has(id)) return structuredClone(cache.get(id))
    if (!id.startsWith(prefix)) return null
    try {
      const record = await fetchById(id.slice(prefix.length))
      if (!record) return null
      cache.set(record.id, record)
      return structuredClone(record)
    } catch {
      return null
    }
  }

  async function draw({ signal, current, onSkip, onAttempt } = {}) {
    signal?.throwIfAborted()
    if (settings.failNext) {
      settings.failNext = false
      throw new SourceUnreachable()
    }
    if (settings.nextId) {
      const forced = await byId(settings.nextId)
      settings.nextId = null
      if (forced) return forced
    }
    const ready = buffer.findIndex((record) => record.id !== current?.id && !excluded().includes(record.id))
    const record = ready >= 0 ? buffer.splice(ready, 1)[0] : await produce({ signal, current, onSkip, onAttempt })
    refill()
    return structuredClone(record)
  }

  return { draw, byId, settings, all: () => [] }
}
