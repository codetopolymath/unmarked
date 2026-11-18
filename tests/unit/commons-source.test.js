import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createCommonsSource } from '../../src/js/data/commons/commons-source.js'

const load = (name) => JSON.parse(readFileSync(new URL(`../fixtures/commons/${name}.json`, import.meta.url), 'utf8'))
const PAGES = { ogg: load('ogg'), mp3: load('mp3'), wav: load('wav'), flac: load('flac') }
const ID = (name) => `commons:${PAGES[name].pageid}`
const junk = { pageid: 1, title: 'File:short.ogg', videoinfo: [{ mediatype: 'AUDIO', mime: 'audio/ogg', duration: 3 }] }

// Each random() call hands out the next batch
function fakeClient({ batches, probeOk = () => true, error } = {}) {
  const calls = { random: 0, probe: [], byPageId: [] }
  return {
    calls,
    async random() {
      calls.random++
      if (error) throw error
      return batches.shift() ?? []
    },
    async byPageId(id) {
      calls.byPageId.push(id)
      return Object.values(PAGES).find((p) => String(p.pageid) === String(id)) ?? null
    },
    async probe(url) {
      calls.probe.push(url)
      return { ok: probeOk(url), status: 206, ranges: true }
    },
  }
}

const make = (client, extra = {}) => createCommonsSource({ client, bufferSize: 0, ...extra })

test('draw returns a verified, normalized record and probes its audio', async () => {
  const client = fakeClient({ batches: [[PAGES.mp3]] })
  const record = await make(client).draw()
  assert.equal(record.id, ID('mp3'))
  assert.deepEqual(client.calls.probe, [record.tracks[0].audio.url])
})

test('one search call serves several attempts, and unusable candidates are skipped', async () => {
  const client = fakeClient({ batches: [[junk, PAGES.ogg, PAGES.wav]] })
  const source = make(client)
  assert.equal((await source.draw()).id, ID('ogg'))
  assert.equal((await source.draw()).id, ID('wav'))
  assert.equal(client.calls.random, 1)
})

test('history, the current record and earlier draws are not repeated', async () => {
  const client = fakeClient({ batches: [[PAGES.ogg, PAGES.mp3, PAGES.wav, PAGES.ogg]] })
  const source = make(client, { excluded: () => [ID('ogg')] })
  assert.equal((await source.draw({ current: { id: ID('mp3') } })).id, ID('wav'))
})

test('a recording already seen through the Archive is skipped', async () => {
  const mirror = 'ia:78_homesick_marion-harris-irving-belrin_gbia0003623a'
  const client = fakeClient({ batches: [[PAGES.flac, PAGES.mp3]] })
  const source = make(client, { excluded: () => [mirror] })
  assert.equal((await source.draw()).id, ID('mp3'))
})

test('onCandidate fires for usable files only, before the probe', async () => {
  const order = []
  const client = fakeClient({ batches: [[junk, PAGES.mp3]] })
  const probe = client.probe
  client.probe = async (url) => {
    order.push('probe')
    return probe(url)
  }
  await make(client, { onCandidate: (r) => order.push(r.id) }).draw()
  assert.deepEqual(order, [ID('mp3'), 'probe'], 'the too-short file was never offered')
})

test('a file whose audio does not play is skipped and reported', async () => {
  const skipped = []
  const client = fakeClient({ batches: [[PAGES.ogg, PAGES.mp3]], probeOk: (url) => !url.includes('This_Land') })
  const record = await make(client).draw({ onSkip: (r) => skipped.push(r.id) })
  assert.equal(record.id, ID('mp3'))
  assert.deepEqual(skipped, [ID('ogg')])
})

test('an empty batch retries; endless emptiness ends as SourceUnreachable', async () => {
  const retried = fakeClient({ batches: [[], [PAGES.mp3]] })
  assert.equal((await make(retried).draw()).id, ID('mp3'))
  const hopeless = fakeClient({ batches: [] })
  await assert.rejects(make(hopeless, { maxAttempts: 3 }).draw(), { name: 'SourceUnreachable' })
  assert.equal(hopeless.calls.random, 3)
})

test('repeated network failures surface as SourceUnreachable; aborts pass through', async () => {
  const down = fakeClient({ error: new Error('down') })
  await assert.rejects(make(down).draw(), (e) => e.name === 'SourceUnreachable' && /Wikimedia Commons/.test(e.message))
  assert.equal(down.calls.random, 3)
  const aborted = fakeClient({ error: new DOMException('stop', 'AbortError') })
  await assert.rejects(make(aborted).draw(), { name: 'AbortError' })
})

test('byId looks a record up by page id and ignores foreign ids', async () => {
  const client = fakeClient({ batches: [] })
  const source = make(client)
  assert.equal((await source.byId(ID('wav'))).id, ID('wav'))
  await source.byId(ID('wav'))
  assert.equal(client.calls.byPageId.length, 1, 'cached')
  assert.equal(await source.byId('ia:something'), null)
  assert.equal(await source.byId('commons:999'), null)
})
