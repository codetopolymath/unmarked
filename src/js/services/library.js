import { displayArtist, displayTitle } from '../core/format.js'

const KEYS = {
  kept: 'unmarked.v1.kept',
  history: 'unmarked.v1.history',
  prefs: 'unmarked.v1.prefs',
}
const HISTORY_CAP = 5000

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

// Small stored copy so Kept and History render even if the source later changes
export function snapshotOf(record) {
  return {
    id: record.id,
    kind: record.kind,
    title: displayTitle(record),
    artist: displayArtist(record),
    year: record.dates?.year ?? null,
    artwork: { origin: record.artwork?.origin ?? 'generated', spec: record.artwork?.spec ?? null },
    source: { name: record.source.name },
  }
}

export function createLibrary() {
  return {
    load: () => ({ kept: read(KEYS.kept, []), history: read(KEYS.history, []) }),
    saveKept: (list) => write(KEYS.kept, list),
    saveHistory: (list) => write(KEYS.history, list.slice(0, HISTORY_CAP)),
    loadPrefs: () => read(KEYS.prefs, {}),
    savePrefs: (prefs) => write(KEYS.prefs, prefs),
    clear() {
      for (const key of [KEYS.kept, KEYS.history]) localStorage.removeItem(key)
    },
    exportJson: ({ kept, history }) =>
      JSON.stringify({ app: 'unmarked', version: 1, exportedAt: new Date().toISOString(), kept, history }, null, 2),
    parseImport(text) {
      const data = JSON.parse(text)
      if (data?.app !== 'unmarked' || !Array.isArray(data.kept) || !Array.isArray(data.history)) {
        throw new Error('This file is not an Unmarked export')
      }
      return { kept: data.kept, history: data.history }
    },
  }
}
