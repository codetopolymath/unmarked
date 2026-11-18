import { RECORDS } from './mock-records.js'
import { wait } from '../core/motion.js'
import { SourceUnreachable } from './errors.js'

export { SourceUnreachable }

// Stand-in for the real discovery pipeline: draw, validate, return one record
export function createMockSource({ records = RECORDS, random = Math.random } = {}) {
  const seen = new Set()
  const settings = { latencyMs: 1300, failNext: false, nextId: null }

  const byId = (id) => records.find((r) => r.id === id) ?? null

  async function draw({ signal, current, onSkip } = {}) {
    await wait(settings.latencyMs * (0.7 + random() * 0.6), signal)

    if (settings.failNext) {
      settings.failNext = false
      throw new SourceUnreachable()
    }
    if (settings.nextId) {
      const forced = byId(settings.nextId)
      settings.nextId = null
      if (forced) return structuredClone(forced)
    }

    for (let attempt = 0; attempt < 6; attempt++) {
      let pool = records.filter((r) => !seen.has(r.id) && r.id !== current?.id)
      if (!pool.length) {
        seen.clear()
        pool = records.filter((r) => r.id !== current?.id)
      }
      const pick = pool[Math.floor(random() * pool.length)]
      seen.add(pick.id)
      if (pick.availability.status === 'unavailable') {
        onSkip?.(pick)
        await wait(260, signal)
        continue
      }
      return structuredClone(pick)
    }
    throw new SourceUnreachable()
  }

  return { draw, byId, settings, all: () => records }
}
