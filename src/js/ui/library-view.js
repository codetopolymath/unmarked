import { h, icon } from '../core/dom.js'
import { dayLabel } from '../core/format.js'

const HISTORY_CHUNK = 100

function backupText(lastExport) {
  const when = lastExport
    ? new Date(lastExport).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : 'never'
  return `Kept lives only in this browser. Last backup: ${when}.`
}

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
  const tabProps = (name) => ({
    class: 'tab',
    type: 'button',
    role: 'tab',
    id: `library-tab-${name}`,
    'aria-controls': 'library-panel',
    onClick: () => actions.showLibrary(name),
  })
  const keptTab = h('button', tabProps('kept'), 'Kept', keptCount)
  const historyTab = h('button', tabProps('history'), 'History', h('sup', { class: 'mono' }))
  const tabs = [keptTab, historyTab]
  const tools = h('div', { class: 'library__tools' })
  const body = h('div', { role: 'tabpanel', id: 'library-panel' })
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
      h(
        'div',
        {
          class: 'tabs',
          role: 'tablist',
          'aria-label': 'Library',
          // Arrow keys move between tabs, as the tab pattern promises
          onKeydown: (event) => {
            const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
            if (!step && event.key !== 'Home' && event.key !== 'End') return
            event.preventDefault()
            const current = tabs.indexOf(document.activeElement)
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? tabs.length - 1
                  : (current + step + tabs.length) % tabs.length
            tabs[next].focus()
            tabs[next].click()
          },
        },
        keptTab,
        historyTab,
      ),
      tools,
    ),
    body,
    fileInput,
  )
  root.append(el)

  let historyShown = HISTORY_CHUNK
  let last = {}
  let wasVisible = false

  function artFor(entry) {
    // Hundreds of rows would otherwise start hundreds of image requests at once
    const img = h('img', { alt: '', loading: 'lazy', decoding: 'async' })
    resolveArtwork({ id: entry.id, title: entry.title, artwork: entry.artwork }).then((art) => {
      img.src = art.url
      img.alt = art.alt
    })
    return img
  }

  function renderKept(kept, lastExport) {
    if (!kept.length) {
      return h(
        'div',
        { class: 'empty' },
        h('p', { class: 'empty__title' }, 'Nothing kept yet.'),
        h('p', null, 'Records you keep rest here, with their artwork, until you remove them.'),
      )
    }
    const grid = h(
      'ul',
      { class: 'library__grid' },
      kept.map((entry) => {
        const meta = [entry.source?.name, entry.year].filter(Boolean).join(' / ')
        return h(
          'li',
          { class: 'tile-item' },
          h(
            'button',
            {
              class: 'tile__remove',
              type: 'button',
              'aria-label': `Remove ${entry.title} from Kept`,
              onClick: () => actions.removeKept(entry.id),
            },
            icon('close'),
          ),
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
    return h('div', null, h('p', { class: 'library__note mono' }, backupText(lastExport)), grid)
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
    for (const entry of history.slice(0, historyShown)) {
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
    if (history.length > historyShown) {
      nodes.push(
        h(
          'button',
          {
            class: 'btn history__more',
            type: 'button',
            onClick: () => {
              historyShown += HISTORY_CHUNK
              render(store.get(), true)
            },
          },
          `Show more (${history.length - historyShown} older)`,
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
    // No confirm step: the toast offers Undo, which is faster and safer than a second press
    return [
      h('button', { class: 'btn btn--text', type: 'button', onClick: () => actions.clearHistory() }, 'Clear history'),
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
    if (!wasVisible) historyShown = HISTORY_CHUNK
    const tab = state.libraryTab
    const lastExport = state.prefs.lastExport ?? null
    for (const node of tabs) {
      const selected = node === (tab === 'kept' ? keptTab : historyTab)
      node.setAttribute('aria-selected', String(selected))
      node.tabIndex = selected ? 0 : -1
    }
    body.setAttribute('aria-labelledby', `library-tab-${tab}`)
    keptCount.textContent = state.kept.length ? String(state.kept.length) : ''
    historyTab.lastChild.textContent = state.history.length ? String(state.history.length) : ''

    if (
      force ||
      last.tab !== tab ||
      last.kept !== state.kept ||
      last.history !== state.history ||
      last.lastExport !== lastExport
    ) {
      body.replaceChildren(
        tab === 'kept' ? renderKept(state.kept, lastExport) : renderHistory(state.history, state.kept),
      )
      tools.replaceChildren(...renderTools(tab))
      last = { tab, kept: state.kept, history: state.history, lastExport }
    }
    if (!wasVisible) {
      wasVisible = true
      heading.focus({ preventScroll: true })
    }
  }

  store.subscribe((state) => render(state))
  render(store.get())
}
