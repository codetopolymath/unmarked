const BACKGROUND = '.topbar, .main, .actionbar, .dock'

// Keeps focus and screen readers inside an open dialog
export function setBackgroundInert(root, inert) {
  for (const node of root.querySelectorAll(BACKGROUND)) node.toggleAttribute('inert', inert)
}

export function trapTab(container, event) {
  if (event.key !== 'Tab') return
  const focusable = [
    ...container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]'),
  ].filter((node) => !node.closest('[hidden]'))
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
