// The live app's single source: every draw comes from the Internet Archive, Wikimedia Commons or Audius.
import { SourceUnreachable } from './errors.js'
import { createAudiusSource } from './audius/audius-source.js'
import { createCommonsSource } from './commons/commons-source.js'
import { createIaSource } from './ia/ia-source.js'

// Share of draws that try each source first. Weighted so Commons (~40k files) is seen despite the
// Archive's ~930k; the other source is the fallback when one is down.
export const DEFAULT_WEIGHTS = { ia: 0.8, commons: 0.2 }

// Weights are relative, so adding Audius keeps the Archive-to-Commons ratio and gives Audius 20% of draws
export const AUDIUS_WEIGHT = 0.25

// parts: [{ name, prefix, weight, source, enabled? }]; enabled() === false keeps a part out of every draw
export function createCombinedSource({ parts, random = Math.random }) {
  const settings = { failNext: false, nextId: null }

  // Weighted first choice, then the rest from heaviest down
  function order() {
    const active = parts.filter((part) => part.enabled?.() !== false)
    const pool = active.length ? active : parts
    let roll = random() * pool.reduce((sum, part) => sum + part.weight, 0)
    const first = pool.find((part) => (roll -= part.weight) < 0) ?? pool[0]
    return [first, ...pool.filter((part) => part !== first).sort((a, b) => b.weight - a.weight)]
  }

  async function byId(id) {
    const owner = parts.find((part) => id.startsWith(part.prefix))
    return owner ? owner.source.byId(id) : null
  }

  async function draw(options = {}) {
    options.signal?.throwIfAborted()
    if (settings.failNext) {
      settings.failNext = false
      throw new SourceUnreachable()
    }
    if (settings.nextId) {
      const forced = await byId(settings.nextId)
      settings.nextId = null
      if (forced) return forced
    }
    let failure
    for (const part of order()) {
      try {
        return await part.source.draw(options)
      } catch (error) {
        if (error.name === 'AbortError') throw error
        failure = error
      }
    }
    throw failure
  }

  return {
    draw,
    byId,
    settings,
    all: () => [],
    parts: Object.fromEntries(parts.map((part) => [part.name, part.source])),
  }
}

// Without the partition map the Archive cannot be sampled, so Commons carries the draw alone
// audiusEnabled: omit to leave Audius out; pass a function to let the listener switch it on and off
export function createLiveSource({
  map,
  excluded,
  onCandidate,
  weights = DEFAULT_WEIGHTS,
  random = Math.random,
  audiusEnabled,
  audiusSource,
}) {
  const parts = [
    {
      name: 'commons',
      prefix: 'commons:',
      weight: weights.commons,
      source: createCommonsSource({ excluded, onCandidate }),
    },
  ]
  if (audiusEnabled) {
    parts.push({
      name: 'audius',
      prefix: 'audius:',
      weight: weights.audius ?? AUDIUS_WEIGHT,
      enabled: audiusEnabled,
      source: audiusSource ?? createAudiusSource({ excluded, onCandidate }),
    })
  }
  if (map) {
    parts.unshift({
      name: 'ia',
      prefix: 'ia:',
      weight: weights.ia,
      source: createIaSource({ map, excluded, onCandidate, random }),
    })
  }
  return createCombinedSource({ random, parts })
}
