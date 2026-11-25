import { h, icon, setIcon } from '../core/dom.js'
import { displayArtist, displayTitle, formatTime, trackTitle } from '../core/format.js'
import { motionReduced } from '../core/motion.js'
import { createScrubber } from './scrubber.js'

// Persistent mini player: stays through discovery, library and details
export function mountDock(root, { store, clock, actions }) {
  const artImg = h('img', { alt: '' })
  const artBtn = h(
    'button',
    { class: 'dock__art', type: 'button', 'aria-label': 'Expand player', onClick: () => actions.expandPlayer() },
    artImg,
  )
  const track = h('p', { class: 'dock__track' })
  const sub = h('p', { class: 'dock__sub' })
  const prev = h(
    'button',
    { class: 'iconbtn dock__prev', type: 'button', 'aria-label': 'Previous track', onClick: () => actions.prevTrack() },
    icon('prev'),
  )
  const playIcon = icon('play')
  const play = h(
    'button',
    { class: 'playbtn', type: 'button', 'aria-label': 'Play', onClick: () => actions.togglePlayback() },
    playIcon,
  )
  const next = h(
    'button',
    { class: 'iconbtn', type: 'button', 'aria-label': 'Next track', onClick: () => actions.nextTrack() },
    icon('next'),
  )
  const scrub = createScrubber({ label: 'Seek', onSeek: (seconds) => actions.seek(seconds) })
  const line = createScrubber({ variant: 'line' })
  const elapsed = h('span', null, '0:00')
  const total = h('span', null, '--:--')
  const volIcon = icon('volume')
  const mute = h(
    'button',
    {
      class: 'iconbtn',
      type: 'button',
      'aria-label': 'Mute',
      onClick: () => actions.toggleMute(),
    },
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
  const expand = h(
    'button',
    {
      class: 'iconbtn dock__expand',
      type: 'button',
      'aria-label': 'Expand player',
      'aria-expanded': 'false',
      onClick: () => actions.expandPlayer(),
    },
    icon('up'),
  )
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' })

  const el = h(
    'aside',
    { class: 'dock', role: 'region', 'aria-label': 'Player', hidden: true },
    h('div', { class: 'dock__line' }, line.el),
    artBtn,
    h('div', { class: 'dock__info' }, track, sub),
    h('div', { class: 'dock__transport' }, prev, play, next),
    h('div', { class: 'dock__progress' }, elapsed, scrub.el, total),
    h('div', { class: 'dock__volume' }, mute, volume),
    expand,
    live,
  )
  root.append(el)

  let lastKey = ''
  let entered = false

  function render(state) {
    const { player } = state
    const record = player.record
    if (!record) {
      el.hidden = true
      entered = false
      lastKey = ''
      return
    }
    el.hidden = player.expanded
    if (player.expanded) return

    if (!entered) {
      entered = true
      if (!motionReduced()) {
        el.dataset.entering = ''
        el.addEventListener('animationend', () => el.removeAttribute('data-entering'), { once: true })
      }
    }

    const index = player.trackIndex
    const key = `${record.id}:${index}`
    if (key !== lastKey) {
      lastKey = key
      const title = trackTitle(record.tracks[index], index)
      artImg.src = record.art.url
      track.textContent = title
      scrub.setSeed(record.id)
      live.textContent = `Now playing: ${title}`
    }

    const failed = player.status === 'error'
    const artist = displayArtist(record)
    sub.textContent = failed ? player.error : `${displayTitle(record)}${artist ? ` — ${artist}` : ''}`
    sub.toggleAttribute('data-error', failed)

    const playing = player.status === 'playing'
    setIcon(playIcon, playing ? 'pause' : 'play')
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play')
    play.setAttribute('aria-busy', String(player.status === 'loading'))
    const last = index >= record.tracks.length - 1
    next.setAttribute('aria-label', last ? 'Next discovery' : 'Next track')
    mute.setAttribute('aria-label', player.muted ? 'Unmute' : 'Mute')
    setIcon(volIcon, player.muted || player.volume === 0 ? 'mute' : 'volume')
    volume.value = String(player.volume)
    volume.style.setProperty('--v', `${player.volume * 100}%`)
  }

  clock.subscribe(({ position, duration }) => {
    scrub.setClock(position, duration)
    line.setClock(position, duration)
    elapsed.textContent = formatTime(position) || '0:00'
    total.textContent = duration ? formatTime(duration) : '--:--'
  })

  store.subscribe(render)
  render(store.get())
}
