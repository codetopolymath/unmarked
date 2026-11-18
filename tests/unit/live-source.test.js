import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCombinedSource, createLiveSource, DEFAULT_WEIGHTS } from '../../src/js/data/live-source.js'
import { SourceUnreachable } from '../../src/js/data/errors.js'

// A source that returns a fixed record, or throws, and counts calls
function stub(prefix, { fail } = {}) {
  const source = {
    calls: 0,
    draw: async (options) => {
      source.calls++
      source.lastOptions = options
      if (fail) throw fail
      return { id: `${prefix}1`, from: prefix }
    },
    byId: async (id) => (id.startsWith(prefix) ? { id, from: prefix } : null),
  }
  return source
}

const parts = (a, b, weights = [0.8, 0.2]) => [
  { name: 'ia', prefix: 'ia:', weight: weights[0], source: a },
  { name: 'commons', prefix: 'commons:', weight: weights[1], source: b },
]

test('the first draw follows the weights', async () => {
  const draws = { ia: 0, commons: 0 }
  for (const roll of [0, 0.5, 0.79, 0.8, 0.95, 0.999]) {
    const ia = stub('ia:')
    const commons = stub('commons:')
    const record = await createCombinedSource({ parts: parts(ia, commons), random: () => roll }).draw()
    draws[record.from === 'ia:' ? 'ia' : 'commons']++
  }
  assert.deepEqual(draws, { ia: 3, commons: 3 })
  assert.deepEqual(DEFAULT_WEIGHTS, { ia: 0.8, commons: 0.2 })
})

test('when the chosen source is down the other one answers', async () => {
  const ia = stub('ia:', { fail: new SourceUnreachable('archive down') })
  const commons = stub('commons:')
  const record = await createCombinedSource({ parts: parts(ia, commons), random: () => 0 }).draw()
  assert.equal(record.from, 'commons:')
  assert.equal(ia.calls, 1)
})

test('when every source is down the last error is reported', async () => {
  const source = createCombinedSource({
    parts: parts(
      stub('ia:', { fail: new SourceUnreachable('a') }),
      stub('commons:', { fail: new SourceUnreachable('b') }),
    ),
    random: () => 0,
  })
  await assert.rejects(source.draw(), { name: 'SourceUnreachable', message: 'b' })
})

test('an abort is passed through, never retried on the other source', async () => {
  const commons = stub('commons:')
  const source = createCombinedSource({
    parts: parts(stub('ia:', { fail: new DOMException('stop', 'AbortError') }), commons),
    random: () => 0,
  })
  await assert.rejects(source.draw(), { name: 'AbortError' })
  assert.equal(commons.calls, 0)
})

test('draw options (signal, current, onSkip) reach the source', async () => {
  const ia = stub('ia:')
  const options = { signal: new AbortController().signal, current: { id: 'x' }, onSkip() {} }
  await createCombinedSource({ parts: parts(ia, stub('commons:')), random: () => 0 }).draw(options)
  assert.equal(ia.lastOptions, options)
})

test('byId goes to the source that owns the prefix', async () => {
  const source = createCombinedSource({ parts: parts(stub('ia:'), stub('commons:')) })
  assert.equal((await source.byId('commons:42')).from, 'commons:')
  assert.equal((await source.byId('ia:abc')).from, 'ia:')
  assert.equal(await source.byId('mock:001'), null)
})

test('prototype hooks: failNext throws once, nextId forces a record', async () => {
  const source = createCombinedSource({ parts: parts(stub('ia:'), stub('commons:')), random: () => 0 })
  source.settings.failNext = true
  await assert.rejects(source.draw(), { name: 'SourceUnreachable' })
  source.settings.nextId = 'commons:7'
  assert.equal((await source.draw()).id, 'commons:7')
  assert.equal((await source.draw()).id, 'ia:1')
})

test('createLiveSource wires both sources, or Commons alone without the Archive map', () => {
  const map = { noDate: 0, windows: [['2020-01-01T00:00:00Z', '2020-12-31T23:59:59Z', 5]] }
  assert.deepEqual(Object.keys(createLiveSource({ map, excluded: () => [] }).parts), ['ia', 'commons'])
  assert.deepEqual(Object.keys(createLiveSource({ map: null, excluded: () => [] }).parts), ['commons'])
})
