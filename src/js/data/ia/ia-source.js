// Real discovery pipeline: sample a rank, fetch the item, normalize it, verify it plays, then hand it over.
import { SourceUnreachable } from '../errors.js'
import { createClient } from './client.js'
import { FRAME_QUERY } from './frame.js'
import { normalizeItem } from './normalize.js'
import { createSampler } from './sampler.js'

const PREFIX = 'ia:'

export function createIaSource({
  map,
  client = createClient(),
  frame = FRAME_QUERY,
  random = Math.random,
  excluded = () => [],
  bufferSize = 2,
  maxAttempts = 10,
} = {}) {
  const sampler = createSampler({ map, random })
  // Prototype-panel hooks the mock also offers: force the next record, or make it fail
  const settings = { failNext: false, nextId: null }
  const seen = new Set()
  const cache = new Map()
  const buffer = []
  let filling = null

  async function fetchRecord(identifier, signal) {
    const record = normalizeItem(await client.metadata(identifier, { signal }))
    if (record) cache.set(record.id, record)
    return record
  }

  // One verified record, or null when this attempt landed on something unusable
  async function attempt({ signal, blocked, onSkip }) {
    const { docs } = await client.search({ ...sampler.next(frame), signal })
    const identifier = docs[0]?.identifier
    // Empty page means the map has drifted from the archive; just try another rank
    if (!identifier || blocked.has(PREFIX + identifier)) return null
    seen.add(PREFIX + identifier)

    const record = await fetchRecord(identifier, signal)
    if (!record) return null
    const probe = await client.probe(record.tracks[0].audio.url, { signal })
    if (!probe.ok) {
      onSkip?.(record)
      return null
    }
    return record
  }

  async function produce({ signal, current, onSkip } = {}) {
    const blocked = new Set([...excluded(), ...seen, ...buffer.map((r) => r.id)])
    if (current?.id) blocked.add(current.id)
    let failures = 0
    for (let n = 0; n < maxAttempts; n++) {
      try {
        const record = await attempt({ signal, blocked, onSkip })
        if (record) return record
      } catch (error) {
        if (error.name === 'AbortError') throw error
        // A dead network will not improve on the next rank
        if (++failures >= 3) throw new SourceUnreachable('The archive is not answering right now', { cause: error })
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

  async function draw({ signal, current, onSkip } = {}) {
    signal?.throwIfAborted()
    if (settings.failNext) {
      settings.failNext = false
      throw new SourceUnreachable()
    }
    if (settings.nextId) {
      const forced = await byId(settings.nextId)
      settings.nextId = null
      if (forced) return structuredClone(forced)
    }
    const ready = buffer.findIndex((r) => r.id !== current?.id && !excluded().includes(r.id))
    const record = ready >= 0 ? buffer.splice(ready, 1)[0] : await produce({ signal, current, onSkip })
    refill()
    return structuredClone(record)
  }

  async function byId(id) {
    if (cache.has(id)) return structuredClone(cache.get(id))
    if (!id.startsWith(PREFIX)) return null
    try {
      const record = await fetchRecord(id.slice(PREFIX.length))
      return record ? structuredClone(record) : null
    } catch {
      return null
    }
  }

  return { draw, byId, settings, all: () => [], total: sampler.total }
}
