import { h, icon } from '../core/dom.js'

function setCurrent(link, current) {
  if (current) link.setAttribute('aria-current', 'page')
  else link.removeAttribute('aria-current')
}

export function mountTopbar(root, { store, actions, mode }) {
  const keptCount = h('span', { class: 'navlink__count' })
  const keptLink = h(
    'button',
    { class: 'navlink mono', type: 'button', onClick: () => actions.showLibrary('kept') },
    'Kept',
    keptCount,
  )
  const historyLink = h(
    'button',
    { class: 'navlink mono', type: 'button', onClick: () => actions.showLibrary('history') },
    'History',
  )
  // Doubles as the prototype-controls toggle so no floating chip covers the player
  const badge =
    mode === 'live'
      ? h(
          'span',
          { class: 'badge mono' },
          h('span', { class: 'badge__long' }, 'Beta · live archive'),
          h('span', { class: 'badge__short' }, 'Beta'),
        )
      : h(
          'button',
          {
            class: 'badge mono',
            type: 'button',
            'aria-expanded': 'false',
            'aria-controls': 'proto-panel',
            'aria-keyshortcuts': 'P',
            onClick: () => actions.toggleProto(),
          },
          h('span', { class: 'badge__long' }, 'Prototype · mock data'),
          h('span', { class: 'badge__short' }, 'Proto'),
        )
  // Phones get one icon instead of two text links; the tabs inside the library carry the split
  const libraryBadge = h('span', { class: 'iconbtn__count mono', 'aria-hidden': 'true' })
  const libraryBtn = h(
    'button',
    {
      class: 'iconbtn nav-library',
      type: 'button',
      'aria-label': 'Library: kept records and history',
      onClick: () => actions.showLibrary(),
    },
    icon('library'),
    libraryBadge,
  )
  const sourcesLink = h(
    'button',
    { class: 'navlink mono', type: 'button', onClick: () => actions.showSources() },
    'Sources',
  )
  // Phones have no room for a fourth topbar icon; there the same sheet opens from Preferences
  const docsLink = h(
    'button',
    {
      class: 'navlink mono',
      type: 'button',
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
      onClick: () => actions.openDocs(),
    },
    'Docs',
  )
  const sourcesBtn = h(
    'button',
    {
      class: 'iconbtn nav-sources',
      type: 'button',
      'aria-label': 'Sources status board',
      onClick: () => actions.showSources(),
    },
    icon('sources'),
  )
  const prefsBtn = h(
    'button',
    {
      class: 'iconbtn',
      type: 'button',
      'aria-label': 'Preferences and shortcuts',
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
      onClick: actions.togglePrefs,
    },
    icon('prefs'),
  )
  const el = h(
    'header',
    { class: 'topbar' },
    h(
      'div',
      { class: 'topbar__lead' },
      h(
        'button',
        {
          class: 'wordmark',
          type: 'button',
          'aria-label': 'Unmarked, back to discovery',
          onClick: actions.showDiscover,
        },
        h('span', { class: 'wordmark__dot', 'aria-hidden': 'true' }),
        'Unmarked',
      ),
      badge,
    ),
    h(
      'nav',
      { class: 'topbar__nav', 'aria-label': 'Main' },
      keptLink,
      historyLink,
      sourcesLink,
      docsLink,
      libraryBtn,
      sourcesBtn,
      prefsBtn,
    ),
  )
  root.append(el)

  function render(state) {
    const inLibrary = state.view === 'library'
    keptCount.textContent = state.kept.length ? String(state.kept.length) : ''
    libraryBadge.textContent = state.kept.length ? String(state.kept.length) : ''
    libraryBtn.setAttribute(
      'aria-label',
      state.kept.length ? `Library: ${state.kept.length} kept, plus history` : 'Library: kept records and history',
    )
    setCurrent(keptLink, inLibrary && state.libraryTab === 'kept')
    setCurrent(historyLink, inLibrary && state.libraryTab === 'history')
    setCurrent(libraryBtn, inLibrary)
    setCurrent(sourcesLink, state.view === 'sources')
    setCurrent(sourcesBtn, state.view === 'sources')
    docsLink.setAttribute('aria-expanded', String(state.ui.docsOpen))
    prefsBtn.setAttribute('aria-expanded', String(state.ui.prefsOpen))
    badge.setAttribute('aria-expanded', String(state.ui.protoOpen))
  }
  store.subscribe(render)
  render(store.get())
}
