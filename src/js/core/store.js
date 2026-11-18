// Minimal observable store: shallow top-level merge, synchronous listeners
export function createStore(initial) {
  let state = initial
  const listeners = new Set()

  function notify() {
    for (const listener of listeners) listener(state)
  }

  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
      notify()
    },
    // One-level-deep merge for the nested slices (player, ui, draw, prefs)
    update(key, partial) {
      state = { ...state, [key]: { ...state[key], ...partial } }
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
