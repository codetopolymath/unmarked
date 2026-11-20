// The real random draw made visible: an odometer that rolls to the actual ticket number.
import { h } from '../core/dom.js'
import { cssEase, cssMs, motionReduced } from '../core/motion.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Two extra cycles of 0-9 so a column can travel up to 19 steps
const STRIP_LENGTH = 30

export function formatCount(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function ticketText({ rank, total }) {
  return `Ticket ${formatCount(rank)} of ${formatCount(total)}`
}

// "Sep 2021", "Jan–Mar 2021" or "Dec 2020 – Feb 2021"; null bounds are the undated bucket
export function windowLabel(from, to) {
  if (!from || !to) return 'no upload date'
  const a = new Date(from)
  const b = new Date(to)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 'no upload date'
  const start = `${MONTHS[a.getUTCMonth()]} ${a.getUTCFullYear()}`
  const end = `${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}`
  if (start === end) return `uploaded ${start}`
  if (a.getUTCFullYear() === b.getUTCFullYear()) {
    return `uploaded ${MONTHS[a.getUTCMonth()]}–${MONTHS[b.getUTCMonth()]} ${a.getUTCFullYear()}`
  }
  return `uploaded ${start} – ${end}`
}

// One entry per drum column; pad marks leading zeros, group marks a thousands separator before the column
export function planColumns(rank, total) {
  const width = String(total).length
  const text = String(rank).padStart(width, '0')
  const padded = width - String(rank).length
  return [...text].map((char, index) => ({
    digit: Number(char),
    pad: index < padded,
    group: index > 0 && (width - index) % 3 === 0,
  }))
}

// Steps a column turns forward to land on `to`, always at least `turns` full cycles
export function rollTravel(from, to, turns = 1) {
  return ((to - from + 10) % 10) + 10 * turns
}

export function createDrawTicket() {
  const num = h('span', { class: 'ticket__num', 'aria-hidden': 'true' })
  const of = h('span', { class: 'ticket__of' })
  const flash = h('i', { class: 'ticket__flash' })
  const whenText = h('span')
  const when = h('span', { class: 'ticket__window', hidden: true }, ' · ', whenText, flash)
  const sr = h('span', { class: 'sr-only' })
  const el = h('span', { class: 'ticket mono' }, 'Ticket ', num, ' ', of, when, sr)

  let columns = []
  let digits = []
  let rolling = []
  let current = null

  const glyph = (n) => h('span', null, String(n))

  function build(width) {
    columns = Array.from({ length: width }, () => {
      const strip = h('span', { class: 'ticket__strip' }, glyph(0))
      return { el: h('span', { class: 'ticket__col' }, h('span', { class: 'ticket__win' }, strip)), strip }
    })
    digits = Array(width).fill(0)
    num.replaceChildren(...columns.map((column) => column.el))
  }

  function layout(plan) {
    if (columns.length !== plan.length) build(plan.length)
    plan.forEach((slot, index) => {
      columns[index].el.dataset.pad = String(slot.pad)
      columns[index].el.dataset.group = String(slot.group)
    })
  }

  function park(index, digit) {
    const { strip } = columns[index]
    strip.replaceChildren(glyph(digit))
    strip.style.transform = ''
    digits[index] = digit
  }

  function stopRolling() {
    for (const anim of rolling) anim.cancel()
    rolling = []
  }

  function showWindow(draw, animate) {
    whenText.textContent = windowLabel(draw.from, draw.to)
    when.hidden = false
    if (!animate) return
    const ease = cssEase('--ease-out')
    const slow = cssMs('--dur-slow')
    when.animate(
      [
        { opacity: 0, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: slow, easing: ease, fill: 'backwards' },
    )
    flash.animate(
      [
        { transform: 'scaleX(0)', opacity: 1 },
        { transform: 'scaleX(1)', opacity: 1, offset: 0.5 },
        { transform: 'scaleX(1)', opacity: 0 },
      ],
      { duration: slow * 1.4, easing: ease, fill: 'backwards' },
    )
  }

  // Resolves once every column has landed
  function rollTo(plan, { turns, speed = 1 }) {
    const ease = cssEase('--ease-out')
    const base = cssMs('--dur-develop') * 0.6
    const step = cssMs('--dur-stagger') * 1.6
    const finished = plan.map((slot, index) => {
      const from = digits[index]
      const travel = rollTravel(from, slot.digit, turns)
      const { strip } = columns[index]
      strip.replaceChildren(...Array.from({ length: STRIP_LENGTH }, (_, n) => glyph(n % 10)))
      const place = (position) => `translateY(${(-position / STRIP_LENGTH) * 100}%)`
      const anim = strip.animate([{ transform: place(from) }, { transform: place(from + travel) }], {
        duration: (base + index * step) / speed,
        easing: ease,
        fill: 'both',
      })
      rolling.push(anim)
      digits[index] = slot.digit
      return anim.finished.then(
        () => park(index, slot.digit),
        () => {},
      )
    })
    return Promise.all(finished)
  }

  function writeLabels(draw, announce) {
    of.textContent = `of ${formatCount(draw.total)}`
    sr.textContent = announce ? ticketText(draw) : ''
  }

  // A ticket in flight: roll to it, then reveal where it fell
  function show(draw) {
    if (current && current.rank === draw.rank && current.total === draw.total) return
    current = { ...draw }
    stopRolling()
    const plan = planColumns(draw.rank, draw.total)
    layout(plan)
    writeLabels(draw, false)
    when.hidden = true
    if (motionReduced()) {
      plan.forEach((slot, index) => park(index, slot.digit))
      showWindow(draw, false)
      return
    }
    const mine = current
    rollTo(plan, { turns: 1 }).then(() => {
      if (current === mine && when.hidden) showWindow(draw, true)
    })
  }

  // The record is ready: land on the ticket with a stamp. animate=false only restores the text.
  async function settle(draw, { animate = true } = {}) {
    const plan = planColumns(draw.rank, draw.total)
    const same = current && current.rank === draw.rank && current.total === draw.total
    if (!same) {
      current = { ...draw }
      stopRolling()
      layout(plan)
      plan.forEach((slot, index) => park(index, slot.digit))
      showWindow(draw, false)
    }
    writeLabels(draw, true)
    if (!animate || motionReduced()) {
      await Promise.all(rolling.map((anim) => anim.finished.catch(() => {})))
      showWindow(draw, false)
      return
    }
    // A roll still in flight hurries up instead of making the record wait
    for (const anim of rolling) anim.updatePlaybackRate(3)
    const hurrying = Promise.all(rolling.map((anim) => anim.finished.catch(() => {})))
    await hurrying
    if (!current || current.rank !== draw.rank) return
    const ease = cssEase('--ease-out')
    const slow = cssMs('--dur-slow')
    num.animate(
      [
        { transform: 'scale(1.08)', opacity: 0.6 },
        { transform: 'scale(0.985)', opacity: 1, offset: 0.55 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: slow * 0.7, easing: ease },
    )
    columns.forEach((column, index) => {
      column.el.animate([{ transform: 'translateY(-3px)' }, { transform: 'none' }], {
        duration: cssMs('--dur-base'),
        delay: index * cssMs('--dur-stagger'),
        easing: ease,
        fill: 'backwards',
      })
    })
    showWindow(draw, when.hidden)
  }

  return { el, show, settle }
}
