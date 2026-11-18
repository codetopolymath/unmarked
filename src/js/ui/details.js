import { h, icon, linkProps } from '../core/dom.js'
import { cssMs } from '../core/motion.js'
import { detailSections, displayTitle } from '../core/format.js'
import { setBackgroundInert, trapTab } from './inert.js'

function renderRow(row, actions) {
  if (row.kind === 'prose') return h('p', { class: 'prose' }, row.value)
  if (row.kind === 'fineprint') return h('p', { class: 'fineprint' }, row.value)
  if (row.kind === 'credit') {
    return h(
      'div',
      null,
      h('p', { class: 'credit' }, row.value),
      h('button', { class: 'btn btn--text', type: 'button', onClick: () => actions.copyCredit() }, 'Copy credit line'),
    )
  }
  const value = row.href ? h('a', linkProps(row.href), row.value, icon('external')) : row.value
  return h(
    'div',
    { class: 'drow' },
    h('dt', { class: 'mono' }, row.label),
    h('dd', { class: row.mono ? 'mono' : '' }, value),
  )
}

// Groups label/value rows into a <dl>; free-form rows stay outside it
function renderRows(rows, actions) {
  const nodes = []
  let list = null
  for (const row of rows) {
    if (row.label) {
      if (!list) {
        list = h('dl')
        nodes.push(list)
      }
      list.append(renderRow(row, actions))
    } else {
      list = null
      nodes.push(renderRow(row, actions))
    }
  }
  return nodes
}

export function mountDetails(root, { store, actions }) {
  const scrim = h('div', { class: 'scrim', hidden: true, onClick: () => actions.closeDetails() })
  const title = h('h2', { class: 'sheet__title', id: 'sheet-title' }, 'Details')
  const closeBtn = h(
    'button',
    { class: 'iconbtn', type: 'button', 'aria-label': 'Close details', onClick: () => actions.closeDetails() },
    icon('close'),
  )
  const body = h('div', { class: 'sheet__body' })
  const sheet = h(
    'aside',
    { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title', hidden: true },
    h('header', { class: 'sheet__head' }, title, closeBtn),
    body,
  )
  root.append(scrim, sheet)
  sheet.addEventListener('keydown', (event) => trapTab(sheet, event))

  let open = false
  let returnFocus = null

  function show({ viewed, ui }) {
    open = true
    returnFocus = document.activeElement
    title.textContent = displayTitle(viewed)
    body.replaceChildren(
      ...detailSections(viewed).map((section) =>
        h(
          'section',
          { id: `dsec-${section.id}` },
          h('h3', { class: 'dsection__head mono' }, section.heading),
          ...renderRows(section.rows, actions),
        ),
      ),
    )
    sheet.hidden = false
    scrim.hidden = false
    setBackgroundInert(root, true)
    // Two frames so the slide-in transition sees the pre-open position
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        sheet.dataset.open = ''
        scrim.dataset.open = ''
        closeBtn.focus({ preventScroll: true })
        if (ui.detailsSection) body.querySelector(`#dsec-${ui.detailsSection}`)?.scrollIntoView({ block: 'start' })
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

  function render(state) {
    const wanted = state.ui.detailsOpen && Boolean(state.viewed)
    if (wanted && !open) show(state)
    else if (!wanted && open) hide()
  }

  store.subscribe(render)
  render(store.get())
}
