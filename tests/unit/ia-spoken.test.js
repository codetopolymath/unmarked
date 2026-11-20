import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spokenReason } from '../../src/js/data/ia/spoken.js'

// Real shapes seen on the live frame: subject and collection are strings or arrays, sometimes ';'-joined
const spoken = (metadata) => Boolean(spokenReason(metadata))

test('the archive\'s own "Non-Music" and spoken-word catalogue tags are spoken', () => {
  assert.ok(spoken({ title: 'Oliver Twist', subject: ['Non-Music', 'Drama'] }))
  assert.ok(spoken({ title: 'Psychiatric Consultations No. 1', subject: 'Non-Music;Spoken Word;Medical Lecture' }))
  assert.ok(spoken({ title: 'Descubrimiento de América', subject: ['ethnic spoken word'] }))
})

test('lectures, sermons, speeches and interviews are spoken', () => {
  assert.ok(spoken({ title: 'Alice Neel Lecture, 1981' }))
  assert.ok(spoken({ title: 'Rev. J. M. Gates - Need Of Prayer', subject: ['Sermon', 'gospel'] }))
  assert.ok(spoken({ title: "ROBERT EMMET'S SPEECH FROM THE BOOK", subject: ['78rpm', 'Speech'] }))
  assert.ok(spoken({ title: 'Chris Hand interviews Eric Waugh' }))
})

test('a subject that merely contains "speech" is not a spoken record', () => {
  assert.equal(spokenReason({ title: 'Machine Language', subject: ['experimental', 'speech synthesis'] }), null)
})

test('TV-style episode numbering is spoken; music-mix numbering is not', () => {
  assert.ok(spoken({ title: 'The Threevengers || Fast Favorites (E01)' }))
  assert.ok(spoken({ title: 'Tales from the Haunted Forest S01E04' }))
  assert.equal(spokenReason({ title: 'Jumble 12', subject: ['Podcast', 'Beats'] }), null)
  assert.equal(spokenReason({ title: 'Podcast 012 - Deep House Mix' }), null)
  assert.equal(spokenReason({ title: 'Episode 12', subject: 'Podcast' }), null)
})

test('"podcast" and the radio collections alone are music here, not spoken', () => {
  assert.equal(spokenReason({ title: 'Passage - Yuri', subject: ['Passage', 'Ambient', 'Podcast'] }), null)
  assert.equal(
    spokenReason({ title: "Led Zeppelin L'Olympia Paris 1969", collection: ['fmradioarchive', 'radioprograms'] }),
    null,
  )
  assert.equal(spokenReason({ title: 'TimTaj - Event (60 Sec)', subject: 'corporate;podcast;neutral' }), null)
})

test('the poetry collection is spoken only without a music marker', () => {
  const zeke = (title, subject) => ({ title, collection: ['zekesgallery', 'audio_bookspoetry'], subject })
  assert.ok(spoken(zeke("Sonja Skarstedt reading at Zeke's Gallery", ['Montreal', 'Poetry', 'Performance'])))
  assert.equal(
    spokenReason(zeke("Space Captain live at Zeke's Gallery", ['Montreal', 'Live Music', 'Rock and Roll'])),
    null,
  )
  assert.equal(spokenReason(zeke('Alysse Rich', ['Folk Music', 'Poetry'])), null)
  assert.equal(spokenReason({ title: 'A poem', subject: ['Poetry'] }), null, 'poetry alone, outside that collection')
})

test('whole non-music collections are rejected', () => {
  for (const collection of [
    'mediasanctuaryaudio',
    'hamiltonbioacousticsfieldrecordings',
    'italian-dialect-collection',
  ]) {
    assert.match(spokenReason({ title: 'x', collection: [collection, 'audio_music'] }), /collection/)
  }
})

test('ordinary music, and records with no metadata at all, are kept', () => {
  assert.equal(
    spokenReason({ title: 'Symphony No. 5', subject: ['Classical', 'Romantic'], collection: 'album_recordings' }),
    null,
  )
  assert.equal(spokenReason({ title: 'Talking Heads - Live', subject: 'rock' }), null)
  assert.equal(spokenReason({ identifier: 'bare' }), null)
  assert.equal(spokenReason(undefined), null)
  assert.equal(spokenReason({ title: ['Lecture Recital for Piano'] }) !== null, true, 'title as an array is still read')
})

test('a clearly spoken genre is spoken, matched on the whole value', () => {
  assert.match(spokenReason({ title: 'DAS HAUS', subject: '78rpm', genre: 'Language' }), /^genre/)
  assert.ok(spoken({ title: 'Can God', genre: 'Sermon' }))
  assert.ok(spoken({ title: 'x', genre: ['Folk', 'Spoken Word'] }))
  assert.ok(spoken({ title: 'x', genre: 'Speech; Political' }))
})

test('music genres, and genres that only contain a spoken word, are kept', () => {
  for (const genre of ['Popular Music', 'Polka', 'Jazz', ['Folk, World, & Country', 'Canzone Napoletana'], 'Story']) {
    assert.equal(spokenReason({ title: 'x', genre }), null)
  }
  assert.equal(spokenReason({ title: 'x', genre: 'Language of Love' }), null)
  assert.equal(spokenReason({ title: 'x', genre: 'Speech Therapy Blues' }), null)
})
