import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createIaSource } from '../../src/js/data/ia/ia-source.js'
import { ArchiveError } from '../../src/js/data/ia/client.js'

const load = (name) => JSON.parse(readFileSync(new URL(`../fixtures/ia/${name}.json`, import.meta.url), 'utf8'))
const ITEMS = { alpha: load('78rpm'), beta: load('netlabel'), gamma: load('jamendo') }
const IDS = Object.values(ITEMS).map((reply) => reply.metadata.identifier)
const MAP = { noDate: 0, windows: [['2020-01-01T00:00:00Z', '2020-12-31T23:59:59Z', 3]] }

// Search returns identifiers in the order given; metadata and probe come from the tables
function fakeClient({ order, probeOk = () => true, searchError, spokenIds = [] } = {}) {
  let i = 0
  const calls = { search: 0, metadata: [], probe: [], fields: [] }
  return {
    calls,
    async search({ fields } = {}) {
      calls.search++
      calls.fields.push(fields)
      if (searchError) throw searchError
      const identifier = order[i++ % order.length]
      const doc = { identifier, subject: spokenIds.includes(identifier) ? ['Non-Music', 'Spoken Word'] : ['Jazz'] }
      return { total: 3, docs: identifier ? [doc] : [] }
    },
    async metadata(identifier) {
      calls.metadata.push(identifier)
      return Object.values(ITEMS).find((r) => r.metadata.identifier === identifier) ?? null
    },
    async probe(url) {
      calls.probe.push(url)
      return { ok: probeOk(url), status: 206, ranges: true }
    },
  }
}

const make = (client, extra = {}) => createIaSource({ map: MAP, client, bufferSize: 0, random: () => 0, ...extra })

test('draw returns a normalized, verified record and probes the first track', async () => {
  const client = fakeClient({ order: [IDS[0]] })
  const record = await make(client).draw()
  assert.equal(record.id, `ia:${IDS[0]}`)
  assert.equal(record.availability.status, 'ok')
  assert.deepEqual(client.calls.probe, [record.tracks[0].audio.url])
})

test('history, the current record and earlier draws are never repeated', async () => {
  const client = fakeClient({ order: [IDS[0], IDS[1], IDS[2], IDS[2]] })
  const source = make(client, { excluded: () => [`ia:${IDS[0]}`] })
  const first = await source.draw({ current: { id: `ia:${IDS[1]}` } })
  assert.equal(first.id, `ia:${IDS[2]}`)
  assert.equal(client.calls.search, 3)
  // IDS[1] was only blocked as the earlier "current"; with nothing current it is fair game again
  assert.equal((await source.draw()).id, `ia:${IDS[1]}`)
  // ...but a record already drawn this session, or in history, never comes back
  await assert.rejects(source.draw(), { name: 'SourceUnreachable' })
})

test('a record whose audio does not play is skipped and reported', async () => {
  const skipped = []
  const client = fakeClient({ order: [IDS[0], IDS[1]], probeOk: (url) => !url.includes(IDS[0]) })
  const record = await make(client).draw({ onSkip: (r) => skipped.push(r.id) })
  assert.equal(record.id, `ia:${IDS[1]}`)
  assert.deepEqual(skipped, [`ia:${IDS[0]}`])
})

test('spoken-word items are rejected from the search fields, before any metadata fetch or probe', async () => {
  const client = fakeClient({ order: [IDS[0], IDS[1]], spokenIds: [IDS[0]] })
  const record = await make(client).draw()
  assert.equal(record.id, `ia:${IDS[1]}`)
  assert.deepEqual(client.calls.metadata, [IDS[1]], 'the spoken item cost no metadata request')
  assert.equal(client.calls.probe.length, 1)
  assert.deepEqual(client.calls.fields[0], ['identifier', 'title', 'subject', 'collection'])
})

test('a spoken-word item can still be reopened from the library by id', async () => {
  const client = fakeClient({ order: [IDS[0]], spokenIds: [IDS[0]] })
  assert.equal((await make(client).byId(`ia:${IDS[0]}`)).id, `ia:${IDS[0]}`)
})

test('an empty search page (map drift) just retries another rank', async () => {
  const client = fakeClient({ order: [undefined, undefined, IDS[1]] })
  assert.equal((await make(client).draw()).id, `ia:${IDS[1]}`)
})

test('items with no playable audio are skipped without a probe', async () => {
  const client = fakeClient({ order: ['ghost', IDS[1]] })
  const record = await make(client).draw()
  assert.equal(record.id, `ia:${IDS[1]}`)
  assert.equal(client.calls.probe.length, 1)
})

test('three network failures in one draw surface as SourceUnreachable', async () => {
  const client = fakeClient({ order: [IDS[0]], searchError: new ArchiveError('down') })
  await assert.rejects(make(client).draw(), (e) => e.name === 'SourceUnreachable' && e.cause.name === 'ArchiveError')
  assert.equal(client.calls.search, 3)
})

test('the retry budget ends in SourceUnreachable when nothing is usable', async () => {
  const client = fakeClient({ order: [undefined] })
  await assert.rejects(make(client, { maxAttempts: 4 }).draw(), { name: 'SourceUnreachable' })
  assert.equal(client.calls.search, 4)
})

test('an abort from the caller is not turned into an outage', async () => {
  const client = fakeClient({ order: [IDS[0]], searchError: new DOMException('stop', 'AbortError') })
  await assert.rejects(make(client).draw(), { name: 'AbortError' })
  assert.equal(client.calls.search, 1)
})

test('the buffer is refilled in the background and a draw never waits on the archive', async () => {
  const client = fakeClient({ order: [IDS[0], IDS[1], IDS[2]] })
  const source = createIaSource({ map: MAP, client, bufferSize: 2, random: () => 0 })
  const first = await source.draw()
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(client.calls.search, 3)
  // From here the archive hangs; a buffered record must still come back
  client.search = () => new Promise(() => {})
  const second = await source.draw()
  assert.notEqual(second.id, first.id)
})

test('byId re-fetches by identifier and caches; foreign ids are unknown', async () => {
  const client = fakeClient({ order: [IDS[0]] })
  const source = make(client)
  const record = await source.byId(`ia:${IDS[1]}`)
  assert.equal(record.id, `ia:${IDS[1]}`)
  await source.byId(`ia:${IDS[1]}`)
  assert.equal(client.calls.metadata.length, 1)
  assert.equal(await source.byId('mock:001'), null)
})

test('prototype hooks: failNext throws once, nextId forces a record', async () => {
  const client = fakeClient({ order: [IDS[0]] })
  const source = make(client)
  source.settings.failNext = true
  await assert.rejects(source.draw(), { name: 'SourceUnreachable' })
  source.settings.nextId = `ia:${IDS[2]}`
  assert.equal((await source.draw()).id, `ia:${IDS[2]}`)
  assert.equal((await source.draw()).id, `ia:${IDS[0]}`)
})
