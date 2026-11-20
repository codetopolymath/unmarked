import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeFile, parseRoles } from '../../src/js/data/commons/normalize.js'

function page(extmetadata = {}, info = {}, categories) {
  return {
    pageid: 7,
    title: 'File:Some_Tune.ogg',
    ...(categories && { categories: categories.map((title) => ({ ns: 14, title })) }),
    videoinfo: [
      {
        mediatype: 'AUDIO',
        mime: 'audio/mpeg',
        duration: 120,
        url: 'https://upload.wikimedia.org/a/Some_Tune.mp3',
        derivatives: [],
        extmetadata: Object.fromEntries(Object.entries(extmetadata).map(([k, value]) => [k, { value }])),
        ...info,
      },
    ],
  }
}

test('role-labelled text gives composer and performer', () => {
  assert.deepEqual(parseRoles('Composition: Johann Strauss\nPerformance: Vienna Quartet'), {
    composer: 'Johann Strauss',
    performer: 'Vienna Quartet',
  })
  assert.deepEqual(parseRoles('Music: A. Roe Text: B. Poe Performed by C. Doe'), {
    composer: 'A. Roe',
    performer: 'C. Doe',
  })
})

test('unlabelled text is not a role list', () => {
  assert.equal(parseRoles('Frederic Chopin'), null)
  assert.equal(parseRoles('Music Ensemble of Oslo'), null)
  assert.equal(parseRoles('Source: own work'), null)
})

test('a named performer is the displayed artist, the composer is credited', () => {
  const record = normalizeFile(page({ Artist: 'Composition: <a href="x">Bach</a><br>Performance: Glenn Gould' }))
  assert.deepEqual(record.artists, [{ name: 'Glenn Gould' }])
  assert.deepEqual(record.credits, { composer: 'Bach', performer: 'Glenn Gould' })
})

test('only a composer named leaves the artist empty rather than invented', () => {
  const record = normalizeFile(page({ Artist: 'Composition: Bach' }))
  assert.deepEqual(record.artists, [])
  assert.deepEqual(record.credits, { composer: 'Bach' })
})

test('an unlabelled artist stays as today and a licence blurb is still refused', () => {
  assert.deepEqual(normalizeFile(page({ Artist: 'Jane Doe' })).artists, [{ name: 'Jane Doe' }])
  assert.deepEqual(normalizeFile(page({ Artist: 'x'.repeat(200) })).artists, [])
})

test('the year comes from the performance, not the composition or the upload', () => {
  assert.equal(normalizeFile(page({ DateTimeOriginal: 'Composition: 1885\nPerformance: 1991' })).dates.year, 1991)
  assert.deepEqual(normalizeFile(page({ DateTimeOriginal: '13 May 2010 (original upload date)' })).dates, {})
})

test('a "from institution" category is the collection; topic categories are ignored', () => {
  const record = normalizeFile(
    page({}, {}, ['Category:Jazz', 'Category:1950 in music', 'Category:Audio files from the Library of Congress']),
  )
  assert.deepEqual(record.collection, {
    id: 'Audio files from the Library of Congress',
    label: 'the Library of Congress',
  })
  assert.equal(normalizeFile(page({}, {}, ['Category:Jazz', 'Category:Audio files of Paris'])).collection, undefined)
  assert.equal(normalizeFile(page()).collection, undefined)
})

test('audio format reports the master when it differs from what plays', () => {
  const wav = page(
    {},
    { mime: 'audio/wav', derivatives: [{ type: 'audio/mpeg; codecs="mp3"', src: 'https://x/t.mp3' }] },
  )
  assert.deepEqual(normalizeFile(wav).audioFormat, { playing: 'MP3', original: 'WAV' })
  const flac = page(
    {},
    { mime: 'audio/flac', derivatives: [{ type: 'audio/mpeg; codecs="mp3"', src: 'https://x/t.mp3' }] },
  )
  assert.deepEqual(normalizeFile(flac).audioFormat, { playing: 'MP3', original: 'FLAC' })
  const ogg = page(
    {},
    { mime: 'application/ogg', derivatives: [{ type: 'audio/mpeg; codecs="mp3"', src: 'https://x/t.mp3' }] },
  )
  assert.deepEqual(normalizeFile(ogg).audioFormat, { playing: 'MP3', original: 'Ogg' })
  assert.deepEqual(normalizeFile(page()).audioFormat, { playing: 'MP3' })
  assert.deepEqual(normalizeFile(page({}, { mime: 'application/ogg' })).audioFormat, { playing: 'Ogg Vorbis' })
})
