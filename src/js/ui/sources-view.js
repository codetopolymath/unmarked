import { h } from '../core/dom.js'
import { formatCount } from '../core/format.js'
import { SOURCES, SOURCE_GROUPS } from '../data/sources-catalog.js'

const STATUS_LABEL = { selected: 'In scope', unavailable: 'Unavailable' }

function sizeText(entry) {
  return entry.size == null ? '' : `${formatCount(entry.size)} ${entry.unit}`
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
export function mountSources(root, { store }) {
  const inScope = SOURCES.filter((s) => s.status === 'selected').length
  const heading = h('h1', { class: 'sources__title', id: 'sources-title', tabindex: '-1' }, 'Sources')
  const el = h(
    'section',
    { class: 'sources', 'aria-labelledby': 'sources-title', hidden: true },
    heading,
    h(
      'p',
      { class: 'sources__lead' },
      'Where records come from, and what is still to build. This page is a status board: it never filters or steers a discovery.',
    ),
    h(
      'p',
      { class: 'sources__summary mono' },
      h('span', { class: 'sources__count', 'data-status': 'selected' }, `${inScope} in scope`),
      h('span', { class: 'sources__count', 'data-status': 'unavailable' }, `${SOURCES.length - inScope} unavailable`),
    ),
    ...SOURCE_GROUPS.map((group) =>
      h(
        'section',
        { class: 'src-group', 'aria-labelledby': `src-${group.id}` },
        h('h2', { class: 'src-group__head mono', id: `src-${group.id}` }, group.name),
        h('p', { class: 'src-group__lead' }, group.lead),
        h('ul', { class: 'src-list' }, SOURCES.filter((s) => s.group === group.id).map(renderRow)),
      ),
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
