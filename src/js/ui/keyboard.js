const OWN_ARROWS = '[role="slider"], [role="tab"], input[type="range"], input[type="checkbox"]'

export function bindKeyboard({ store, actions, mode }) {
  // The same key opens a view and, pressed again, returns to discovery
  function toggleView(state, view, open) {
    if (state.view === view) actions.showDiscover()
    else open()
  }

  function closeTopOverlay(state) {
    if (state.ui.prefsOpen) actions.closePrefs()
    else if (state.ui.docsOpen) actions.closeDocs()
    else if (state.ui.detailsOpen) actions.closeDetails()
    else if (state.player.expanded) actions.collapsePlayer()
    else if (state.ui.protoOpen) actions.toggleProto()
    else if (state.view !== 'discover') actions.showDiscover()
  }

  addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.target.closest('input:not([type="range"]):not([type="checkbox"]), textarea, select, [contenteditable]'))
      return

    const state = store.get()
    const { key } = event
    const interactive = event.target.closest('button, a, [role="slider"], [role="tab"], input')

    if (key === 'Escape') {
      closeTopOverlay(state)
      return
    }
    // Native buttons and controls keep Space and Enter
    if (key === ' ') {
      if (interactive) return
      event.preventDefault()
      if (state.view === 'discover' && state.viewed && !state.player.expanded) actions.togglePlayViewed()
      else actions.togglePlayback()
      return
    }
    if (key === 'ArrowRight' || key === 'ArrowLeft') {
      if (event.target.closest(OWN_ARROWS) || !state.player.record) return
      event.preventDefault()
      // Past the last track the arrow would draw a new record; that stays on D so a stray key cannot leave this one
      const { record, trackIndex } = state.player
      if (key === 'ArrowRight' && trackIndex >= record.tracks.length - 1) return
      if (key === 'ArrowRight') actions.nextTrack()
      else actions.prevTrack()
      return
    }

    const dialogOpen = state.ui.detailsOpen || state.player.expanded || state.ui.prefsOpen || state.ui.docsOpen
    const lower = key.toLowerCase()
    if (lower === 'p') {
      if (mode === 'mock') actions.toggleProto()
    } else if (key === '?') actions.togglePrefs()
    else if (dialogOpen) return
    else if (lower === 'd') actions.discover()
    else if (lower === 'b') actions.previousDiscovery()
    else if (lower === 'k') actions.toggleKeep()
    else if (lower === 'i' && state.viewed) actions.openDetails()
    else if (lower === 'l') toggleView(state, 'library', actions.showLibrary)
    else if (lower === 's') toggleView(state, 'sources', actions.showSources)
    else if (lower === 'e') actions.expandPlayer()
    else if (lower === 'm') actions.toggleMute()
  })
}
