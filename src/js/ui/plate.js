import { h } from '../core/dom.js'
import { cssMs, motionReduced } from '../core/motion.js'

// The artwork plate: new cover "develops" in over the old one, like a print in a darkroom tray
export function createPlate() {
  const scan = h('div', { class: 'plate__scan', 'aria-hidden': 'true' })
  const frame = h('div', { class: 'plate__frame', 'data-empty': '' }, scan)
  const left = h('span')
  const right = h('span')
  const caption = h('figcaption', { class: 'plate__caption mono', 'data-has-note': 'false' }, left, right)
  const el = h(
    'figure',
    { class: 'plate', 'data-loading': 'false' },
    h('div', { class: 'plate__mount', 'aria-hidden': 'true' }),
    frame,
    caption,
  )

  async function show(art, { label = '', note = '' } = {}) {
    const img = h('img', { class: 'plate__img', src: art.url, alt: art.alt })
    const previous = [...frame.querySelectorAll('.plate__img')]
    left.textContent = label
    right.textContent = note
    caption.dataset.hasNote = String(Boolean(note))
    // Decode first so the reveal never starts on a half-painted image
    try {
      await img.decode()
    } catch {
      /* a failed decode still shows the image */
    }
    frame.removeAttribute('data-empty')
    // Above older covers, below the scan line
    frame.insertBefore(img, scan)

    if (motionReduced()) {
      previous.forEach((old) => old.remove())
      return
    }
    img.animate(
      [
        { opacity: 0, filter: 'grayscale(1) brightness(0.55) contrast(1.25) blur(10px)', transform: 'scale(1.035)' },
        { opacity: 1, filter: 'none', transform: 'none' },
      ],
      { duration: cssMs('--dur-develop'), easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'backwards' },
    )
    for (const old of previous) {
      const fade = old.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: cssMs('--dur-slow'),
        easing: 'ease-out',
        fill: 'forwards',
      })
      fade.onfinish = () => old.remove()
    }
  }

  return {
    el,
    show,
    setLoading: (loading) => {
      el.dataset.loading = String(loading)
    },
  }
}
