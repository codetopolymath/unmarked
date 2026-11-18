// The live app's single source: every draw comes from the Internet Archive or Wikimedia Commons.
import { SourceUnreachable } from './errors.js'
import { createCommonsSource } from './commons/commons-source.js'
import { createIaSource } from './ia/ia-source.js'

// Share of draws that try each source first. Weighted so Commons (~40k files) is seen despite the
// Archive's ~930k; the other source is the fallback when one is down.
export const DEFAULT_WEIGHTS = { ia: 0.8, commons: 0.2 }

// parts: [{ name, prefix, weight, source }]
export function createCombinedSource({ parts, random = Math.random }) {
  const settings = { failNext: false, nextId: null }

  // Weighted first choice, then the rest from heaviest down
  function order() {
    let roll = random() * parts.reduce((sum, part) => sum + part.weight, 0)
    const first = parts.find((part) => (roll -= part.weight) < 0) ?? parts[0]
    return [first, ...parts.filter((part) => part !== first).sort((a, b) => b.weight - a.weight)]
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
export function createLiveSource({ map, excluded, onCandidate, weights = DEFAULT_WEIGHTS, random = Math.random }) {
  const parts = [
    {
      name: 'commons',
      prefix: 'commons:',
      weight: weights.commons,
      source: createCommonsSource({ excluded, onCandidate }),
    },
  ]
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
