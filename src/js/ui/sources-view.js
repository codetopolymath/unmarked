import { h } from '../core/dom.js'
import { formatCount } from '../core/format.js'
import { mapAge } from '../data/ia/map-age.js'
import { SOURCES, SOURCE_GROUPS } from '../data/sources-catalog.js'

const STATUS_LABEL = { selected: 'In scope', unavailable: 'Unavailable' }

function sizeText(entry) {
  return entry.size == null ? '' : `${formatCount(entry.size)} ${entry.unit}`
}

// One line on the Archive map's health: an old map silently stops drawing new uploads, and nothing else shows it
function mapStatus(mapInfo) {
  if (!mapInfo) return null
  if (!mapInfo.builtAt) {
    return { stale: true, text: 'Internet Archive map unavailable: drawing from Wikimedia Commons only.' }
  }
  const age = mapAge(mapInfo.builtAt)
  const text = `Internet Archive map built ${age.text}.`
  return { stale: age.stale, text: age.stale ? `${text} Newer uploads are not drawn until it is rebuilt.` : text }
}

function renderRow(entry) {
  const size = sizeText(entry)
  return h(
    'li',
    { class: 'src-row', 'data-status': entry.status },
    h(
      'span',
      { class: 'src-row__status mono' },
      h('i', { class: 'src-dot', 'aria-hidden': 'true' }),
      STATUS_LABEL[entry.status],
    ),
    h(
      'div',
      { class: 'src-row__body' },
      h('p', { class: 'src-row__name' }, entry.name),
      h('p', { class: 'src-row__note' }, entry.note),
      entry.todo ? h('p', { class: 'src-row__todo mono' }, `Todo · ${entry.todo}`) : null,
    ),
    size ? h('span', { class: 'src-row__size mono' }, size) : null,
  )
}

// Read-only status board: where records can come from, and what is still to build. It never filters a discovery.
export function mountSources(root, { store, mapInfo }) {
  const status = mapStatus(mapInfo)
  const inScope = SOURCES.filter((s) => s.status === 'selected').length
  const notDrawn = SOURCES.filter((s) => s.status !== 'selected')
  const heading = h('h1', { class: 'sources__title', id: 'sources-title', tabindex: '-1' }, 'Sources')
  const el = h(
    'section',
    { class: 'sources', 'aria-labelledby': 'sources-title', hidden: true },
    heading,
    h(
      'p',
      { class: 'sources__lead' },
      'Where records come from, and what each source is like. This page never filters or steers a discovery.',
    ),
    h(
      'p',
      { class: 'sources__summary mono' },
      h('span', { class: 'sources__count', 'data-status': 'selected' }, `${inScope} in scope`),
      h('span', { class: 'sources__count', 'data-status': 'unavailable' }, `${SOURCES.length - inScope} unavailable`),
    ),
    status ? h('p', { class: 'sources__map mono', 'data-stale': String(status.stale) }, status.text) : null,
    // Sources that draw come first; the rest is the maker's to-do list, so it folds away
    ...SOURCE_GROUPS.map((group) => ({ group, entries: SOURCES.filter((s) => s.group === group.id) }))
      .filter(({ entries }) => entries.some((s) => s.status === 'selected'))
      .map(({ group, entries }) =>
        h(
          'section',
          { class: 'src-group', 'aria-labelledby': `src-${group.id}` },
          h('h2', { class: 'src-group__head mono', id: `src-${group.id}` }, group.name),
          h('p', { class: 'src-group__lead' }, group.lead),
          h('ul', { class: 'src-list' }, entries.filter((s) => s.status === 'selected').map(renderRow)),
        ),
      ),
    h(
      'details',
      { class: 'src-more' },
      h('summary', { class: 'src-more__summary mono' }, `Considered, not drawn from (${notDrawn.length})`),
      h(
        'p',
        { class: 'src-group__lead' },
        'Researched and not built, or ruled out. Each needs an adapter, licence handling and sometimes a key before it could join.',
      ),
      h('ul', { class: 'src-list' }, notDrawn.map(renderRow)),
    ),
  )
  root.append(el)

  let wasVisible = false
  function render({ view }) {
    const visible = view === 'sources'
    el.hidden = !visible
    if (visible && !wasVisible) heading.focus({ preventScroll: true })
    wasVisible = visible
  }
  store.subscribe(render)
  render(store.get())
}
