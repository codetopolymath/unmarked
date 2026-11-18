import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { licenceFileName, parseLicenceTable, rightsFromTracks } from '../../src/js/data/ia/jamendo.js'
import { createIaSource } from '../../src/js/data/ia/ia-source.js'
import { downloadUrl } from '../../src/js/data/ia/normalize.js'

const jamendo = JSON.parse(readFileSync(new URL('../fixtures/ia/jamendo.json', import.meta.url), 'utf8'))
const netlabel = JSON.parse(readFileSync(new URL('../fixtures/ia/netlabel.json', import.meta.url), 'utf8'))

// Real file, as served (CRLF-free here; the parser accepts both)
const TABLE = `Track      |   License URL
----------------------------------------------
 01        |   http://creativecommons.org/licenses/by-nc-nd/2.0/fr/
 02        |   http://creativecommons.org/licenses/by-nc-nd/2.0/fr/
 artwork   |   http://creativecommons.org/licenses/by-sa/2.0/fr/
`

test('the track licences are read; the artwork row is not part of the music licence', () => {
  assert.deepEqual(parseLicenceTable(TABLE), [
    'http://creativecommons.org/licenses/by-nc-nd/2.0/fr/',
    'http://creativecommons.org/licenses/by-nc-nd/2.0/fr/',
  ])
  assert.deepEqual(parseLicenceTable(TABLE.replace(/\n/g, '\r\n')).length, 2)
  assert.deepEqual(parseLicenceTable('nothing useful here'), [])
  assert.deepEqual(parseLicenceTable(''), [])
})

test('one licence for every track maps like any Creative Commons URL', () => {
  const rights = rightsFromTracks(parseLicenceTable(TABLE))
  assert.equal(rights.short, 'CC BY-NC-ND 2.0')
  assert.deepEqual(rights.terms, ['BY', 'NC', 'ND'])
  assert.equal(rights.attribution_required, true)
  assert.equal(rights.licence_url, 'https://creativecommons.org/licenses/by-nc-nd/2.0/fr/')
})

test('tracks under different licences show the union of their restrictions', () => {
  const rights = rightsFromTracks([
    'http://creativecommons.org/licenses/by/3.0/',
    'http://creativecommons.org/licenses/by-nc-sa/3.0/',
  ])
  assert.equal(rights.state, 'licensed')
  assert.deepEqual(rights.terms, ['BY', 'NC', 'SA'])
  assert.equal(rights.short, 'CC BY-NC-SA (varies by track)')
  assert.equal(rights.attribution_required, true)
})

test('no rows, or a licence we cannot interpret among several, yields nothing rather than a guess', () => {
  assert.equal(rightsFromTracks([]), null)
  assert.equal(rightsFromTracks(['http://creativecommons.org/licenses/by/3.0/', 'https://example.com/terms']), null)
})

test('only Jamendo items without a licence already are read', () => {
  assert.equal(licenceFileName(jamendo), 'License.txt')
  assert.equal(licenceFileName(netlabel), null, 'not from Jamendo')
  const stated = structuredClone(jamendo)
  stated.metadata.licenseurl = 'https://creativecommons.org/licenses/by/4.0/'
  assert.equal(licenceFileName(stated), null, 'metadata already has one')
  assert.equal(licenceFileName({ metadata: { collection: 'jamendo-albums' }, files: [{ name: 'a.mp3' }] }), null)
  assert.equal(licenceFileName(undefined), null)
  const lower = structuredClone(jamendo)
  lower.files.find((f) => f.name === 'License.txt').name = 'LICENSE.TXT'
  assert.equal(licenceFileName(lower), 'LICENSE.TXT')
})

test('downloadUrl encodes names and keeps folders', () => {
  assert.equal(downloadUrl('item id', 'sub dir/a b.txt'), 'https://archive.org/download/item%20id/sub%20dir/a%20b.txt')
})

// The source reads the file once per Jamendo record and falls back to "not stated" when it cannot
function fakeClient({ reply, tableText, textError }) {
  const calls = { text: [] }
  return {
    calls,
    async search() {
      return { total: 1, docs: [{ identifier: reply.metadata.identifier, subject: ['Jazz'] }] }
    },
    async metadata() {
      return reply
    },
    async text(url) {
      calls.text.push(url)
      if (textError) throw textError
      return tableText
    },
    async probe() {
      return { ok: true, status: 206, ranges: true }
    },
  }
}
const MAP = { noDate: 0, windows: [['2020-01-01T00:00:00Z', '2020-12-31T23:59:59Z', 1]] }
const make = (client) => createIaSource({ map: MAP, client, bufferSize: 0, random: () => 0 })

test('a drawn Jamendo record shows its real licence', async () => {
  const client = fakeClient({ reply: jamendo, tableText: TABLE })
  const record = await make(client).draw()
  assert.equal(record.rights.short, 'CC BY-NC-ND 2.0')
  assert.equal(record.rights.state, 'licensed')
  assert.deepEqual(client.calls.text, ['https://archive.org/download/jamendo-008969/License.txt'])
})

test('reopening a Jamendo record from the library also resolves its licence', async () => {
  const client = fakeClient({ reply: jamendo, tableText: TABLE })
  const record = await make(client).byId('ia:jamendo-008969')
  assert.equal(record.rights.short, 'CC BY-NC-ND 2.0')
})

test('an unreadable licence file leaves the record playable with "Licence not stated"', async () => {
  const failing = fakeClient({ reply: jamendo, textError: new Error('503') })
  const record = await make(failing).draw()
  assert.equal(record.rights.short, 'Licence not stated')
  assert.equal(record.tracks.length, 8)
  const garbage = fakeClient({ reply: jamendo, tableText: '<html>busy</html>' })
  assert.equal((await make(garbage).draw()).rights.short, 'Licence not stated')
})

test('items from other collections never trigger the extra request', async () => {
  const client = fakeClient({ reply: netlabel, tableText: TABLE })
  await make(client).draw()
  assert.deepEqual(client.calls.text, [])
})

test('an abort while reading the licence is not swallowed', async () => {
  const client = fakeClient({ reply: jamendo, textError: new DOMException('stop', 'AbortError') })
  await assert.rejects(make(client).draw(), { name: 'AbortError' })
})
