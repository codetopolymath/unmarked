import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  normalizeItem,
  pickTracks,
  pickCover,
  parseDuration,
  htmlToText,
  mapRights,
} from '../../src/js/data/ia/normalize.js'

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/ia/${name}.json`, import.meta.url), 'utf8'))

test('a single 78 rpm side becomes one recording with one playable track', () => {
  const record = normalizeItem(fixture('78rpm'))
  assert.equal(record.id, 'ia:1907-entracte-waltz-coppelia-delibes-banda-espanola-col-5695')
  assert.equal(record.kind, 'recording')
  assert.equal(record.tracks.length, 1)
  assert.match(record.tracks[0].audio.url, /^https:\/\/archive\.org\/download\/.+\.mp3$/)
  assert.equal(record.tracks[0].duration_s, 218.36)
  assert.equal(record.dates.year, 1907)
  assert.equal(record.rights.state, 'public_domain')
  assert.equal(record.rights.licence_url, 'https://creativecommons.org/publicdomain/mark/1.0/')
  assert.ok(!/<[a-z]/i.test(record.description), 'description is plain text')
  assert.deepEqual(record.artists, [{ name: 'Animating Apothecary Archives' }])
})

test('a netlabel release is an album with ordered tracks and one file per song', () => {
  const record = normalizeItem(fixture('netlabel'))
  assert.equal(record.kind, 'album')
  assert.ok(record.tracks.length >= 4)
  assert.deepEqual(
    record.tracks.map((t) => t.index),
    record.tracks.map((_, i) => i),
  )
  assert.equal(new Set(record.tracks.map((t) => t.audio.url)).size, record.tracks.length)
  assert.equal(record.tracks[0].title, 'Steve Reich')
  assert.ok(record.tracks.every((t) => t.audio.url.endsWith('.mp3')))
})

test('a Jamendo album keeps the MP3 and drops the Ogg twin of each track', () => {
  const record = normalizeItem(fixture('jamendo'))
  assert.equal(record.tracks.length, 8)
  assert.ok(record.tracks.every((t) => t.audio.format.toLowerCase().includes('mp3')))
  assert.equal(record.tracks[0].title, 'STATION DENFERT')
  assert.deepEqual(record.artists, [{ name: 'philippe deschamps' }])
})

test('Creative Commons licence URLs map to terms and attribution', () => {
  const record = normalizeItem(fixture('cc'))
  assert.deepEqual(record.rights.terms, ['BY', 'NC', 'SA'])
  assert.equal(record.rights.short, 'CC BY-NC-SA 3.0')
  assert.equal(record.rights.label, 'Creative Commons Attribution-NonCommercial-ShareAlike 3.0')
  assert.equal(record.rights.attribution_required, true)
  assert.equal(record.rights.licence_url, 'https://creativecommons.org/licenses/by-nc-sa/3.0/')
})

test('an item with no licence fields reads as not stated', () => {
  const record = normalizeItem(fixture('audio-music'))
  assert.equal(record.rights.state, 'unknown')
  assert.equal(record.rights.short, 'Licence not stated')
})

test('mapRights covers the other licence shapes', () => {
  assert.equal(mapRights({ licenseurl: 'http://creativecommons.org/publicdomain/zero/1.0/' }).short, 'CC0 1.0')
  assert.equal(mapRights({ licenseurl: 'https://example.com/terms' }).state, 'unknown')
  assert.equal(mapRights({ licenseurl: 'https://example.com/terms' }).licence_url, 'https://example.com/terms')
  assert.equal(mapRights({ 'possible-copyright-status': 'NOT_IN_COPYRIGHT' }).state, 'public_domain')
  assert.equal(mapRights({ 'possible-copyright-status': 'IN_COPYRIGHT' }).state, 'all_rights_reserved')
  assert.equal(mapRights({ licenseurl: ['https://creativecommons.org/licenses/by/4.0/'] }).short, 'CC BY 4.0')
  const restricted = mapRights({
    'access-restricted-item': 'true',
    licenseurl: 'https://creativecommons.org/licenses/by/4.0/',
  })
  assert.equal(restricted.state, 'restricted')
  assert.equal(restricted.licence_url, 'https://creativecommons.org/licenses/by/4.0/')
  assert.equal(mapRights({ rights: '<p>Used with permission</p>' }).statement, 'Used with permission')
})

test('parseDuration reads seconds and clock formats and rejects junk', () => {
  assert.equal(parseDuration('218.31'), 218.31)
  assert.equal(parseDuration('03:00'), 180)
  assert.equal(parseDuration('1:02:03'), 3723)
  assert.equal(parseDuration(['12']), 12)
  for (const bad of [undefined, '', 'abc', '1:2:3:4', '-5', '0'])
    assert.equal(parseDuration(bad), undefined, String(bad))
})

test('htmlToText keeps paragraph breaks and decodes entities', () => {
  assert.equal(
    htmlToText('<p>One &amp; two</p><p>Three<br />four &#39;x&#39; &unknown;</p>'),
    "One & two\n\nThree\nfour 'x' &unknown;",
  )
})

test('pickTracks follows derivative links and ignores unplayable formats', () => {
  const files = [
    { name: 'b.mp3', format: 'VBR MP3', source: 'original', track: '2', length: '10' },
    { name: 'a.mp3', format: 'VBR MP3', source: 'original', track: '1', length: '20' },
    { name: 'a_64kb.mp3', format: '64Kbps MP3', source: 'derivative', original: 'a.mp3' },
    { name: 'a.ogg', format: 'Ogg Vorbis', source: 'derivative', original: ['a.mp3'] },
    { name: 'a.wav', format: 'WAVE', source: 'original' },
    { name: '__ia_thumb.jpg', format: 'JPEG Thumb' },
    { name: 'dir/c d.ogg', format: 'Ogg Vorbis', source: 'original', track: 'junk text' },
  ]
  const tracks = pickTracks('item id', files)
  assert.deepEqual(
    tracks.map((t) => t.audio.url.split('/').slice(5).join('/')),
    ['a.mp3', 'b.mp3', 'dir/c%20d.ogg'],
  )
  assert.ok(tracks[0].audio.url.startsWith('https://archive.org/download/item%20id/'))
})

test('cover choice prefers a real cover file, else the archive thumbnail', () => {
  const jamendo = normalizeItem(fixture('jamendo'))
  assert.equal(jamendo.artwork.url, 'https://archive.org/download/jamendo-008969/cover.jpg')
  const files = [{ name: '01.png', format: 'PNG' }]
  assert.equal(pickCover('x', files), 'https://archive.org/download/x/__ia_thumb.jpg')
  assert.equal(
    pickCover('x y', [{ name: 'Front Cover.JPG', format: 'JPEG' }]),
    'https://archive.org/download/x%20y/Front%20Cover.JPG',
  )
})

test('cover choice: own scan, front over back, no spectrograms, no archive derivatives', () => {
  const url = (id, files) => pickCover(id, files).split('/').slice(5).join('/')
  assert.equal(
    url('78_x', [
      { name: '78_x.jpg', format: 'JPEG', size: '1059244' },
      { name: '__ia_thumb.jpg', format: 'Item Tile', size: '10974' },
    ]),
    '78_x.jpg',
  )
  assert.equal(
    url('cd', [
      { name: 'cd - Back Cover.jpg', format: 'JPEG', size: '900000' },
      { name: 'cd - Front Cover.jpg', format: 'JPEG', size: '500000' },
    ]),
    'cd%20-%20Front%20Cover.jpg',
  )
  assert.equal(url('only-back', [{ name: 'Back.jpg', format: 'JPEG', size: '90000' }]), '__ia_thumb.jpg')
  const spectrograms = [
    { name: 'rec_20221103_000000.png', format: 'PNG', size: '31480' },
    { name: 'tile.jpg', format: 'JPEG Thumb', size: '626' },
    { name: 'tiny.jpg', format: 'JPEG', size: '2000' },
  ]
  assert.equal(url('field', spectrograms), '__ia_thumb.jpg')
  assert.equal(url('photo', [{ name: 'IMG_0042.jpg', format: 'JPEG', size: '250000' }]), 'IMG_0042.jpg')
})

test('items with nothing playable, or no identifier, normalize to null', () => {
  assert.equal(normalizeItem({ metadata: { identifier: 'x' }, files: [{ name: 'a.wav', format: 'WAVE' }] }), null)
  assert.equal(normalizeItem({}), null)
  assert.equal(normalizeItem(null), null)
})

test('missing optional metadata is omitted, not blanked', () => {
  const record = normalizeItem({
    metadata: { identifier: 'bare', date: 'circa 1850s' },
    files: [{ name: 'x.mp3', format: 'VBR MP3', source: 'original' }],
  })
  assert.equal(record.title, undefined)
  assert.deepEqual(record.dates, {})
  assert.equal(record.place, undefined)
  assert.equal(record.credits, undefined)
  assert.deepEqual(record.artists, [])
  assert.equal(record.tracks[0].duration_s, undefined)
})
