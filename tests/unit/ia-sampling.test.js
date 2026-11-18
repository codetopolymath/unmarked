import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWindows } from '../../tools/build-map.mjs'
import { createSampler } from '../../src/js/data/ia/sampler.js'
import { frameQuery, IA_COLLECTIONS, FRAME_QUERY } from '../../src/js/data/ia/frame.js'
import { SOURCES } from '../../src/js/data/sources-catalog.js'

const DAY = 86400000
const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z')

// One item per day for 60 days, plus a dense burst on day 20 (3,000 items)
function fakeCounter(start) {
  const stamps = []
  for (let d = 0; d < 60; d++) {
    for (let k = 0; k < (d === 20 ? 3000 : 100); k++) stamps.push(start + d * DAY + k * 1000)
  }
  return async (a, b) => stamps.filter((t) => t >= Date.parse(a) && t <= Date.parse(b)).length
}

test('buildWindows covers every item exactly once and respects the window limit', async () => {
  const start = Date.UTC(2024, 0, 1)
  const windows = await buildWindows({
    count: fakeCounter(start),
    from: start,
    to: start + 60 * DAY - 1000,
    max: 1000,
  })
  const total = windows.reduce((sum, w) => sum + w[2], 0)
  assert.equal(total, 59 * 100 + 3000)
  assert.ok(windows.every((w) => w[2] <= 1000))
  for (let i = 1; i < windows.length; i++) assert.ok(Date.parse(windows[i][0]) > Date.parse(windows[i - 1][1]))
})

test('buildWindows merges sparse neighbours up to the cap', async () => {
  const start = Date.UTC(2024, 0, 1)
  const windows = await buildWindows({ count: async () => 0, from: start, to: start + DAY, max: 10 })
  assert.deepEqual(windows, [])
  const some = await buildWindows({
    count: async (a, b) => (Date.parse(a) <= start && Date.parse(b) >= start ? 3 : 0),
    from: start,
    to: start + DAY,
    max: 10,
  })
  assert.equal(some.length, 1)
  assert.equal(some[0][2], 3)
  assert.equal(some[0][0], iso(start))
})

const MAP = {
  noDate: 2,
  windows: [
    ['2020-01-01T00:00:00Z', '2020-01-31T23:59:59Z', 10],
    ['2020-02-01T00:00:00Z', '2020-02-29T23:59:59Z', 5],
    ['2020-03-01T00:00:00Z', '2020-03-31T23:59:59Z', 1],
  ],
}

test('sampler maps every rank to the bucket and page that holds it', () => {
  const sampler = createSampler({ map: MAP })
  assert.equal(sampler.total, 18)
  const seen = []
  for (let rank = 0; rank < sampler.total; rank++) seen.push(sampler.plan(rank))
  assert.deepEqual(seen[0], { clause: 'publicdate:[2020-01-01T00:00:00Z TO 2020-01-31T23:59:59Z]', page: 1 })
  assert.equal(seen[9].page, 10)
  assert.equal(seen[10].clause.includes('2020-02-01'), true)
  assert.equal(seen[10].page, 1)
  assert.equal(seen[15].clause.includes('2020-03-01'), true)
  assert.deepEqual(seen[16], { clause: 'NOT publicdate:[* TO *]', page: 1 })
  assert.equal(seen[17].page, 2)
  assert.equal(new Set(seen.map((p) => `${p.clause}#${p.page}`)).size, 18)
})

test('sampler draws are uniform over ranks', () => {
  let i = 0
  const sampler = createSampler({ map: MAP, random: () => (i++ % 18) / 18 })
  const pages = Array.from({ length: 18 }, () => sampler.next('X'))
  assert.equal(new Set(pages.map((p) => `${p.query}#${p.page}`)).size, 18)
  assert.ok(pages.every((p) => p.rows === 1 && p.sort === 'identifier asc' && p.query.startsWith('X AND ')))
})

test('frame query is built from the selected Internet Archive sources only', () => {
  for (const source of SOURCES.filter((s) => s.group === 'internet-archive' && s.status === 'selected')) {
    assert.ok(IA_COLLECTIONS[source.id], `${source.id} has a collection id`)
    assert.ok(FRAME_QUERY.includes(IA_COLLECTIONS[source.id]))
  }
  for (const source of SOURCES.filter((s) => s.status === 'unavailable')) {
    assert.ok(!FRAME_QUERY.includes(IA_COLLECTIONS[source.id] ?? '\u0000'))
  }
  assert.throws(() => frameQuery([{ id: 'nope', group: 'internet-archive', status: 'selected' }], {}))
})
