import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLibrary, snapshotOf } from '../../src/js/services/library.js'

const record = {
  id: 'mock:001',
  kind: 'album',
  title: 'Salt Meridian',
  artists: [{ name: 'The Quartet' }],
  dates: { year: 1974 },
  artwork: { origin: 'source', spec: { style: 'rings', palette: 'ember' } },
  source: { name: 'Mock Archive A' },
  tracks: [{ title: 'One' }],
}

test('snapshotOf keeps only what a shelf or diary entry needs', () => {
  assert.deepEqual(snapshotOf(record), {
    id: 'mock:001',
    kind: 'album',
    title: 'Salt Meridian',
    artist: 'The Quartet',
    year: 1974,
    artwork: { origin: 'source', spec: { style: 'rings', palette: 'ember' } },
    source: { name: 'Mock Archive A' },
  })
})

test('snapshotOf uses nulls instead of inventing missing values', () => {
  const snap = snapshotOf({ id: 'x', kind: 'recording', source: { name: 'S' }, tracks: [{}] })
  assert.equal(snap.artist, null)
  assert.equal(snap.year, null)
  assert.equal(snap.title, 'Untitled recording')
})

test('an export imports back unchanged', () => {
  const library = createLibrary()
  const kept = [{ ...snapshotOf(record), savedAt: 1 }]
  const history = [{ ...snapshotOf(record), number: 1, shownAt: 2, played: true }]
  const restored = library.parseImport(library.exportJson({ kept, history }))
  assert.deepEqual(restored, { kept, history })
})

test('import rejects files that are not an Unmarked export', () => {
  const library = createLibrary()
  assert.throws(() => library.parseImport('{"nope":1}'), /not an Unmarked export/)
  assert.throws(() => library.parseImport('{"app":"unmarked","kept":[]}'), /not an Unmarked export/)
  assert.throws(() => library.parseImport('not json'))
})
