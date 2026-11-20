// Audius discovery: the "Feeling Lucky" endpoint hands out random tracks, each verified before it is shown.
import { createBufferedSource } from '../buffered-source.js'
import { AUDIUS_CONFIG } from './config.js'
import { createAudiusClient } from './client.js'
import { normalizeTrack } from './normalize.js'

const PREFIX = 'audius:'
const CANDIDATES_PER_CALL = 20

export function createAudiusSource({ client = createAudiusClient(AUDIUS_CONFIG), ...options } = {}) {
  // Tracks fetched but not yet tried; one call serves several draws
  const queue = []

  async function attempt({ signal, blocked, remember, onSkip, onCandidate }) {
    if (!queue.length) queue.push(...(await client.lucky({ count: CANDIDATES_PER_CALL, signal })))
    const track = queue.shift()
    if (!track || blocked.has(PREFIX + track.id)) return null
    remember(PREFIX + track.id)

    const record = normalizeTrack(track, { streamUrl: client.streamUrl })
    if (!record) return null
    onCandidate(record)
    const probe = await client.probe(record.tracks[0].audio.url, { signal })
    if (!probe.ok) {
      onSkip?.(record)
      return null
    }
    return record
  }

  async function fetchById(id) {
    const track = await client.byId(id)
    return track ? normalizeTrack(track, { streamUrl: client.streamUrl }) : null
  }

  return createBufferedSource({ prefix: PREFIX, label: 'Audius', attempt, fetchById, ...options })
}
