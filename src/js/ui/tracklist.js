import { h } from '../core/dom.js'
import { formatTime, pad, trackTitle } from '../core/format.js'

const COLLAPSED_ROWS = 12

export function createTracklist({ actions, full = false }) {
  const count = h('span')
  const list = h('ol', { class: 'tracklist__list' })
  const more = h('button', {
    class: 'btn btn--text tracklist__more',
    type: 'button',
    onClick: () => actions.toggleShowAllTracks(),
  })
  const el = h(
    'section',
    { class: `tracklist${full ? ' tracklist--full' : ''}`, 'aria-label': 'Tracklist', 'data-playing': 'false' },
    h('header', { class: 'tracklist__head mono' }, h('span', null, 'Tracklist'), count),
    list,
    more,
  )
  let record = null

  function render(next) {
    record = next
    const total = next.tracks.length
    count.textContent = `${total} track${total === 1 ? '' : 's'}`
    list.replaceChildren(
      ...next.tracks.map((track, index) => {
        const title = trackTitle(track, index)
        return h(
          'li',
          { 'data-index': index },
          h(
            'button',
            {
              class: 'track',
              type: 'button',
              'aria-label': `Play track ${index + 1}, ${title}`,
              onClick: () => actions.playTrack(record, index),
            },
            h(
              'span',
              { class: 'track__lead' },
              h('span', { class: 'track__n' }, pad(index + 1)),
              h('span', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
            ),
            h('span', { class: 'track__title', title }, title),
            h('span', { class: 'track__dur' }, formatTime(track.duration_s)),
          ),
        )
      }),
    )
  }

  function sync(state) {
    if (!record) return
    const { player, ui } = state
    const isThis = player.record?.id === record.id
    el.dataset.playing = String(isThis && player.status === 'playing')
    const expanded = full || ui.showAllTracks
    const total = record.tracks.length
    ;[...list.children].forEach((li, index) => {
      li.hidden = !expanded && index >= COLLAPSED_ROWS
      const row = li.firstElementChild
      const current = isThis && index === player.trackIndex
      if (current) row.setAttribute('aria-current', 'true')
      else row.removeAttribute('aria-current')
      row.toggleAttribute('data-error', current && player.status === 'error')
    })
    more.hidden = full || total <= COLLAPSED_ROWS
    more.textContent = ui.showAllTracks ? 'Show fewer tracks' : `Show all ${total} tracks`
  }

  return { el, render, sync }
}
