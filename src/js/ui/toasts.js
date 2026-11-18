import { h } from '../core/dom.js'
import { cssMs } from '../core/motion.js'

const VISIBLE_MS = 4500
const MAX_VISIBLE = 3

// Visible toasts for sighted users; a separate polite live region carries every message to screen readers
export function createToasts(parent) {
  const stack = h('div', { class: 'toasts' })
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' })
  parent.append(stack, live)

  function say(message) {
    live.textContent = ''
    // Re-set on the next frame so repeated identical messages are announced again
    requestAnimationFrame(() => {
      live.textContent = message
    })
  }

  function notify(message) {
    const toast = h('div', { class: 'toast' }, message)
    stack.append(toast)
    while (stack.children.length > MAX_VISIBLE) stack.firstElementChild.remove()
    say(message)
    setTimeout(() => {
      toast.dataset.leaving = ''
      setTimeout(() => toast.remove(), cssMs('--dur-base') + 20)
    }, VISIBLE_MS)
  }

  return { notify, announce: say }
}
