import { h } from '../core/dom.js'
import { formatTime } from '../core/format.js'
import { seeded } from '../core/random.js'

const NS = 'http://www.w3.org/2000/svg'
const BARS = 72

// Progress as a row of bars. The heights are decorative and seeded per record, not real audio analysis.
export function createScrubber({ variant = 'bars', tall = false, label = 'Seek', onSeek } = {}) {
  if (variant === 'line') {
    const bar = h('div', { class: 'scrubber__bar' })
    const el = h('div', { class: 'scrubber scrubber--line', 'aria-hidden': 'true' }, bar)
    return {
      el,
      setSeed() {},
      setClock(position, duration) {
        el.style.setProperty('--r', duration ? String(Math.min(1, position / duration)) : '0')
      },
    }
  }

  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${BARS * 4} 40`)
  svg.setAttribute('preserveAspectRatio', 'none')
  svg.setAttribute('aria-hidden', 'true')
  const base = document.createElementNS(NS, 'g')
  base.setAttribute('class', 'scrubber__base')
  const fill = document.createElementNS(NS, 'g')
  fill.setAttribute('class', 'scrubber__fill')
  svg.append(base, fill)

  const el = h('div', {
    class: `scrubber${tall ? ' scrubber--tall' : ''}`,
    role: 'slider',
    tabindex: '0',
    'aria-label': label,
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    'aria-valuenow': '0',
    'aria-disabled': 'true',
  })
  el.append(svg)

  let duration = 0
  let position = 0
  let dragging = false

  function setSeed(seed) {
    const rnd = seeded(`wave:${seed}`)
    let level = 0.5
    base.replaceChildren()
    fill.replaceChildren()
    for (let i = 0; i < BARS; i++) {
      level = Math.max(0.12, Math.min(1, level + (rnd() - 0.5) * 0.5))
      for (const group of [base, fill]) {
        const rect = document.createElementNS(NS, 'rect')
        const height = level * 34
        rect.setAttribute('x', String(i * 4 + 0.5))
        rect.setAttribute('y', String((40 - height) / 2))
        rect.setAttribute('width', '2.6')
        rect.setAttribute('height', String(height))
        rect.setAttribute('rx', '1.3')
        group.append(rect)
      }
    }
  }

  function paint() {
    const ratio = duration ? Math.min(1, position / duration) : 0
    el.style.setProperty('--p', `${ratio * 100}%`)
    el.setAttribute('aria-valuenow', String(Math.round(ratio * 100)))
    el.setAttribute('aria-valuetext', duration ? `${formatTime(position)} of ${formatTime(duration)}` : 'Not loaded')
    el.setAttribute('aria-disabled', String(!duration))
  }

  function setClock(nextPosition, nextDuration) {
    duration = nextDuration
    if (!dragging) position = nextPosition
    paint()
  }

  function seekTo(seconds) {
    if (!duration) return
    position = Math.max(0, Math.min(duration, seconds))
    paint()
    onSeek?.(position)
  }

  const ratioOf = (event) => {
    const box = el.getBoundingClientRect()
    return Math.max(0, Math.min(1, (event.clientX - box.left) / box.width))
  }

  el.addEventListener('pointerdown', (event) => {
    if (!duration) return
    dragging = true
    el.setPointerCapture(event.pointerId)
    seekTo(ratioOf(event) * duration)
  })
  el.addEventListener('pointermove', (event) => {
    if (dragging) seekTo(ratioOf(event) * duration)
  })
  el.addEventListener('pointerup', () => {
    dragging = false
  })
  el.addEventListener('pointercancel', () => {
    dragging = false
  })

  el.addEventListener('keydown', (event) => {
    const step = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -30, PageUp: 30 }[event.key]
    if (step !== undefined) seekTo(position + step)
    else if (event.key === 'Home') seekTo(0)
    else if (event.key === 'End') seekTo(duration)
    else return
    event.preventDefault()
  })

  setSeed('default')
  return { el, setSeed, setClock }
}
