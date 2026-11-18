import { SOURCES } from '../sources-catalog.js'

// Catalogue id -> Internet Archive collection id. Collections overlap (78rpm sits inside audio_music).
export const IA_COLLECTIONS = {
  'ia-audio-music': 'audio_music',
  'ia-78rpm': '78rpm',
  'ia-jamendo-albums': 'jamendo-albums',
  'ia-georgeblood': 'georgeblood',
  'ia-netlabels': 'netlabels',
  'ia-vaporwave': 'vaporwave',
  'ia-album-recordings': 'album_recordings',
  'ia-unlockedrecordings': 'unlockedrecordings',
  'ia-freemusicarchive': 'freemusicarchive',
  'ia-contemporary': 'archiveofcontemporarymusic',
  'ia-hiphopmixtapes': 'hiphopmixtapes',
}

// Derived from the status board so a source turned green there joins the draw
export function frameQuery(sources = SOURCES, collections = IA_COLLECTIONS) {
  const ids = sources
    .filter((source) => source.group === 'internet-archive' && source.status === 'selected')
    .map((source) => collections[source.id])
  if (ids.some((id) => !id)) throw new Error('A selected Internet Archive source has no collection id')
  return `collection:(${ids.join(' OR ')}) AND mediatype:audio`
}

export const FRAME_QUERY = frameQuery()
