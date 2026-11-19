import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeFile } from '../../src/js/data/commons/normalize.js'

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/commons/${name}.json`, import.meta.url), 'utf8'))

// Smallest valid page, overridable per test
function page(info = {}, extmetadata = {}) {
  return {
    pageid: 7,
    title: 'File:Some_Tune.ogg',
    videoinfo: [
      {
        mediatype: 'AUDIO',
        mime: 'audio/mpeg',
        duration: 120,
        url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Some_Tune.mp3?utm_source=x',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Some_Tune.ogg?utm=1',
        derivatives: [],
        extmetadata: Object.fromEntries(Object.entries(extmetadata).map(([k, value]) => [k, { value }])),
        ...info,
      },
    ],
  }
}

test('an MP3 original plays as is, with its licence URL mapped', () => {
  const record = normalizeFile(fixture('mp3'))
  assert.equal(record.id, 'commons:67535745')
  assert.equal(record.kind, 'recording')
  assert.equal(record.tracks[0].audio.url, 'https://upload.wikimedia.org/wikipedia/commons/7/7e/NocturneOp9No2.mp3')
  assert.equal(record.tracks[0].duration_s, 272)
  assert.deepEqual(record.artists, [{ name: 'Frederic Chopin' }])
  assert.equal(record.rights.state, 'public_domain')
  assert.equal(record.rights.short, 'CC0 1.0')
  assert.equal(record.source.name, 'Wikimedia Commons')
  assert.equal(record.source.url, 'https://commons.wikimedia.org/wiki/File:NocturneOp9No2.mp3')
  assert.equal(record.availability.status, 'ok')
})

test('an Ogg original is replaced by its MP3 transcode so Safari can play it', () => {
  const record = normalizeFile(fixture('ogg'))
  assert.match(record.tracks[0].audio.url, /\/transcoded\/.+\.mp3$/)
  assert.equal(record.tracks[0].audio.format, 'mp3')
  assert.equal(record.dates.year, 1940)
  assert.deepEqual(record.artists, [{ name: 'Makemi/Woody Guthrie' }])
})

test('WAV and FLAC originals are never streamed; their MP3 transcode is', () => {
  for (const name of ['wav', 'flac']) {
    const url = normalizeFile(fixture(name)).tracks[0].audio.url
    assert.match(url, /\/transcoded\/.+\.mp3$/, name)
    assert.doesNotMatch(url, /\?/, 'tracking query string is stripped')
  }
})

test('each file falls back to its other small format, and never to a huge WAV or FLAC original', () => {
  const urls = (name) => {
    const { audio } = normalizeFile(fixture(name)).tracks[0]
    return { url: audio.url, fallbacks: audio.fallbacks ?? [] }
  }
  const mp3 = urls('mp3')
  assert.equal(mp3.fallbacks.length, 1)
  assert.match(mp3.fallbacks[0], /\/transcoded\/.+\.ogg$/, 'an MP3 original backs up to its Ogg transcode')

  const ogg = urls('ogg')
  assert.match(ogg.url, /\.mp3$/)
  assert.equal(ogg.fallbacks.length, 1)
  assert.match(
    ogg.fallbacks[0],
    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[0-9a-f]\/[0-9a-f]{2}\/This_Land_is_Your_Land\.ogg$/,
  )

  for (const name of ['wav', 'flac']) {
    const big = urls(name)
    assert.match(big.url, /\.mp3$/, name)
    assert.ok(big.fallbacks.length >= 1 && big.fallbacks.every((u) => /\/transcoded\/.+\.ogg$/.test(u)), name)
    assert.ok(!big.fallbacks.some((u) => /\.(wav|flac)$/i.test(u)), `${name} original is never a fallback`)
  }
  for (const u of Object.values(['mp3', 'ogg', 'wav', 'flac']).flatMap((n) => urls(n).fallbacks))
    assert.doesNotMatch(u, /\?/)
})

test('an Ogg original with no transcode has nothing to fall back to', () => {
  const record = normalizeFile({
    pageid: 3,
    title: 'File:a.ogg',
    videoinfo: [
      { mediatype: 'AUDIO', mime: 'application/ogg', duration: 90, url: 'https://u.example/a.ogg', derivatives: [] },
    ],
  })
  assert.equal(record.tracks[0].audio.fallbacks, undefined)
})

test('a file re-hosted from the Internet Archive names its original, for dedupe', () => {
  const record = normalizeFile(fixture('flac'))
  assert.equal(record.duplicateOf, 'ia:78_homesick_marion-harris-irving-belrin_gbia0003623a')
  assert.deepEqual(record.artists, [])
})

test('files that should not be shown normalize to null', () => {
  assert.equal(normalizeFile(page({ duration: 29 })), null, 'too short')
  assert.equal(normalizeFile(page({ duration: undefined })), null, 'no duration')
  assert.equal(normalizeFile(page({ mediatype: 'BITMAP' })), null, 'not audio')
  assert.equal(normalizeFile(page({ mime: 'audio/wav', derivatives: [] })), null, 'wav without a transcode')
  assert.equal(normalizeFile(page({ mime: 'audio/midi', derivatives: [] })), null, 'midi')
  assert.equal(normalizeFile({ pageid: 1, title: 'File:x', missing: true }), null)
  assert.equal(normalizeFile(null), null)
})

test('an Ogg with no transcode still plays directly', () => {
  const record = normalizeFile(page({ mime: 'application/ogg', url: 'https://u.example/a.ogg?x=1' }))
  assert.equal(record.tracks[0].audio.url, 'https://u.example/a.ogg')
  assert.equal(record.tracks[0].audio.format, 'ogg')
})

test('titles fall back to the file name; blurbs are not mistaken for artists', () => {
  const plain = normalizeFile(page())
  assert.equal(plain.title, 'Some Tune')
  assert.deepEqual(plain.artists, [])
  assert.equal(plain.description, undefined)
  const blurb = normalizeFile(page({}, { Artist: `Created by someone. ${'Released under a licence. '.repeat(10)}` }))
  assert.deepEqual(blurb.artists, [])
  const named = normalizeFile(
    page(
      {},
      { ObjectName: '\nA <b>Good</b> Name', Artist: '<a href="x">Ada</a>', ImageDescription: '<p>One</p><p>Two</p>' },
    ),
  )
  assert.equal(named.title, 'A Good Name')
  assert.deepEqual(named.artists, [{ name: 'Ada' }])
  assert.equal(named.description, 'One Two')
})

test('licences: CC URL, public domain by name, attribution flag, and honest unknowns', () => {
  const cc = normalizeFile(
    page({}, { LicenseUrl: 'http://creativecommons.org/licenses/by-sa/3.0', LicenseShortName: 'CC BY-SA 3.0' }),
  )
  assert.deepEqual(cc.rights.terms, ['BY', 'SA'])
  assert.equal(cc.rights.attribution_required, true)
  assert.equal(normalizeFile(page({}, { LicenseShortName: 'Public domain' })).rights.state, 'public_domain')
  const flagged = normalizeFile(page({}, { LicenseShortName: 'Custom', AttributionRequired: 'true' }))
  assert.equal(flagged.rights.state, 'unknown')
  assert.equal(flagged.rights.short, 'Custom')
  assert.equal(flagged.rights.attribution_required, true)
  assert.equal(normalizeFile(page()).rights.short, 'Licence not stated')
})
