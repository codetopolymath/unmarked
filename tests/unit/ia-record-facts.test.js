import { test } from 'node:test'
import assert from 'node:assert/strict'
import { audioFormatLabel, normalizeItem } from '../../src/js/data/ia/normalize.js'

const file = (name, format, extra = {}) => ({ name, format, source: 'original', length: '120', ...extra })

function item(metadata = {}, files) {
  return {
    metadata: { identifier: 'x', title: 'T', ...metadata },
    files: files ?? [
      file('a.flac', '24bit Flac'),
      file('a.mp3', 'VBR MP3', { source: 'derivative', original: 'a.flac' }),
    ],
  }
}

test('archive format names read as a listener would say them', () => {
  assert.equal(audioFormatLabel('VBR MP3'), 'MP3')
  assert.equal(audioFormatLabel('24bit Flac'), '24-bit FLAC')
  assert.equal(audioFormatLabel('Flac'), 'FLAC')
  assert.equal(audioFormatLabel('WAVE'), 'WAV')
  assert.equal(audioFormatLabel('Ogg Vorbis'), 'Ogg Vorbis')
  assert.equal(audioFormatLabel('AIFF'), 'AIFF')
  assert.equal(audioFormatLabel('Apple Lossless Audio'), 'Apple Lossless')
  assert.equal(audioFormatLabel('JPEG'), null)
})

test('the master is reported when the streamed file is a transcode of it', () => {
  assert.deepEqual(normalizeItem(item()).audioFormat, { playing: 'MP3', original: '24-bit FLAC' })
})

test('no original is reported when the master is what plays', () => {
  assert.deepEqual(normalizeItem(item({}, [file('a.mp3', 'VBR MP3')])).audioFormat, { playing: 'MP3' })
})

test('the first frame collection id becomes the record collection; internal ids are ignored', () => {
  const record = normalizeItem(item({ collection: ['opensource_audio', 'georgeblood', '78rpm'] }))
  assert.deepEqual(record.collection, { id: 'georgeblood', label: 'George Blood 78 rpm transfers' })
  assert.equal(normalizeItem(item({ collection: ['opensource_audio'] })).collection, undefined)
  assert.equal(normalizeItem(item({ collection: 'audio_music' })).collection.id, 'audio_music')
})

test('language is readable, de-duplicated and still an array', () => {
  assert.deepEqual(normalizeItem(item({ language: ['eng', 'cos'] })).language, ['English', 'Corsican'])
  assert.deepEqual(normalizeItem(item({ language: 'Enga' })).language, ['Enga'])
  assert.deepEqual(normalizeItem(item()).language, [])
})

test('dates: partial, ranged, and the year field as fallback', () => {
  assert.equal(normalizeItem(item({ date: '1914-02' })).dates.year, 1914)
  assert.equal(normalizeItem(item({ date: '1927-1929' })).dates.year, 1927)
  assert.equal(normalizeItem(item({ year: '1961' })).dates.year, 1961)
  assert.deepEqual(normalizeItem(item({ date: 'unknown' })).dates, {})
})
