import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createStore } from '../../src/js/core/store.js'
import { pick, seeded } from '../../src/js/core/random.js'

test('seeded random is deterministic per seed and stays in [0, 1)', () => {
  const a = seeded('record:1')
  const b = seeded('record:1')
  const first = Array.from({ length: 20 }, () => a())
  assert.deepEqual(
    first,
    Array.from({ length: 20 }, () => b()),
  )
  assert.ok(first.every((v) => v >= 0 && v < 1))
  assert.notDeepEqual(
    first,
    Array.from(
      { length: 20 },
      (
        (rnd) => () =>
          rnd()
      )(seeded('record:2')),
    ),
  )
})

test('pick returns a member of the list', () => {
  const list = ['a', 'b', 'c']
  const rnd = seeded('pick')
  for (let i = 0; i < 30; i++) assert.ok(list.includes(pick(rnd, list)))
})

test('store merges patches, supports updater functions and one-level updates', () => {
  const store = createStore({ count: 1, nested: { a: 1, b: 2 } })
  store.set({ count: 2 })
  assert.equal(store.get().count, 2)
  store.set((state) => ({ count: state.count + 1 }))
  assert.equal(store.get().count, 3)
  store.update('nested', { b: 9 })
  assert.deepEqual(store.get().nested, { a: 1, b: 9 })
})

test('store notifies subscribers synchronously and stops after unsubscribe', () => {
  const store = createStore({ n: 0 })
  const seen = []
  const unsubscribe = store.subscribe((state) => seen.push(state.n))
  store.set({ n: 1 })
  store.set({ n: 2 })
  unsubscribe()
  store.set({ n: 3 })
  assert.deepEqual(seen, [1, 2])
})
