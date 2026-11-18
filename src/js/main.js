import { h } from './core/dom.js'
import { createApp } from './state/app.js'
import { createMockSource } from './data/mock-source.js'
import { createLibrary } from './services/library.js'
import { createPlayback } from './services/playback.js'
import { resolveArtwork } from './services/artwork.js'
import { rgbCss } from './services/palette.js'
import { mountIcons } from './ui/icons.js'
import { createToasts } from './ui/toasts.js'
import { mountTopbar } from './ui/topbar.js'
import { mountStage } from './ui/stage.js'
import { mountLibrary } from './ui/library-view.js'
import { mountSources } from './ui/sources-view.js'
import { mountActionbar } from './ui/actionbar.js'
import { mountDock } from './ui/dock.js'
import { mountNowPlaying } from './ui/nowplaying.js'
import { mountDetails } from './ui/details.js'
import { mountPreferences } from './ui/preferences.js'
import { bindKeyboard } from './ui/keyboard.js'
import { mountProtoPanel, runUrlScenario } from './ui/proto-panel.js'

const root = document.getElementById('app')
const params = new URLSearchParams(location.search)

mountIcons(document.body)
const toasts = createToasts(document.body)
const source = createMockSource()

function applyTheme(theme) {
  const style = document.documentElement.style
  style.setProperty('--wash', rgbCss(theme.wash))
  style.setProperty('--tint', rgbCss(theme.tint))
  style.setProperty('--tint-2', rgbCss(theme.tint2))
}

const app = createApp({
  source,
  library: createLibrary(),
  resolveArtwork,
  createPlayback,
  notify: toasts.notify,
  announce: toasts.announce,
  applyTheme,
})
const ctx = { ...app, source, resolveArtwork, notify: toasts.notify }

app.store.subscribe(({ prefs }) => {
  document.documentElement.dataset.motion = prefs.motion
})
document.documentElement.dataset.motion = app.store.get().prefs.motion

mountTopbar(root, ctx)
const main = h('main', { id: 'main', class: 'main', tabindex: '-1' })
root.append(main)
mountStage(main, ctx)
mountLibrary(main, ctx)
mountSources(main, ctx)
mountActionbar(root, ctx)
mountDock(root, ctx)
mountNowPlaying(root, ctx)
mountDetails(root, ctx)
mountPreferences(root, ctx)
mountProtoPanel(root, ctx)
bindKeyboard(ctx)

// Prototype links point nowhere real; say so instead of navigating
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-mock]')
  if (!link) return
  event.preventDefault()
  toasts.notify('Mock link: this prototype has no real archive behind it.')
})

app.init()
if (params.has('debug')) window.__unmarked = ctx

runUrlScenario(ctx, params)
