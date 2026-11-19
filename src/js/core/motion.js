export function motionReduced() {
  const pref = document.documentElement.dataset.motion
  if (pref === 'reduced') return true
  if (pref === 'full') return false
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Reads a duration token so JS animations match the stylesheet
export function cssMs(name) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0
}

// View Transitions where supported; otherwise the update simply applies
export function withTransition(update) {
  if (motionReduced() || typeof document.startViewTransition !== 'function') {
    update()
    return
  }
  const transition = document.startViewTransition(update)
  // A newer transition skips this one and rejects both promises with an AbortError; that is routine when
  // views change faster than they animate. Anything else is a real failure and stays unhandled.
  const ignoreSkip = (error) => {
    if (error?.name !== 'AbortError') throw error
  }
  transition.ready.catch(ignoreSkip)
  transition.finished.catch(ignoreSkip)
}

export function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const id = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}
