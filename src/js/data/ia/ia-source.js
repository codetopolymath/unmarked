// Internet Archive discovery: sample a rank, fetch the item, normalize it, verify it plays.
import { createBufferedSource } from '../buffered-source.js'
import { createClient } from './client.js'
import { FRAME_QUERY } from './frame.js'
import { licenceFileName, parseLicenceTable, rightsFromTracks } from './jamendo.js'
import { downloadUrl, normalizeItem } from './normalize.js'
import { createSampler } from './sampler.js'
import { spokenReason } from './spoken.js'

const PREFIX = 'ia:'
const SEARCH_FIELDS = ['identifier', 'title', 'subject', 'collection']

export function createIaSource({
  map,
  client = createClient(),
  frame = FRAME_QUERY,
  random = Math.random,
  ...options
} = {}) {
  const sampler = createSampler({ map, random })

  // Jamendo mirrors keep their licence in License.txt; a failed read leaves it as "not stated"
  async function readJamendoLicence(identifier, reply, signal) {
    const file = licenceFileName(reply)
    if (!file) return null
    try {
      return rightsFromTracks(parseLicenceTable(await client.text(downloadUrl(identifier, file), { signal })))
    } catch (error) {
      if (error.name === 'AbortError') throw error
      return null
    }
  }

  async function fetchById(identifier, signal) {
    const reply = await client.metadata(identifier, { signal })
    const record = normalizeItem(reply)
    if (!record) return null
    const rights = await readJamendoLicence(identifier, reply, signal)
    if (rights) record.rights = record.rights.statement ? { ...rights, statement: record.rights.statement } : rights
    return record
  }

  async function attempt({ signal, blocked, remember, onSkip, onCandidate }) {
    // Title, subject and collection ride along so spoken word is rejected before any metadata fetch
    const { docs } = await client.search({ ...sampler.next(frame), fields: SEARCH_FIELDS, signal })
    const identifier = docs[0]?.identifier
    // Empty page means the map has drifted from the archive; just try another rank
    if (!identifier || blocked.has(PREFIX + identifier)) return null
    remember(PREFIX + identifier)
    if (spokenReason(docs[0])) return null

    const record = await fetchById(identifier, signal)
    if (!record) return null
    onCandidate(record)
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
