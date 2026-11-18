// Wikimedia Commons discovery: one random search returns a handful of candidates, each verified before it is shown.
import { createBufferedSource } from '../buffered-source.js'
import { createCommonsClient } from './client.js'
import { normalizeFile } from './normalize.js'

const PREFIX = 'commons:'
const CANDIDATES_PER_CALL = 5

export function createCommonsSource({ client = createCommonsClient(), ...options } = {}) {
  // Candidates already fetched but not yet tried; one search call serves several draws
  const queue = []

  async function attempt({ signal, blocked, remember, onSkip }) {
    if (!queue.length) queue.push(...(await client.random({ count: CANDIDATES_PER_CALL, signal })))
    const page = queue.shift()
    if (!page || blocked.has(PREFIX + page.pageid)) return null
    remember(PREFIX + page.pageid)

    const record = normalizeFile(page)
    // The same recording already seen through the Archive counts as seen
    if (!record || (record.duplicateOf && blocked.has(record.duplicateOf))) return null
    const probe = await client.probe(record.tracks[0].audio.url, { signal })
    if (!probe.ok) {
      onSkip?.(record)
      return null
    }
    return record
  }

  async function fetchById(pageId) {
    return normalizeFile(await client.byPageId(pageId))
  }

  return createBufferedSource({ prefix: PREFIX, label: 'Wikimedia Commons', attempt, fetchById, ...options })
}
