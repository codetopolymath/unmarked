import { h } from '../core/dom.js'
import { cssMs } from '../core/motion.js'

const VISIBLE_MS = 4500
const UNDO_VISIBLE_MS = 8000
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

  // An undo action keeps the toast up longer and takes it down once used
  function notify(message, { undo } = {}) {
    const toast = h('div', { class: 'toast' }, h('span', null, message))
    const dismiss = () => {
      toast.dataset.leaving = ''
      setTimeout(() => toast.remove(), cssMs('--dur-base') + 20)
    }
    if (undo) {
      toast.append(
        h(
          'button',
          {
            class: 'toast__action mono',
            type: 'button',
            onClick: () => {
              undo()
              dismiss()
            },
          },
          'Undo',
        ),
      )
    }
    stack.append(toast)
    while (stack.children.length > MAX_VISIBLE) stack.firstElementChild.remove()
    say(undo ? `${message}. Undo is available.` : message)
    setTimeout(dismiss, undo ? UNDO_VISIBLE_MS : VISIBLE_MS)
  }

  return { notify, announce: say }
}
