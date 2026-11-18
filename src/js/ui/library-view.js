import { h } from '../core/dom.js'
import { dayLabel } from '../core/format.js'

const CONFIRM_MS = 4000

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = h('a', { href: url, download: filename })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Kept shelf and history diary. Chronological only: no sorting or filtering by any attribute.
export function mountLibrary(root, { store, actions, resolveArtwork, notify }) {
  const keptCount = h('sup', { class: 'mono' })
  const keptTab = h(
    'button',
    { class: 'tab', type: 'button', role: 'tab', onClick: () => actions.showLibrary('kept') },
    'Kept',
    keptCount,
  )
  const historyTab = h(
    'button',
    { class: 'tab', type: 'button', role: 'tab', onClick: () => actions.showLibrary('history') },
    'History',
    h('sup', { class: 'mono' }),
  )
  const tools = h('div', { class: 'library__tools' })
  const body = h('div', { role: 'tabpanel' })
  const heading = h('h1', { class: 'sr-only', id: 'library-title', tabindex: '-1' }, 'Library')
  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json',
    hidden: true,
    'aria-label': 'Import a library file',
  })
  const el = h(
    'section',
    { class: 'library', 'aria-labelledby': 'library-title', hidden: true },
    heading,
    h(
      'header',
      { class: 'library__head' },
      h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Library' }, keptTab, historyTab),
      tools,
    ),
    body,
    fileInput,
  )
  root.append(el)

  let confirming = false
  let confirmTimer = 0
  let last = {}
  let wasVisible = false

  function artFor(entry) {
    const img = h('img', { alt: '' })
    resolveArtwork({ id: entry.id, title: entry.title, artwork: entry.artwork }).then((art) => {
      img.src = art.url
      img.alt = art.alt
    })
    return img
  }

  function renderKept(kept) {
    if (!kept.length) {
      return h(
        'div',
        { class: 'empty' },
        h('p', { class: 'empty__title' }, 'Nothing kept yet.'),
        h('p', null, 'Records you keep rest here, with their artwork, until you remove them.'),
      )
    }
    return h(
      'ul',
      { class: 'library__grid' },
      kept.map((entry) => {
        const meta = [entry.source?.name, entry.year].filter(Boolean).join(' / ')
        return h(
          'li',
          null,
          h(
            'button',
            { class: 'tile', type: 'button', onClick: () => actions.openRecord(entry.id) },
            h('span', { class: 'tile__art' }, artFor(entry)),
            h('span', { class: 'tile__title', style: { display: 'block' } }, entry.title),
            entry.artist ? h('span', { class: 'tile__sub', style: { display: 'block' } }, entry.artist) : null,
            meta ? h('span', { class: 'tile__meta mono', style: { display: 'block' } }, meta) : null,
          ),
        )
      }),
    )
  }

  function renderHistory(history, kept) {
    if (!history.length) {
      return h(
        'div',
        { class: 'empty' },
        h('p', { class: 'empty__title' }, 'No discoveries yet.'),
        h(
          'p',
          null,
          'Each record you meet is logged here, newest first. This list only helps avoid repeats; it never shapes what you find.',
        ),
      )
    }
    const keptIds = new Set(kept.map((entry) => entry.id))
    const nodes = []
    let day = null
    for (const entry of history) {
      const label = dayLabel(entry.shownAt)
      if (label !== day) {
        nodes.push(h('h2', { class: 'history__day mono' }, label))
        day = label
      }
      // "Seen", not "Skipped": passing on a record is not a verdict
      const state = keptIds.has(entry.id) ? 'Kept' : entry.played ? 'Played' : 'Seen'
      nodes.push(
        h(
          'button',
          { class: 'hrow', type: 'button', onClick: () => actions.openRecord(entry.id) },
          h('span', { class: 'hrow__n mono' }, `No. ${entry.number}`),
          h('span', { class: 'hrow__art' }, artFor(entry)),
          h(
            'span',
            null,
            h('span', { class: 'hrow__title', style: { display: 'block' } }, entry.title),
            entry.artist ? h('span', { class: 'hrow__sub', style: { display: 'block' } }, entry.artist) : null,
          ),
          h('span', { class: 'hrow__state mono' }, state),
        ),
      )
    }
    return h('div', null, nodes)
  }

  function renderTools(tab) {
    if (tab === 'kept') {
      return [
        h(
          'button',
          {
            class: 'btn btn--text',
            type: 'button',
            onClick: () => download('unmarked-library.json', actions.exportLibrary()),
          },
          'Export',
        ),
        h('button', { class: 'btn btn--text', type: 'button', onClick: () => fileInput.click() }, 'Import'),
      ]
    }
    return [
      h(
        'button',
        {
          class: 'btn btn--text',
          type: 'button',
          onClick: () => {
            if (!confirming) {
              confirming = true
              clearTimeout(confirmTimer)
              confirmTimer = setTimeout(() => {
                confirming = false
                render(store.get(), true)
              }, CONFIRM_MS)
              render(store.get(), true)
              return
            }
            confirming = false
            clearTimeout(confirmTimer)
            actions.clearHistory()
          },
        },
        confirming ? 'Press again to clear' : 'Clear history',
      ),
    ]
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    fileInput.value = ''
    if (!file) return
    try {
      actions.importLibrary(await file.text())
    } catch (error) {
      notify(error.message)
    }
  })

  function render(state, force = false) {
    const visible = state.view === 'library'
    el.hidden = !visible
    if (!visible) {
      wasVisible = false
      return
    }
    const tab = state.libraryTab
    keptTab.setAttribute('aria-selected', String(tab === 'kept'))
    historyTab.setAttribute('aria-selected', String(tab === 'history'))
    keptCount.textContent = state.kept.length ? String(state.kept.length) : ''
    historyTab.lastChild.textContent = state.history.length ? String(state.history.length) : ''

    if (force || last.tab !== tab || last.kept !== state.kept || last.history !== state.history) {
      body.replaceChildren(tab === 'kept' ? renderKept(state.kept) : renderHistory(state.history, state.kept))
      tools.replaceChildren(...renderTools(tab))
      last = { tab, kept: state.kept, history: state.history }
    }
    if (!wasVisible) {
      wasVisible = true
      heading.focus({ preventScroll: true })
    }
  }

  store.subscribe((state) => render(state))
  render(store.get())
}
