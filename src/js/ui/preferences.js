import { h, icon } from '../core/dom.js'
import { setBackgroundInert, trapTab } from './inert.js'

const SHORTCUTS = [
  ['Space', 'Play or pause'],
  ['D', 'Discover another'],
  ['B', 'Previous discovery'],
  ['← →', 'Previous or next track'],
  ['K', 'Keep or release'],
  ['I', 'Details'],
  ['L', 'Library'],
  ['S', 'Sources'],
  ['E', 'Expand player'],
  ['M', 'Mute'],
  ['P', 'Prototype controls'],
  ['Esc', 'Close'],
]

const MOTION_CHOICES = [
  ['system', 'System'],
  ['reduced', 'Reduced'],
  ['full', 'Full'],
]

export function mountPreferences(root, { store, actions, mode }) {
  const shortcuts = mode === 'mock' ? SHORTCUTS : SHORTCUTS.filter(([key]) => key !== 'P')
  function switchRow(label, key, hint) {
    const input = h('input', {
      type: 'checkbox',
      role: 'switch',
      onChange: (event) => actions.setPref(key, event.target.checked),
    })
    const text = h('span', null, label, hint ? h('small', { class: 'switch__hint' }, hint) : null)
    return { input, row: h('label', { class: 'switch' }, text, input) }
  }
  const autoplay = switchRow('Play new discoveries automatically', 'autoplay')
  const autocontinue = switchRow('Continue to a new discovery after the last track', 'autocontinue')
  const audius = switchRow(
    'Draw from Audius too',
    'audius',
    'Independent artists, leaning electronic and hip-hop. Most tracks are all rights reserved.',
  )
  const motionButtons = MOTION_CHOICES.map(([value, label]) =>
    h(
      'button',
      { type: 'button', 'data-value': value, 'aria-pressed': 'false', onClick: () => actions.setPref('motion', value) },
      label,
    ),
  )
  const closeBtn = h('button', { class: 'btn btn--text', type: 'button', onClick: () => actions.closePrefs() }, 'Close')

  const panel = h(
    'div',
    {
      class: 'prefs panel',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Preferences and shortcuts',
      hidden: true,
    },
    h('div', { class: 'panel__head mono' }, h('span', null, 'Preferences'), closeBtn),
    autoplay.row,
    autocontinue.row,
    // The mock catalogue has no Audius to switch
    mode === 'mock' ? null : audius.row,
    h(
      'div',
      null,
      h('p', { class: 'field-label mono' }, 'Motion'),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Motion' }, motionButtons),
    ),
    // The only way to reach the docs on a phone, where the topbar has no room for a link
    h(
      'button',
      { class: 'btn', type: 'button', 'aria-haspopup': 'dialog', onClick: () => actions.openDocs() },
      'Documentation',
      icon('arrow'),
    ),
    h(
      'div',
      { class: 'prefs__keys' },
      h('p', { class: 'field-label mono' }, 'Keyboard'),
      h(
        'dl',
        { class: 'keys' },
        shortcuts.flatMap(([key, label]) => [h('dt', null, h('kbd', null, key)), h('dd', null, label)]),
      ),
    ),
    mode === 'mock'
      ? h(
          'button',
          {
            class: 'btn',
            type: 'button',
            onClick: () => {
              actions.closePrefs()
              actions.toggleProto()
            },
          },
          'Prototype controls',
        )
      : null,
  )
  root.append(panel)
  panel.addEventListener('keydown', (event) => trapTab(panel, event))

  document.addEventListener('pointerdown', (event) => {
    if (store.get().ui.prefsOpen && !panel.contains(event.target) && !event.target.closest('[aria-haspopup="dialog"]'))
      actions.closePrefs()
  })

  let wasOpen = false
  function render({ ui, prefs, player }) {
    panel.hidden = !ui.prefsOpen
    // Modal like the other dialogs: the page behind stays inert unless another dialog still needs it that way
    setBackgroundInert(root, ui.prefsOpen || ui.detailsOpen || ui.docsOpen || player.expanded)
    // iOS Safari lets a swipe on a popover chain into the page behind it, so freeze the page while it is open
    root.toggleAttribute('data-popover-open', ui.prefsOpen)
    autoplay.input.checked = prefs.autoplay
    autocontinue.input.checked = prefs.autocontinue
    audius.input.checked = prefs.audius !== false
    for (const button of motionButtons)
      button.setAttribute('aria-pressed', String(button.dataset.value === prefs.motion))
    if (ui.prefsOpen && !wasOpen) closeBtn.focus({ preventScroll: true })
    wasOpen = ui.prefsOpen
  }
  store.subscribe(render)
  render(store.get())
}
