// Keeps lectures, sermons and readings out of a music app. Precision first: a wrong "spoken" verdict hides
// real music, while a miss only costs one skip. Measured on the music frame, "podcast" and the radio
// collections are mostly music (netlabel mixes, live broadcasts), so they are deliberately not signals.
import { asList } from '../text.js'

const SPOKEN_SUBJECT =
  /\b(spoken[- ]word|non-?music|audio ?books?|talking book|oral histor(?:y|ies)|lectures?|sermons?|poetry readings?|storytelling|radio (?:drama|play))\b/i
// Whole-subject matches only: "speech" inside "speech synthesis" is a music tag, not a spoken record
const SPOKEN_SUBJECT_EXACT = /^(speech(?:es)?|recitations?|monologues?)$/i
const SPOKEN_TITLE = /\b(lectures?|sermons?|interviews?|audio ?books?)\b/i
// TV-style numbering "(E01)" or "S02E05"; music mixes say "Episode 12" or "Podcast 012" instead
const EPISODE_TITLE = /\((?:S\d+\s?)?E\d+\)|\bS\d{1,2}\s?E\d{1,2}\b/
// A reading-and-poetry collection that also hosts live bands: only treat it as spoken without any music marker
const READING_COLLECTION = 'audio_bookspoetry'
const READING_SUBJECT = /\b(poetry|readings?|literature|short stories)\b/i
const MUSIC_SUBJECT = /\b(music|band|rock|folk|jazz|blues|songs?|concert|gig|punk|electronic)\b/i

// Whole collections of speech and field recordings that sit inside the music frame (measured on the live
// frame: ~7.9k community radio, ~4k nature soundscapes, ~2k dialect interviews, ~350 university podcasts)
const NON_MUSIC_COLLECTIONS = new Set([
  'mediasanctuaryaudio',
  'hamiltonbioacousticsfieldrecordings',
  'italian-dialect-collection',
  'du-participatory-archive',
])

const texts = (value) => asList(value).filter((v) => typeof v === 'string')

// Returns the reason a record reads as spoken word, or null when it should be kept
export function spokenReason(metadata) {
  const subjects = texts(metadata?.subject).flatMap((s) => s.split(/\s*;\s*/))
  const title = texts(metadata?.title)[0] ?? ''

  const collections = texts(metadata?.collection)
  const listed = collections.find((c) => NON_MUSIC_COLLECTIONS.has(c))
  if (listed) return `collection ${listed}`

  const subject = subjects.find((s) => SPOKEN_SUBJECT.test(s) || SPOKEN_SUBJECT_EXACT.test(s.trim()))
  if (subject) return `subject "${subject}"`
  if (SPOKEN_TITLE.test(title)) return 'title'
  if (EPISODE_TITLE.test(title)) return 'episode numbering'

  const reading = collections.includes(READING_COLLECTION)
  if (reading && subjects.some((s) => READING_SUBJECT.test(s)) && !subjects.some((s) => MUSIC_SUBJECT.test(s))) {
    return 'poetry or reading collection'
  }
  return null
}
