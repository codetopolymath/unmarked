// Rebuilds src/data/ia-map.json: counts of music-frame items per publicdate window.
// Run by hand (about monthly): npm run build:map
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '../src/js/data/ia/client.js'
import { FRAME_QUERY } from '../src/js/data/ia/frame.js'

export const WINDOW_MAX = 5000
const SECOND = 1000
const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z')

// Splits [from, to] (epoch ms, inclusive, whole seconds) until every piece holds <= max items, then merges neighbours
export async function buildWindows({ count, from, to, max = WINDOW_MAX, concurrency = 4 }) {
  let active = 0
  const waiting = []
  const limited = async (fn) => {
    while (active >= concurrency) await new Promise((resolve) => waiting.push(resolve))
    active++
    try {
      return await fn()
    } finally {
      active--
      waiting.shift()?.()
    }
  }

  async function split(a, b) {
    const n = await limited(() => count(iso(a), iso(b)))
    if (n === 0) return []
    // One second holding more than max cannot be split further; keep it and let the caller see it
    if (n <= max || a === b) return [{ from: a, to: b, count: n }]
    const mid = a + Math.floor((b - a) / 2 / SECOND) * SECOND
    const [left, right] = await Promise.all([split(a, mid), split(mid + SECOND, b)])
    return [...left, ...right]
  }

  // Calendar years first: cheaper than bisecting a 30-year span from scratch
  const years = []
  for (let y = new Date(from).getUTCFullYear(); Date.UTC(y, 0, 1) <= to; y++) {
    years.push([Math.max(from, Date.UTC(y, 0, 1)), Math.min(to, Date.UTC(y + 1, 0, 1) - SECOND)])
  }
  const leaves = (await Promise.all(years.map(([a, b]) => split(a, b)))).flat().sort((x, y) => x.from - y.from)

  const merged = []
  for (const leaf of leaves) {
    const last = merged.at(-1)
    if (last && last.count + leaf.count <= max) {
      last.to = leaf.to
      last.count += leaf.count
    } else merged.push({ ...leaf })
  }
  return merged.map((w) => [iso(w.from), iso(w.to), w.count])
}

async function main() {
  const client = createClient({ retries: 5 })
  const total = (await client.search({ query: FRAME_QUERY, rows: 0 })).total
  const noDate = (await client.search({ query: `${FRAME_QUERY} AND NOT publicdate:[* TO *]`, rows: 0 })).total
  const builtAt = Date.now() - (Date.now() % SECOND)

  let queries = 0
  const count = async (a, b) => {
    queries++
    if (queries % 50 === 0) process.stdout.write(`  ${queries} queries\n`)
    return (await client.search({ query: `${FRAME_QUERY} AND publicdate:[${a} TO ${b}]`, rows: 0 })).total
  }
  const windows = await buildWindows({ count, from: Date.UTC(1996, 0, 1), to: builtAt })

  const counted = windows.reduce((sum, w) => sum + w[2], 0) + noDate
  // Items added while we were counting make the totals drift a little; a large gap means a wrong frame
  if (Math.abs(counted - total) > Math.max(50, total * 0.001)) {
    throw new Error(`Windows hold ${counted} items but the frame reports ${total}`)
  }

  const map = { version: 1, builtAt: new Date(builtAt).toISOString(), frame: FRAME_QUERY, noDate, windows }
  const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/ia-map.json')
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(map) + '\n')
  console.log(`${windows.length} windows, ${counted} items (frame ${total}), ${queries} queries -> ${out}`)
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
