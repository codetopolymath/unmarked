import { h, icon, linkProps } from '../core/dom.js'
import { cssMs } from '../core/motion.js'
import { docsUrl } from '../core/links.js'
import { setBackgroundInert, trapTab } from './inert.js'

const DOCS_LOAD_MS = 12000

// The documentation site inside the page. Navigating away would unload the page and stop the music, which
// matters most in an iOS home-screen app where there is no tab to come back to, so the docs open in a sheet.
export function mountDocsSheet(root, { store, actions }) {
  const url = docsUrl()
  const scrim = h('div', { class: 'scrim', hidden: true, onClick: () => actions.closeDocs() })
  const closeBtn = h(
    'button',
    { class: 'iconbtn', type: 'button', 'aria-label': 'Close documentation', onClick: () => actions.closeDocs() },
    icon('close'),
  )
  const body = h('div', { class: 'sheet__frame' })
  const sheet = h(
    'aside',
    {
      class: 'sheet sheet--docs',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'docs-title',
      hidden: true,
    },
    h(
      'header',
      { class: 'sheet__head' },
      h('h2', { class: 'sheet__title', id: 'docs-title' }, 'Documentation'),
      h(
        'div',
        { class: 'sheet__tools' },
        h('a', { class: 'btn btn--text', ...linkProps(url) }, 'New tab', icon('external')),
        closeBtn,
      ),
    ),
    body,
  )
  root.append(scrim, sheet)
  sheet.addEventListener('keydown', (event) => trapTab(sheet, event))

  let open = false
  let returnFocus = null

  // Created on first open, then kept: reopening shows the page you left, and the download never touches first draw
  function ensureFrame() {
    if (body.firstChild) return
    // A page that never loads (docs site down, offline) would otherwise leave a blank sheet
    const fallback = h(
      'div',
      { class: 'docs-fallback', role: 'status', hidden: true },
      h('p', { class: 'empty__title' }, 'The documentation did not load.'),
      h('p', null, 'The site may be down or you may be offline.'),
      h('a', { class: 'btn', ...linkProps(url) }, 'Open in a new tab', icon('external')),
    )
    const frame = h('iframe', {
      class: 'docs-frame',
      src: url,
      title: 'Unmarked documentation',
      referrerpolicy: 'no-referrer',
    })
    const timer = setTimeout(() => {
      fallback.hidden = false
    }, DOCS_LOAD_MS)
    frame.addEventListener('load', () => {
      clearTimeout(timer)
      fallback.hidden = true
    })
    body.append(frame, fallback)
  }

  function show() {
    open = true
    returnFocus = document.activeElement
    ensureFrame()
    sheet.hidden = false
    scrim.hidden = false
    setBackgroundInert(root, true)
    // Two frames so the slide-in transition sees the pre-open position
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        sheet.dataset.open = ''
        scrim.dataset.open = ''
        closeBtn.focus({ preventScroll: true })
      }),
    )
  }

  function hide() {
    open = false
    sheet.removeAttribute('data-open')
    scrim.removeAttribute('data-open')
    setBackgroundInert(root, false)
    returnFocus?.focus?.({ preventScroll: true })
    setTimeout(
      () => {
        if (open) return
        sheet.hidden = true
        scrim.hidden = true
      },
      cssMs('--dur-slow') + 40,
    )
  }

  function render({ ui }) {
    if (ui.docsOpen && !open) show()
    else if (!ui.docsOpen && open) hide()
  }

  store.subscribe(render)
  render(store.get())
}
