import { h, icon, setIcon } from '../core/dom.js'
import { displayArtist, displayTitle, formatTime, titleLength, trackTitle } from '../core/format.js'
import { createScrubber } from './scrubber.js'
import { createTracklist } from './tracklist.js'
import { setBackgroundInert, trapTab } from './inert.js'

// Expanded player. The cover morphs from the dock thumbnail via a shared view-transition-name.
export function mountNowPlaying(root, { store, clock, actions }) {
  const art = h('img', { alt: '' })
  const close = h(
    'button',
    {
      class: 'iconbtn np__close',
      type: 'button',
      'aria-label': 'Collapse player',
      onClick: () => actions.collapsePlayer(),
    },
    icon('down'),
  )
  const title = h('h2', { class: 'record__title' })
  const artist = h('p', { class: 'record__artist' })
  const scrub = createScrubber({ tall: true, label: 'Seek', onSeek: (seconds) => actions.seek(seconds) })
  const elapsed = h('span', null, '0:00')
  const total = h('span', null, '--:--')
  const prev = h(
    'button',
    { class: 'iconbtn', type: 'button', 'aria-label': 'Previous track', onClick: () => actions.prevTrack() },
    icon('prev'),
  )
  const playIcon = icon('play')
  const play = h(
    'button',
    { class: 'playbtn playbtn--lg', type: 'button', 'aria-label': 'Play', onClick: () => actions.togglePlayback() },
    playIcon,
  )
  const next = h(
    'button',
    { class: 'iconbtn', type: 'button', 'aria-label': 'Next track', onClick: () => actions.nextTrack() },
    icon('next'),
  )
  const volIcon = icon('volume')
  const mute = h(
    'button',
    { class: 'iconbtn', type: 'button', 'aria-label': 'Mute', onClick: () => actions.toggleMute() },
    volIcon,
  )
  const volume = h('input', {
    class: 'range',
    type: 'range',
    min: '0',
    max: '1',
    step: '0.01',
    'aria-label': 'Volume',
    onInput: (event) => actions.setVolume(Number(event.target.value)),
  })
  const tracklist = createTracklist({ actions, full: true })
  const status = h('p', { class: 'mono np__status' })

  const el = h(
    'section',
    { class: 'np', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Now playing', hidden: true },
    close,
    h('div', { class: 'np__art' }, h('div', { class: 'np__art-frame' }, art)),
    h(
      'div',
      { class: 'np__col' },
      h('p', { class: 'eyebrow mono' }, 'Now playing'),
      title,
      artist,
      h('div', null, scrub.el, h('div', { class: 'np__time mono' }, elapsed, total)),
      h('div', { class: 'np__controls' }, prev, play, next),
      h('div', { class: 'np__vol' }, mute, volume),
      status,
      tracklist.el,
    ),
  )
  root.append(el)
  el.addEventListener('keydown', (event) => trapTab(el, event))

  let wasOpen = false
  let lastKey = ''

  function render(state) {
    const { player } = state
    const record = player.record
    const open = Boolean(record) && player.expanded
    el.hidden = !open
    if (open !== wasOpen) {
      wasOpen = open
      setBackgroundInert(root, open)
      if (open) close.focus({ preventScroll: true })
      else {
        // The expand arrow is hidden on phones, where the cover is the way back in
        const back = [...document.querySelectorAll('.dock__expand, .dock__art')].find((node) => node.offsetParent)
        back?.focus({ preventScroll: true })
      }
    }
    if (!open) return

    const key = `${record.id}:${player.trackIndex}`
    if (key !== lastKey) {
      lastKey = key
      const name = displayTitle(record)
      art.src = record.art.url
      art.alt = record.art.alt
      title.textContent = trackTitle(record.tracks[player.trackIndex], player.trackIndex)
      title.dataset.len = titleLength(title.textContent)
      artist.textContent = [name, displayArtist(record)].filter(Boolean).join(' — ')
      scrub.setSeed(record.id)
      tracklist.render(record)
    }
    const playing = player.status === 'playing'
    setIcon(playIcon, playing ? 'pause' : 'play')
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play')
    next.setAttribute('aria-label', player.trackIndex >= record.tracks.length - 1 ? 'Next discovery' : 'Next track')
    status.textContent = player.status === 'error' ? player.error : ''
    status.hidden = !status.textContent
    setIcon(volIcon, player.muted || player.volume === 0 ? 'mute' : 'volume')
    volume.value = String(player.volume)
    volume.style.setProperty('--v', `${player.volume * 100}%`)
    tracklist.sync(state)
  }

  clock.subscribe(({ position, duration }) => {
    scrub.setClock(position, duration)
    elapsed.textContent = formatTime(position) || '0:00'
    total.textContent = duration ? formatTime(duration) : '--:--'
  })

  store.subscribe(render)
  render(store.get())
}
