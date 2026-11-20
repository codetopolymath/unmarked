import { createStore } from '../core/store.js'
import { withTransition } from '../core/motion.js'
import { attributionText, displayArtist, displayTitle, trackTitle } from '../core/format.js'
import { deriveTheme } from '../services/palette.js'
import { snapshotOf } from '../services/library.js'

const SKIP_DELAY_MS = 2200
const HISTORY_LIMIT = 5000

// Wires state, actions and side-effect services. The UI only ever sees { store, clock, actions }.
export function createApp({ source, library, resolveArtwork, createPlayback, notify, announce, applyTheme }) {
  const stored = library.load()
  const prefs = { autoplay: true, autocontinue: false, audius: true, motion: 'system', ...library.loadPrefs() }

  const store = createStore({
    view: 'discover',
    libraryTab: 'kept',
    draw: { status: 'idle', number: (stored.history[0]?.number ?? 0) + 1, message: '' },
    viewed: null,
    stack: [],
    player: { record: null, trackIndex: 0, status: 'idle', error: '', volume: 0.8, muted: false, expanded: false },
    ui: {
      detailsOpen: false,
      detailsSection: null,
      prefsOpen: false,
      docsOpen: false,
      protoOpen: false,
      showAllTracks: false,
    },
    prefs,
    kept: stored.kept,
    history: stored.history,
  })
  const clock = createStore({ position: 0, duration: 0 })

  let drawController = null
  let skipTimer = 0

  const playback = createPlayback({
    onStatus: handlePlaybackStatus,
    onClock: (next) => clock.set(next),
    onEnded: () => actions.nextTrack({ fromEnded: true }),
    onNotice: notify,
  })
  playback.setVolume(store.get().player.volume)

  function handlePlaybackStatus({ status, error = '', blocked }) {
    store.update('player', { status, error })
    if (status === 'error') scheduleSkip()
    if (status === 'paused' && blocked) notify('Press play to start. The browser blocked autoplay.')
  }

  function scheduleSkip() {
    clearTimeout(skipTimer)
    skipTimer = setTimeout(() => {
      const { player } = store.get()
      if (player.status !== 'error' || !player.record) return
      notify('That track would not play. Skipping.')
      if (player.trackIndex < player.record.tracks.length - 1) actions.playTrack(player.record, player.trackIndex + 1)
      else store.update('player', { status: 'paused', error: '' })
    }, SKIP_DELAY_MS)
  }

  async function present(record, { origin, accession = null }) {
    const art = await resolveArtwork(record)
    const theme = deriveTheme(art.palette)
    const prepared = { ...record, art, theme, origin, accession }
    const previous = store.get().viewed
    applyTheme(theme)
    store.set((state) => ({
      viewed: prepared,
      stack: previous && previous.id !== prepared.id ? [...state.stack.slice(-19), previous] : state.stack,
      ui: { ...state.ui, showAllTracks: false, detailsOpen: false },
    }))
    retitle(prepared)
    return prepared
  }

  function retitle(record) {
    const artist = displayArtist(record)
    document.title = `${displayTitle(record)}${artist ? ` — ${artist}` : ''} · Unmarked`
  }

  function logHistory(record, number) {
    const entry = { ...snapshotOf(record), number, shownAt: Date.now(), played: false }
    const history = [entry, ...store.get().history].slice(0, HISTORY_LIMIT)
    store.set({ history })
    library.saveHistory(history)
  }

  function markPlayed(id) {
    const history = store.get().history
    const index = history.findIndex((entry) => entry.id === id)
    if (index < 0 || history[index].played) return
    const next = history.map((entry, i) => (i === index ? { ...entry, played: true } : entry))
    store.set({ history: next })
    library.saveHistory(next)
  }

  function syncMediaSession() {
    if (!('mediaSession' in navigator)) return
    const { player } = store.get()
    const record = player.record
    if (!record) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: trackTitle(record.tracks[player.trackIndex], player.trackIndex),
      artist: displayArtist(record) ?? '',
      album: displayTitle(record),
      artwork: [{ src: record.art.url, sizes: '720x720', type: 'image/jpeg' }],
    })
  }

  const actions = {
    async discover({ autoplay } = {}) {
      if (store.get().draw.status === 'drawing') return
      const shouldPlay = autoplay ?? store.get().prefs.autoplay
      drawController = new AbortController()
      const number = (store.get().history[0]?.number ?? 0) + 1
      store.update('draw', { status: 'drawing', number, message: '', attempt: null })
      announce('Drawing a new record')
      try {
        const record = await source.draw({
          signal: drawController.signal,
          current: store.get().viewed,
          onSkip: () => notify('A recording would not play. Drawing another.'),
          onAttempt: (attempt) => store.update('draw', { attempt }),
        })
        const prepared = await present(record, { origin: 'draw', accession: number })
        logHistory(prepared, number)
        store.update('draw', { status: 'ready', attempt: null })
        announce(
          `New record: ${displayTitle(prepared)}${displayArtist(prepared) ? ` by ${displayArtist(prepared)}` : ''}`,
        )
        if (shouldPlay) actions.playTrack(prepared, 0)
      } catch (error) {
        if (error.name === 'AbortError') return
        store.update('draw', { status: 'failed', message: error.message, attempt: null })
      }
    },

    previousDiscovery() {
      const { stack } = store.get()
      const previous = stack.at(-1)
      if (!previous) {
        notify('This is where the session began.')
        return
      }
      applyTheme(previous.theme)
      store.set((state) => ({
        viewed: previous,
        stack: state.stack.slice(0, -1),
        view: 'discover',
        draw: { ...state.draw, status: 'ready' },
        ui: { ...state.ui, showAllTracks: false, detailsOpen: false },
      }))
      retitle(previous)
    },

    async openRecord(id) {
      const record = await source.byId(id)
      if (!record) {
        notify('That record could not be opened right now.')
        return
      }
      const entry = store.get().history.find((item) => item.id === id)
      await present(structuredClone(record), { origin: 'library', accession: entry?.number ?? null })
      withTransition(() => store.set({ view: 'discover' }))
    },

    playTrack(record, index = 0) {
      const track = record.tracks[index]
      if (!track) return
      clearTimeout(skipTimer)
      store.update('player', { record, trackIndex: index, status: 'loading', error: '' })
      playback.load(track, { autoplay: true })
      syncMediaSession()
      markPlayed(record.id)
    },

    togglePlayViewed() {
      const { viewed, player } = store.get()
      if (!viewed) return
      if (player.record?.id === viewed.id) actions.togglePlayback()
      else actions.playTrack(viewed, 0)
    },

    togglePlayback() {
      const { player } = store.get()
      if (!player.record) return
      if (player.status === 'playing') playback.pause()
      else if (player.status === 'error') actions.playTrack(player.record, player.trackIndex)
      else playback.play()
    },

    nextTrack({ fromEnded = false } = {}) {
      const { player, prefs: current } = store.get()
      if (!player.record) return
      if (player.trackIndex < player.record.tracks.length - 1) {
        actions.playTrack(player.record, player.trackIndex + 1)
        return
      }
      if (fromEnded && !current.autocontinue) {
        store.update('player', { status: 'paused' })
        notify('The record has finished. Press D to discover another.')
        return
      }
      actions.discover({ autoplay: true })
    },

    prevTrack() {
      const { player } = store.get()
      if (!player.record) return
      if (playback.position > 3 || player.trackIndex === 0) playback.seek(0)
      else actions.playTrack(player.record, player.trackIndex - 1)
    },

    seek: (seconds) => playback.seek(seconds),

    setVolume(volume) {
      playback.setVolume(volume)
      playback.setMuted(false)
      store.update('player', { volume, muted: false })
    },

    toggleMute() {
      const muted = !store.get().player.muted
      playback.setMuted(muted)
      store.update('player', { muted })
    },

    toggleKeep(record = store.get().viewed) {
      if (!record) return
      const { kept } = store.get()
      const exists = kept.some((entry) => entry.id === record.id)
      const next = exists
        ? kept.filter((entry) => entry.id !== record.id)
        : [{ ...snapshotOf(record), savedAt: Date.now() }, ...kept]
      store.set({ kept: next })
      library.saveKept(next)
      notify(exists ? 'Removed from Kept' : 'Kept')
    },

    showLibrary(tab = store.get().libraryTab) {
      withTransition(() => store.set({ view: 'library', libraryTab: tab }))
    },

    showSources() {
      withTransition(() => store.set({ view: 'sources' }))
    },

    showDiscover() {
      withTransition(() => store.set({ view: 'discover' }))
    },

    clearHistory() {
      store.set({ history: [] })
      library.saveHistory([])
      notify('History cleared')
    },

    exportLibrary: () => library.exportJson(store.get()),

    importLibrary(text) {
      const data = library.parseImport(text)
      const { kept, history } = store.get()
      const keptIds = new Set(kept.map((entry) => entry.id))
      const mergedKept = [...kept, ...data.kept.filter((entry) => !keptIds.has(entry.id))]
      const mergedHistory = [...history, ...data.history].sort((a, b) => b.shownAt - a.shownAt).slice(0, HISTORY_LIMIT)
      store.set({ kept: mergedKept, history: mergedHistory })
      library.saveKept(mergedKept)
      library.saveHistory(mergedHistory)
      notify(`Imported ${data.kept.length} kept and ${data.history.length} history entries`)
    },

    openDetails: (section = null) => store.update('ui', { detailsOpen: true, detailsSection: section }),
    closeDetails: () => store.update('ui', { detailsOpen: false }),
    togglePrefs: () => store.update('ui', { prefsOpen: !store.get().ui.prefsOpen }),
    closePrefs: () => store.update('ui', { prefsOpen: false }),
    // Opening docs closes the preferences popover it is launched from, so the two never stack
    openDocs: () => store.update('ui', { docsOpen: true, prefsOpen: false }),
    closeDocs: () => store.update('ui', { docsOpen: false }),
    toggleProto: () => store.update('ui', { protoOpen: !store.get().ui.protoOpen }),
    toggleShowAllTracks: () => store.update('ui', { showAllTracks: !store.get().ui.showAllTracks }),

    expandPlayer() {
      if (!store.get().player.record) return
      withTransition(() => store.update('player', { expanded: true }))
    },
    collapsePlayer() {
      withTransition(() => store.update('player', { expanded: false }))
    },

    setPref(key, value) {
      const next = { ...store.get().prefs, [key]: value }
      store.set({ prefs: next })
      library.savePrefs(next)
    },

    async copyCredit() {
      const { viewed } = store.get()
      if (!viewed) return
      try {
        await navigator.clipboard.writeText(attributionText(viewed))
        notify('Credit line copied')
      } catch {
        notify('Could not copy. Select the text instead.')
      }
    },

    // Prototype-only helpers, used by the proto panel and URL scenarios
    proto: {
      seedDemoLibrary() {
        const all = source.all().filter((r) => r.availability.status === 'ok')
        const now = Date.now()
        const hours = 3600000
        // Fixed order so the demo shows a mix of kept, played and skipped records
        const order = [4, 1, 9, 0, 6, 2, 11, 5, 8, 3, 12, 7, 10, 1, 6, 0, 9, 4]
        const history = order.map((position, i) => ({
          ...snapshotOf(all[position % all.length]),
          number: order.length - i,
          shownAt: now - i * 3.1 * hours - (i > 5 ? 24 * hours : 0) - (i > 11 ? 24 * hours : 0),
          played: i % 4 !== 1,
        }))
        const kept = [0, 1, 2, 4, 5, 6, 7].map((position, i) => ({
          ...snapshotOf(all[position % all.length]),
          savedAt: now - i * 500000,
        }))
        store.set({ kept, history, draw: { ...store.get().draw, number: 19 } })
        library.saveKept(kept)
        library.saveHistory(history)
      },
      resetLibrary() {
        library.clear()
        store.set({ kept: [], history: [], draw: { ...store.get().draw, number: 1 } })
      },
      seekToEnd: (seconds = 5) => playback.seek(playback.duration - seconds),
      seekRatio: (ratio) => playback.seek(playback.duration * ratio),
    },
  }

  function init() {
    if (!('mediaSession' in navigator)) return
    const handlers = {
      play: () => actions.togglePlayback(),
      pause: () => actions.togglePlayback(),
      previoustrack: () => actions.prevTrack(),
      nexttrack: () => actions.nextTrack(),
      seekto: (details) => actions.seek(details.seekTime),
    }
    for (const [name, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(name, handler)
      } catch {
        // Action not supported by this browser
      }
    }
  }

  return { store, clock, actions, init }
}
