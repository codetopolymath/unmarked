// Jamendo albums mirrored on the Archive state their Creative Commons licence in a License.txt table inside
// the item, never in the metadata. Measured on 44 items old and new: one licence per album, every item has the file.
import { mapLicenceUrl } from '../licence.js'
import { asList } from '../text.js'

const COLLECTION = 'jamendo-albums'
const LICENCE_FILE = /^license\.txt$/i
// "01        |   http://creativecommons.org/licenses/by-nc-sa/2.5/it/"
const ROW = /^\s*(\S+)\s*\|\s*(https?:\/\/\S+)\s*$/
const TERM_ORDER = ['BY', 'NC', 'ND', 'SA']

// Name of the licence file to read, or null when the item has a licence already or is not from Jamendo
export function licenceFileName(reply) {
  const metadata = reply?.metadata
  if (!asList(metadata?.collection).includes(COLLECTION) || asList(metadata?.licenseurl).length) return null
  return reply.files?.find((file) => LICENCE_FILE.test(file.name))?.name ?? null
}

// Track licences in file order; the "artwork" row licenses the cover, not the music
export function parseLicenceTable(text) {
  const tracks = []
  for (const line of String(text).split(/\r?\n/)) {
    const row = line.match(ROW)
    if (row && row[1].toLowerCase() !== 'artwork') tracks.push(row[2])
  }
  return tracks
}

// One shared licence maps as usual; tracks that differ are shown as the union of their restrictions
export function rightsFromTracks(urls) {
  if (!urls.length) return null
  const unique = [...new Set(urls)]
  if (unique.length === 1) return mapLicenceUrl(unique[0])

  const all = unique.map(mapLicenceUrl)
  if (all.some((rights) => rights.state !== 'licensed')) return null
  const terms = TERM_ORDER.filter((term) => all.some((rights) => rights.terms.includes(term)))
  return {
    state: 'licensed',
    short: `CC ${terms.join('-')} (varies by track)`,
    label: 'Creative Commons, terms vary by track',
    terms,
    licence_url: all[0].licence_url,
    attribution_required: terms.includes('BY'),
  }
}
