// Internet Archive discovery: sample a rank, fetch the item, normalize it, verify it plays.
import { createBufferedSource } from '../buffered-source.js'
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
  ...options
} = {}) {
  const sampler = createSampler({ map, random })

  async function fetchById(identifier, signal) {
    return normalizeItem(await client.metadata(identifier, { signal }))
  }

  async function attempt({ signal, blocked, remember, onSkip }) {
    const { docs } = await client.search({ ...sampler.next(frame), signal })
    const identifier = docs[0]?.identifier
    // Empty page means the map has drifted from the archive; just try another rank
    if (!identifier || blocked.has(PREFIX + identifier)) return null
    remember(PREFIX + identifier)

    const record = await fetchById(identifier, signal)
    if (!record) return null
    const probe = await client.probe(record.tracks[0].audio.url, { signal })
    if (!probe.ok) {
      onSkip?.(record)
      return null
    }
    return record
  }

  const source = createBufferedSource({
    prefix: PREFIX,
    label: 'The archive',
    attempt,
    fetchById: (identifier) => fetchById(identifier),
    ...options,
  })
  return { ...source, total: sampler.total }
}
