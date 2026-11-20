import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapRights, normalizeTrack } from '../../src/js/data/audius/normalize.js'

const streamUrl = (id) => `https://api.audius.co/v1/tracks/${id}/stream?app_name=unmarked`

// Shape and values taken from a real Feeling Lucky reply (2026-11-20), trimmed to the fields the app reads
const track = (extra = {}) => ({
  id: 'oWElNq5',
  title: ' Lofi Rain ',
  permalink: '/hyghlofimusic/hygh-lofi-music-lofi-rain-450091',
  duration: 164,
  genre: 'Electronic',
  license: 'All rights reserved',
  release_date: '2021-07-03T17:29:00Z',
  description: 'Rain on a window.',
  is_streamable: true,
  is_stream_gated: false,
  stream_conditions: null,
  is_unlisted: false,
  is_delete: false,
  is_available: true,
  allowed_api_keys: null,
  access: { stream: true, download: false },
  user: { name: 'HYGH Lofi Music', handle: 'hyghlofimusic' },
  artwork: {
    '480x480': 'https://cn0.example/480x480.jpg',
    '1000x1000': 'https://cn0.example/1000x1000.jpg',
  },
  stream: { url: 'https://node.example/tracks/cidstream/abc?signature=x' },
  ...extra,
})

test('a playable track becomes a record with a link back to Audius', () => {
  const record = normalizeTrack(track(), { streamUrl })
  assert.equal(record.id, 'audius:oWElNq5')
  assert.equal(record.title, 'Lofi Rain')
  assert.deepEqual(record.artists, [{ name: 'HYGH Lofi Music' }])
  assert.deepEqual(record.dates, { year: 2021 })
  assert.equal(record.source.name, 'Audius')
  assert.equal(record.source.url, 'https://audius.co/hyghlofimusic/hygh-lofi-music-lofi-rain-450091')
  assert.deepEqual(record.artwork, { origin: 'source', url: 'https://cn0.example/480x480.jpg' })
  assert.deepEqual(record.audioFormat, { playing: 'MP3' })
  assert.equal(record.description, 'Rain on a window.')
  assert.equal(record.tracks.length, 1)
  assert.equal(record.tracks[0].duration_s, 164)
})

test('audio is the API stream route, backed up by the signed node url', () => {
  const { audio } = normalizeTrack(track(), { streamUrl }).tracks[0]
  assert.equal(audio.url, streamUrl('oWElNq5'))
  assert.equal(audio.format, 'mp3')
  assert.deepEqual(audio.fallbacks, ['https://node.example/tracks/cidstream/abc?signature=x'])
})

test('a plain-http node url is not offered as a fallback', () => {
  const { audio } = normalizeTrack(track({ stream: { url: 'http://node.example/x' } }), { streamUrl }).tracks[0]
  assert.equal(audio.fallbacks, undefined)
})

test('artwork falls back to the large size, and is omitted when absent or not https', () => {
  const large = track({ artwork: { '1000x1000': 'https://cn0.example/1000x1000.jpg' } })
  assert.equal(normalizeTrack(large, { streamUrl }).artwork.url, 'https://cn0.example/1000x1000.jpg')
  assert.equal(normalizeTrack(track({ artwork: null }), { streamUrl }).artwork, undefined)
  assert.equal(normalizeTrack(track({ artwork: { '480x480': 'http://x/a.jpg' } }), { streamUrl }).artwork, undefined)
})

test('the artist falls back to the handle, and may be unknown', () => {
  assert.deepEqual(normalizeTrack(track({ user: { handle: 'someone' } }), { streamUrl }).artists, [{ name: 'someone' }])
  assert.deepEqual(normalizeTrack(track({ user: null }), { streamUrl }).artists, [])
})

test('tracks that cannot stream anonymously, or are too short, are dropped', () => {
  const drops = {
    'not streamable': { is_streamable: false },
    'stream denied': { access: { stream: false } },
    gated: { is_stream_gated: true },
    'stream conditions': { stream_conditions: { follow_user_id: 1 } },
    unlisted: { is_unlisted: true },
    deleted: { is_delete: true },
    unavailable: { is_available: false },
    'key restricted': { allowed_api_keys: ['0xabc'] },
    'a 12 second clip': { duration: 12 },
    'no title': { title: '  ' },
    'no id': { id: '' },
    'no permalink to link back to': { permalink: undefined },
    'a protocol-relative permalink': { permalink: '//evil.example/x' },
  }
  for (const [name, change] of Object.entries(drops)) {
    assert.equal(normalizeTrack(track(change), { streamUrl }), null, name)
  }
  assert.equal(normalizeTrack(null, { streamUrl }), null)
})

test('rights: all rights reserved, nothing, Creative Commons, and anything else', () => {
  assert.deepEqual(mapRights('All rights reserved'), {
    state: 'all_rights_reserved',
    short: 'All rights reserved',
    label: 'All rights reserved',
  })
  assert.equal(mapRights(null).state, 'unknown')
  assert.equal(mapRights('  ').label, 'Licence not stated')

  const by = mapRights('Attribution CC BY')
  assert.equal(by.state, 'licensed')
  assert.equal(by.short, 'CC BY')
  assert.deepEqual(by.terms, ['BY'])
  assert.equal(by.attribution_required, true)
  assert.equal(by.licence_url, undefined, 'Audius states no version, so no licence url is claimed')

  const nc = mapRights('Attribution-NonCommercial-NoDerivs CC BY-NC-ND')
  assert.deepEqual(nc.terms, ['BY', 'NC', 'ND'])
  assert.equal(nc.short, 'CC BY-NC-ND')
  assert.equal(nc.label, 'Attribution-NonCommercial-NoDerivs CC BY-NC-ND')

  assert.deepEqual(mapRights('Custom terms'), { state: 'unknown', short: 'Custom terms', label: 'Custom terms' })
})
