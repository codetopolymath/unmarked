import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RECORDS } from '../../src/js/data/mock-records.js'
import { SOURCES, SOURCE_GROUPS } from '../../src/js/data/sources-catalog.js'
import { synthesizeWav } from '../../src/js/services/tone-synth.js'

const RIGHTS_STATES = ['public_domain', 'licensed', 'all_rights_reserved', 'restricted', 'unknown']

test('mock records satisfy the normalized Discovery model', () => {
  const ids = new Set()
  for (const record of RECORDS) {
    assert.ok(!ids.has(record.id), `duplicate id ${record.id}`)
    ids.add(record.id)
    assert.match(record.id, /^mock:\d+$/)
    assert.ok(['album', 'recording'].includes(record.kind), record.id)
    assert.ok(record.source?.name && record.source?.item_id && record.source?.url, `${record.id} source`)
    assert.ok(RIGHTS_STATES.includes(record.rights?.state), `${record.id} rights`)
    assert.ok(record.rights.label, `${record.id} rights label`)
    assert.ok(['ok', 'unavailable'].includes(record.availability?.status), `${record.id} availability`)
    assert.ok(record.tracks.length >= 1, `${record.id} tracks`)
    for (const track of record.tracks) {
      assert.ok(track.audio?.seed && track.audio.seconds > 0, `${record.id} track audio`)
    }
  }
})

test('the mock catalogue keeps its edge cases', () => {
  assert.ok(
    RECORDS.some((r) => r.availability.status === 'unavailable'),
    'an unavailable record',
  )
  assert.ok(
    RECORDS.some((r) => r.tracks.some((t) => t.fail)),
    'a track that fails',
  )
  assert.ok(
    RECORDS.some((r) => r.tracks.length >= 13),
    'a long tracklist',
  )
  assert.ok(
    RECORDS.some((r) => !r.artists?.length),
    'a record with no artist',
  )
  assert.ok(
    RECORDS.some((r) => !r.artwork.spec),
    'a record with no cover',
  )
})

test('sources catalog: Internet Archive collections are in scope, everything else is an open todo', () => {
  const ids = new Set()
  for (const entry of SOURCES) {
    assert.ok(!ids.has(entry.id), `duplicate ${entry.id}`)
    ids.add(entry.id)
    assert.ok(
      SOURCE_GROUPS.some((g) => g.id === entry.group),
      `${entry.id} group`,
    )
    assert.ok(['selected', 'unavailable'].includes(entry.status), `${entry.id} status`)
    assert.ok(entry.size === null || entry.size > 0, `${entry.id} size`)
    // An unavailable source must say what is left to do; a selected one must not carry a todo
    assert.equal(Boolean(entry.todo), entry.status === 'unavailable', `${entry.id} todo`)
  }
  const outsideArchive = SOURCES.filter((s) => s.group === 'other')
  assert.ok(outsideArchive.length > 0 && outsideArchive.every((s) => s.status === 'unavailable'))
  assert.ok(
    SOURCES.some((s) => s.id === 'ia-78rpm' && s.status === 'selected'),
    '78 rpm stays in scope',
  )
})

test('placeholder audio is a valid, deterministic, unclipped WAV', async () => {
  const wav = async (seed) => new Uint8Array(await (await synthesizeWav({ seed, seconds: 2 })).arrayBuffer())
  const a = await wav('t')
  const view = new DataView(a.buffer)
  assert.equal(String.fromCharCode(...a.slice(0, 4)), 'RIFF')
  assert.equal(String.fromCharCode(...a.slice(8, 12)), 'WAVE')
  assert.equal(view.getUint32(24, true), 11025)
  assert.equal(view.getUint32(40, true), 11025 * 2 * 2)
  assert.deepEqual(a, await wav('t'))
  assert.notDeepEqual(a, await wav('other'))
  let peak = 0
  for (let i = 44; i < a.length; i += 2) peak = Math.max(peak, Math.abs(view.getInt16(i, true)))
  assert.ok(peak > 100 && peak < 32767, `peak ${peak}`)
})
