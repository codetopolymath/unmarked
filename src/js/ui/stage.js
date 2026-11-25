import { h, icon, linkProps, setIcon } from '../core/dom.js'
import { accession, displayArtist, displayTitle, factsFor, titleLength } from '../core/format.js'
import { createDrawTicket, ticketText } from './draw-ticket.js'
import { createPlate } from './plate.js'
import { createTracklist } from './tracklist.js'
import { createScrubber } from './scrubber.js'

const STATUS_LINES = ['Opening the drawer', 'Reading the label', 'Checking the groove']
const STATUS_MS = 1100

function eyebrowFor(record) {
  if (record.origin === 'draw' && record.draw) {
    return `Accession ${accession(record.accession)} · ${ticketText(record.draw)} · Drawn at random`
  }
  if (record.origin === 'draw') return `Accession ${accession(record.accession)} · Drawn at random`
  return record.accession ? `Reopened · Accession ${accession(record.accession)}` : 'Reopened from your library'
}

export function mountStage(root, { store, clock, actions }) {
  const plate = createPlate()
  const meta = h('div', { class: 'stage__meta' })
  const el = h(
    'section',
    { class: 'stage', 'aria-label': 'Current record', 'data-state': 'idle' },
    h('div', { class: 'stage__plate' }, plate.el),
    meta,
  )
  root.append(el)

  const skeletonEyebrow = h('p', { class: 'eyebrow mono' })
  const skeleton = h(
    'div',
    null,
    skeletonEyebrow,
    h('div', { class: 'skeleton', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
  )
  const noticeTitle = h('p', { class: 'notice__title' })
  const noticeBody = h('p')
  const notice = h(
    'div',
    { class: 'notice', role: 'alert' },
    noticeTitle,
    noticeBody,
    h('button', { class: 'btn', type: 'button', onClick: () => actions.discover() }, 'Try again'),
  )

  // Says what failed: no connection is the listener's to fix, a source outage is not
  function describeFailure(draw) {
    if (navigator.onLine === false) {
      noticeTitle.textContent = 'You appear to be offline'
      noticeBody.textContent = 'Nothing was lost. Reconnect and try again.'
      return
    }
    const tried = draw.tried ?? []
    noticeTitle.textContent = tried.length ? 'No source answered' : 'The archive is not answering'
    noticeBody.textContent = tried.length
      ? `Asked ${tried.join(', ')}. Nothing was lost; try again in a moment.`
      : 'Nothing was lost. Try again in a moment.'
  }

  const ticket = createDrawTicket()
  let refs = null
  let shownKey = null
  let previousView = 'discover'
  let statusTimer = 0
  let statusIndex = 0

  function buildMeta(record) {
    let order = 0
    const enter = (node) => {
      node.dataset.enter = ''
      node.style.setProperty('--i', String(order++))
      return node
    }
    const title = displayTitle(record)
    const artist = displayArtist(record)
    const facts = factsFor(record)

    const eyebrow = enter(h('p', { class: 'eyebrow mono' }, eyebrowFor(record)))
    const heading = enter(
      h(
        'h1',
        {
          class: 'record__title',
          id: 'record-title',
          tabindex: '-1',
          'data-len': titleLength(title),
          'data-fallback': !record.title?.trim(),
        },
        title,
      ),
    )
    const artistLine = enter(
      artist
        ? h('p', { class: 'record__artist' }, artist)
        : h('p', { class: 'record__artist', 'data-unknown': '' }, 'Artist not listed'),
    )
    const factItems = facts.flatMap((fact, index) => [
      index ? h('li', { class: 'facts__sep', 'aria-hidden': 'true' }, '/') : null,
      h('li', { 'data-fact': fact.key, title: fact.text }, fact.text),
    ])
    const factsLine = facts.length ? enter(h('ul', { class: 'facts mono', 'aria-label': 'Facts' }, factItems)) : null

    const playIcon = icon('play')
    const playLabel = h('span')
    const play = h(
      'button',
      {
        class: 'btn btn--primary actions__play',
        type: 'button',
        'aria-keyshortcuts': 'Space',
        onClick: () => actions.togglePlayViewed(),
      },
      playIcon,
      playLabel,
    )
    const keepIcon = icon('keep')
    const keepLabel = h('span', null, 'Keep')
    const keep = h(
      'button',
      {
        class: 'btn actions__keep',
        type: 'button',
        'aria-keyshortcuts': 'K',
        onClick: () => actions.toggleKeep(),
      },
      keepIcon,
      keepLabel,
    )
    const details = h(
      'button',
      {
        class: 'btn btn--text actions__details',
        type: 'button',
        'aria-keyshortcuts': 'I',
        onClick: () => actions.openDetails(),
      },
      icon('info'),
      'Details',
    )
    const actionsRow = enter(h('div', { class: 'actions' }, play, keep, details))

    const discover = h(
      'button',
      {
        class: 'discover actions__discover',
        type: 'button',
        'aria-keyshortcuts': 'D',
        onClick: () => actions.discover(),
      },
      h('span', null, 'Discover another'),
      icon('arrow'),
      h('kbd', { class: 'kbd', 'aria-hidden': 'true' }, 'D'),
    )
    const previous = h(
      'button',
      { class: 'btn btn--text', type: 'button', onClick: () => actions.previousDiscovery() },
      icon('back'),
      'Previous discovery',
    )
    const discoverRow = enter(h('div', { class: 'stage__discover' }, discover, previous))

    const rights = h(
      'button',
      {
        class: 'rights mono',
        type: 'button',
        'data-state': record.rights.state,
        'aria-label': `Rights: ${record.rights.label}. Open details.`,
        onClick: () => actions.openDetails('rights'),
      },
      record.rights.short ?? record.rights.label,
    )
    const sourceRow = enter(
      h(
        'div',
        { class: 'source' },
        h('span', null, 'Found on ', h('a', linkProps(record.source.url), record.source.name, icon('external'))),
        rights,
      ),
    )

    let tracklist = null
    let scrub = null
    let listing
    if (record.kind === 'album' && record.tracks.length > 1) {
      tracklist = createTracklist({ actions })
      tracklist.render(record)
      listing = enter(tracklist.el)
    } else {
      scrub = createScrubber({ tall: true, label: 'Seek', onSeek: (seconds) => actions.seek(seconds) })
      scrub.setSeed(record.id)
      listing = enter(h('div', { class: 'stage__scrub' }, scrub.el))
    }

    return {
      nodes: [eyebrow, heading, artistLine, factsLine, actionsRow, discoverRow, sourceRow, listing].filter(Boolean),
      refs: {
        record,
        eyebrow,
        heading,
        play,
        playIcon,
        playLabel,
        keep,
        keepIcon,
        keepLabel,
        discover,
        previous,
        tracklist,
        scrub,
      },
    }
  }

  function showRecord(record) {
    plate.show(record.art, {
      label: record.accession ? `Plate ${accession(record.accession)}` : 'Reopened',
      note: record.art.origin === 'generated' ? 'Generated artwork' : '',
    })
    const built = buildMeta(record)
    refs = built.refs
    meta.replaceChildren(...built.nodes)
  }

  function stopStatus() {
    clearInterval(statusTimer)
    statusTimer = 0
  }

  function statusText(number) {
    return `Retrieving accession ${accession(number)} · ${STATUS_LINES[statusIndex % STATUS_LINES.length]}`
  }

  // Archive draws replace the status line with the real ticket; other draws keep the cycling status
  function showTicket(target, attempt) {
    stopStatus()
    if (!target.contains(ticket.el)) target.replaceChildren(ticket.el)
    ticket.show(attempt)
    if (refs && target === refs.eyebrow) refs.eyebrowFinal = false
  }

  function showFinal(animate) {
    const { eyebrow, record } = refs
    refs.eyebrowFinal = true
    if (record.origin !== 'draw' || !record.draw) {
      eyebrow.textContent = eyebrowFor(record)
      return
    }
    eyebrow.replaceChildren(
      h('span', null, `Accession ${accession(record.accession)} · `, ticket.el, ' · Drawn at random'),
    )
    ticket.settle(record.draw, { animate })
  }

  function syncStatus(state) {
    const { draw } = state
    const target = refs?.eyebrow ?? skeletonEyebrow
    if (draw.status === 'drawing') {
      if (draw.attempt) {
        showTicket(target, draw.attempt)
        return
      }
      target.textContent = statusText(draw.number)
      if (refs) refs.eyebrowFinal = false
      if (!statusTimer) {
        statusIndex = 0
        statusTimer = setInterval(() => {
          statusIndex += 1
          const live = store.get()
          if (live.draw.attempt) return
          const eyebrow = refs?.eyebrow ?? skeletonEyebrow
          eyebrow.textContent = statusText(live.draw.number)
        }, STATUS_MS)
      }
    } else {
      stopStatus()
      // Only a freshly drawn record stamps; a record restored after a failed draw just reappears
      if (refs && !refs.eyebrowFinal) showFinal(draw.status === 'ready' && !refs.stamped)
      if (refs) refs.stamped = true
    }
  }

  function syncPlacement(state) {
    const failed = state.draw.status === 'failed'
    if (failed) describeFailure(state.draw)
    if (!state.viewed) {
      if (failed) meta.replaceChildren(notice)
      else if (!skeleton.isConnected) meta.replaceChildren(skeleton)
    } else if (failed) meta.prepend(notice)
    else notice.remove()
  }

  function sync(state) {
    const { viewed, player, draw, kept, stack } = state
    el.dataset.state = draw.status
    plate.setLoading(draw.status === 'drawing')
    syncPlacement(state)
    syncStatus(state)
    if (!refs || !viewed) return

    const mine = player.record?.id === viewed.id
    const playing = mine && player.status === 'playing'
    const noun = viewed.kind === 'album' ? 'album' : 'recording'
    setIcon(refs.playIcon, playing ? 'pause' : 'play')
    refs.playLabel.textContent = playing
      ? 'Pause'
      : mine && player.status === 'paused'
        ? 'Resume'
        : mine && player.status === 'loading'
          ? 'Loading'
          : `Play ${noun}`

    const isKept = kept.some((entry) => entry.id === viewed.id)
    // The visible label already says Keep or Kept; a pressed state on top would announce it twice
    setIcon(refs.keepIcon, isKept ? 'kept' : 'keep')
    refs.keepLabel.textContent = isKept ? 'Kept' : 'Keep'

    refs.discover.disabled = draw.status === 'drawing'
    refs.discover.setAttribute('aria-busy', String(draw.status === 'drawing'))
    refs.previous.hidden = stack.length === 0

    refs.tracklist?.sync(state)
    if (refs.scrub && !mine) refs.scrub.setClock(0, 0)
  }

  function render(state) {
    const visible = state.view === 'discover'
    el.hidden = !visible
    if (!visible) {
      previousView = state.view
      stopStatus()
      return
    }
    const record = state.viewed
    const key = record ? `${record.id}|${record.origin}|${record.accession}` : 'none'
    if (key !== shownKey) {
      shownKey = key
      if (record) showRecord(record)
    }
    sync(state)
    if (previousView === 'library' && refs) refs.heading.focus({ preventScroll: true })
    previousView = state.view
  }

  clock.subscribe(({ position, duration }) => {
    const { player } = store.get()
    if (refs?.scrub && player.record?.id === refs.record.id) refs.scrub.setClock(position, duration)
  })

  store.subscribe(render)
  render(store.get())
}
