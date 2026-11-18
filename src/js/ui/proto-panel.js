import { h } from '../core/dom.js'
import { RECORDS } from '../data/mock-records.js'

const JUMPS = [
  ['mock:001', 'Full album'],
  ['mock:002', 'Single recording'],
  ['mock:003', 'Minimal metadata'],
  ['mock:004', 'Very long strings'],
  ['mock:005', 'No cover'],
  ['mock:006', '24 tracks'],
  ['mock:007', 'All rights reserved'],
  ['mock:008', 'Non-Latin text'],
  ['mock:009', 'Track that fails'],
  ['mock:011', 'Live recording'],
  ['mock:012', 'Saturated art'],
  ['mock:013', 'Bright art'],
  ['mock:014', 'Empty record'],
]

// Evaluation aid, not product UI: delete this file and its mount to ship
export function mountProtoPanel(root, { store, actions, source }) {
  const jumpButtons = JUMPS.filter(([id]) => RECORDS.some((r) => r.id === id)).map(([id, label]) =>
    h(
      'button',
      {
        class: 'btn',
        type: 'button',
        onClick: () => {
          source.settings.nextId = id
          actions.discover({ autoplay: false })
        },
      },
      label,
    ),
  )
  const latencyValue = h('span', null, `${source.settings.latencyMs} ms`)
  const latency = h('input', {
    class: 'range',
    type: 'range',
    min: '0',
    max: '4000',
    step: '100',
    value: String(source.settings.latencyMs),
    'aria-label': 'Simulated draw latency',
    onInput: (event) => {
      source.settings.latencyMs = Number(event.target.value)
      latencyValue.textContent = `${event.target.value} ms`
    },
  })
  const panel = h(
    'div',
    { class: 'panel proto-panel', id: 'proto-panel', hidden: true, role: 'region', 'aria-label': 'Prototype controls' },
    h('div', { class: 'panel__head mono' }, h('span', null, 'Prototype controls')),
    h('p', { class: 'field-label mono' }, 'Draw a specific mock record'),
    h('div', { class: 'proto-grid' }, jumpButtons),
    h('p', { class: 'field-label mono' }, 'Simulate'),
    h('label', null, h('span', null, 'Draw latency '), latencyValue, latency),
    h(
      'div',
      { class: 'proto-grid' },
      h(
        'button',
        {
          class: 'btn',
          type: 'button',
          onClick: () => {
            source.settings.failNext = true
            actions.discover()
          },
        },
        'Failing draw',
      ),
      h('button', { class: 'btn', type: 'button', onClick: () => actions.proto.seekToEnd(5) }, 'Skip to last 5 s'),
    ),
    h('p', { class: 'field-label mono' }, 'Library'),
    h(
      'div',
      { class: 'proto-grid' },
      h(
        'button',
        { class: 'btn', type: 'button', onClick: () => actions.proto.seedDemoLibrary() },
        'Fill demo library',
      ),
      h('button', { class: 'btn', type: 'button', onClick: () => actions.proto.resetLibrary() }, 'Reset library'),
    ),
  )
  root.append(h('div', { class: 'proto' }, panel))

  function render({ ui }) {
    panel.hidden = !ui.protoOpen
  }
  store.subscribe(render)
  render(store.get())
}

// URL parameters let a design review jump straight to a state, e.g. ?record=mock:004&play=1&expand=1
export async function runUrlScenario({ actions, store, clock, source }, params) {
  if (params.has('latency')) source.settings.latencyMs = Number(params.get('latency'))
  if (params.has('motion')) actions.setPref('motion', params.get('motion'))
  if (params.has('seed')) actions.proto.seedDemoLibrary()
  if (params.has('fail')) source.settings.failNext = true
  if (params.get('record')) source.settings.nextId = params.get('record')

  const drawing = actions.discover({ autoplay: false })
  if (params.has('hang')) return
  await drawing

  const view = params.get('view')
  if (view === 'kept' || view === 'history') actions.showLibrary(view)
  if (params.has('details')) actions.openDetails(params.get('details') || null)
  if (params.has('play') && store.get().viewed) actions.playTrack(store.get().viewed, Number(params.get('track') ?? 0))
  if (params.has('seek')) {
    const unsubscribe = clock.subscribe(({ duration }) => {
      if (!duration) return
      unsubscribe()
      actions.proto.seekRatio(Number(params.get('seek')))
    })
  }
  if (params.has('expand')) actions.expandPlayer()
  if (params.has('prefs')) actions.togglePrefs()
}
