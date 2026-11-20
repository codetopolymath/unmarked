import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAudiusSource } from '../../src/js/data/audius/audius-source.js'

const track = (id, extra = {}) => ({
  id,
  title: `Track ${id}`,
  permalink: `/artist/track-${id}`,
  duration: 120,
  license: null,
  is_streamable: true,
  access: { stream: true },
  user: { name: 'Artist' },
  ...extra,
})
const junk = track('junk', { is_stream_gated: true })

// Each lucky() call hands out the next batch
function fakeClient({ batches, probeOk = () => true, error, byId = {} } = {}) {
  const calls = { lucky: 0, probe: [], byId: [] }
  return {
    calls,
    streamUrl: (id) => `https://api.audius.co/v1/tracks/${id}/stream`,
    async lucky() {
      calls.lucky++
      if (error) throw error
      return batches.shift() ?? []
    },
    async byId(id) {
      calls.byId.push(id)
      return byId[id] ?? null
    },
    async probe(url) {
      calls.probe.push(url)
      return { ok: probeOk(url), status: 206, ranges: true }
    },
  }
}

const make = (client, extra = {}) => createAudiusSource({ client, bufferSize: 0, ...extra })

test('draw returns a verified record and probes its stream', async () => {
  const client = fakeClient({ batches: [[track('a')]] })
  const record = await make(client).draw()
  assert.equal(record.id, 'audius:a')
  assert.deepEqual(client.calls.probe, ['https://api.audius.co/v1/tracks/a/stream'])
})

test('one call serves several draws, and unusable tracks are skipped', async () => {
  const client = fakeClient({ batches: [[junk, track('a'), track('b')]] })
  const source = make(client)
  assert.equal((await source.draw()).id, 'audius:a')
  assert.equal((await source.draw()).id, 'audius:b')
  assert.equal(client.calls.lucky, 1)
})

test('history, the current record and earlier draws are not repeated', async () => {
  const client = fakeClient({ batches: [[track('a'), track('b'), track('c'), track('a')]] })
  const source = make(client, { excluded: () => ['audius:a'] })
  assert.equal((await source.draw({ current: { id: 'audius:b' } })).id, 'audius:c')
})

test('onCandidate fires for usable tracks only, before the probe', async () => {
  const order = []
  const client = fakeClient({ batches: [[junk, track('a')]] })
  const probe = client.probe
  client.probe = async (url) => {
    order.push('probe')
    return probe(url)
  }
  await make(client, { onCandidate: (r) => order.push(r.id) }).draw()
  assert.deepEqual(order, ['audius:a', 'probe'])
})

test('a track whose stream does not answer is skipped and reported', async () => {
  const skipped = []
  const client = fakeClient({ batches: [[track('a'), track('b')]], probeOk: (url) => !url.includes('/a/') })
  const record = await make(client).draw({ onSkip: (r) => skipped.push(r.id) })
  assert.equal(record.id, 'audius:b')
  assert.deepEqual(skipped, ['audius:a'])
})

test('a dead API becomes SourceUnreachable after a few failures', async () => {
  const client = fakeClient({ batches: [], error: new Error('network') })
  await assert.rejects(make(client).draw(), { name: 'SourceUnreachable', message: 'Audius is not answering right now' })
  assert.equal(client.calls.lucky, 3)
})

test('an empty list keeps trying, then gives up with a retry message', async () => {
  const client = fakeClient({ batches: [] })
  await assert.rejects(make(client).draw(), {
    name: 'SourceUnreachable',
    message: 'Could not find a playable record. Try again.',
  })
})

test('byId re-fetches a track, and only answers for its own prefix', async () => {
  const client = fakeClient({ batches: [], byId: { z: track('z') } })
  const source = make(client)
  assert.equal((await source.byId('audius:z')).id, 'audius:z')
  assert.equal(await source.byId('audius:missing'), null)
  assert.equal(await source.byId('ia:z'), null)
  assert.deepEqual(client.calls.byId, ['z', 'missing'])
})
