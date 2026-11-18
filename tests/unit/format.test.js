import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  accession,
  attributionText,
  dayLabel,
  detailSections,
  displayArtist,
  displayTitle,
  factsFor,
  formatCount,
  formatTime,
  titleLength,
  trackTitle,
} from '../../src/js/core/format.js'

const track = (title, duration_s) => ({ title, duration_s })
const rights = { state: 'unknown', label: 'Licence not stated' }
const base = (overrides = {}) => ({
  id: 'x:1',
  kind: 'album',
  title: 'Title',
  source: { name: 'Source', url: '#', item_id: '1' },
  tracks: [track('One', 100), track('Two', 100)],
  rights,
  ...overrides,
})

test('formatTime renders m:ss and h:mm:ss, and nothing for bad input', () => {
  assert.equal(formatTime(184), '3:04')
  assert.equal(formatTime(0), '0:00')
  assert.equal(formatTime(3725), '1:02:05')
  assert.equal(formatTime(Number.NaN), '')
  assert.equal(formatTime(-1), '')
  assert.equal(formatTime(undefined), '')
})

test('formatCount groups thousands', () => {
  assert.equal(formatCount(932104), '932,104')
})

test('accession pads to six digits', () => {
  assert.equal(accession(21), '000021')
})

test('titleLength buckets by code points, not UTF-16 units', () => {
  assert.equal(titleLength('a'.repeat(22)), 'short')
  assert.equal(titleLength('a'.repeat(23)), 'medium')
  assert.equal(titleLength('a'.repeat(48)), 'medium')
  assert.equal(titleLength('a'.repeat(49)), 'long')
  assert.equal(titleLength('録'.repeat(22)), 'short')
  assert.equal(titleLength('😀'.repeat(22)), 'short')
})

test('displayTitle falls back to the first track, then to a generic label', () => {
  assert.equal(displayTitle(base({ title: '  Salt  ' })), 'Salt')
  assert.equal(displayTitle(base({ title: undefined, tracks: [track('First track')] })), 'First track')
  assert.equal(displayTitle(base({ title: ' ', tracks: [track(undefined)] })), 'Untitled recording')
})

test('displayArtist joins names and returns null when none are stated', () => {
  assert.equal(displayArtist(base({ artists: [{ name: 'A' }, { name: ' B ' }] })), 'A, B')
  assert.equal(displayArtist(base({ artists: [{ name: ' ' }] })), null)
  assert.equal(displayArtist(base()), null)
})

test('trackTitle falls back to a numbered label', () => {
  assert.equal(trackTitle(track('Song'), 0), 'Song')
  assert.equal(trackTitle(track(undefined), 2), 'Track 3')
})

test('factsFor lists only what the record states', () => {
  const full = base({ dates: { year: 1974 }, place: { region: 'Port Vellum' } })
  assert.deepEqual(
    factsFor(full).map((f) => f.key),
    ['year', 'origin', 'tracks'],
  )
  assert.equal(factsFor(full).at(-1).text, '2 tracks')

  const single = base({ tracks: [track('One', 10)] })
  assert.equal(factsFor(single).at(-1).text, '1 track')

  const recording = base({
    kind: 'recording',
    dates: { recording_date: '1926-06-18', year: 1926 },
    tracks: [track('S', 184)],
  })
  assert.deepEqual(
    factsFor(recording).map((f) => f.text),
    ['Recorded 1926-06-18', '3:04'],
  )
})

test('factsFor is empty for a bare recording with no duration', () => {
  assert.deepEqual(factsFor(base({ kind: 'recording', tracks: [track('S')] })), [])
})

test('detailSections omits empty sections but always keeps source and rights', () => {
  // No durations either, otherwise a runtime row correctly appears
  const bare = detailSections(base({ tracks: [track('One'), track('Two')] }))
  assert.deepEqual(
    bare.map((s) => s.id),
    ['source', 'rights'],
  )

  const rich = detailSections(
    base({ description: 'Text', tags: ['a'], dates: { year: 1990 }, language: ['English'], credits: { label: 'L' } }),
  )
  assert.deepEqual(
    rich.map((s) => s.id),
    ['about', 'record', 'source', 'rights'],
  )
  assert.ok(rich.find((s) => s.id === 'record').rows.every((row) => row.value))
})

test('rights section shows a credit line only when attribution is required and always ends with the reuse warning', () => {
  const plain = detailSections(base()).find((s) => s.id === 'rights').rows
  assert.ok(!plain.some((row) => row.kind === 'credit'))
  assert.equal(plain.at(-1).kind, 'fineprint')

  const licensed = detailSections(
    base({ rights: { state: 'licensed', label: 'CC BY', terms: ['BY', 'NC'], attribution_required: true } }),
  ).find((s) => s.id === 'rights').rows
  assert.ok(licensed.some((row) => row.kind === 'credit'))
  assert.match(licensed.find((row) => row.label === 'Terms').value, /Credit the creator; Non-commercial/)
})

test('attributionText prefers an explicit credit and otherwise builds one', () => {
  assert.equal(attributionText(base({ rights: { ...rights, attribution_text: 'Given' } })), 'Given')
  const built = attributionText(base({ artists: [{ name: 'Ann' }], rights: { ...rights, short: 'CC BY 4.0' } }))
  assert.equal(built, '“Title” by Ann via Source (CC BY 4.0)')
})

test('dayLabel names today and yesterday, then dates', () => {
  const now = new Date(2026, 10, 18, 15).getTime()
  assert.equal(dayLabel(new Date(2026, 10, 18, 1).getTime(), now), 'Today')
  assert.equal(dayLabel(new Date(2026, 10, 17, 23).getTime(), now), 'Yesterday')
  assert.match(dayLabel(new Date(2026, 10, 10).getTime(), now), /2026/)
})
