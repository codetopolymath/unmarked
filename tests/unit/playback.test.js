import { test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createPlayback, START_TIMEOUT_MS, STALL_MS } from '../../src/js/services/playback.js'

// Just enough of HTMLAudioElement for the player: events, src, position and pause semantics
class FakeAudio extends EventTarget {
  static last = null
  constructor() {
    super()
    this.paused = true
    this.currentTime = 0
    this.duration = NaN
    this.readyState = 0
    this.ended = false
    this.srcHistory = []
    this._src = ''
    FakeAudio.last = this
  }
  get src() {
    return this._src
  }
  set src(value) {
    this._src = value
    this.srcHistory.push(value)
    // Loading a new source restarts at zero, which is why the player must restore the position itself
    this.currentTime = 0
    this.readyState = 0
  }
  play() {
    this.paused = false
    return Promise.resolve()
  }
  pause() {
    if (this.paused) return
    this.paused = true
    queueMicrotask(() => this.dispatchEvent(new Event('pause')))
  }
  removeAttribute() {
    this._src = ''
  }
  load() {}
  fire(name) {
    this.dispatchEvent(new Event(name))
  }
}

const realAudio = globalThis.Audio
beforeEach(() => {
  globalThis.Audio = FakeAudio
  mock.timers.enable({ apis: ['setTimeout'] })
})
afterEach(() => {
  mock.timers.reset()
  globalThis.Audio = realAudio
})

function setup(options = {}) {
  const events = { status: [], notices: [], ended: 0 }
  const playback = createPlayback({
    synth: async () => new Blob(['x']),
    onStatus: (s) => events.status.push(s),
    onClock() {},
    onEnded: () => events.ended++,
    onNotice: (message) => events.notices.push(message),
    ...options,
  })
  return { playback, audio: FakeAudio.last, events }
}
const remote = (url, ...fallbacks) => ({ audio: { url, fallbacks } })
const last = (events) => events.status.at(-1)

test('a url that never starts moves to the next one, with a notice', async () => {
  const { playback, audio, events } = setup()
  await playback.load(remote('https://a/x.mp3', 'https://b/x.mp3'))
  assert.equal(audio.src, 'https://a/x.mp3')
  mock.timers.tick(START_TIMEOUT_MS)
  assert.equal(audio.src, 'https://b/x.mp3')
  assert.equal(events.notices.length, 1)
  assert.equal(last(events).status, 'loading')
  assert.ok(!events.status.some((s) => s.status === 'error'))
})

test('a hard error moves to the next url at once, and the last error is final', async () => {
  const { playback, audio, events } = setup()
  await playback.load(remote('https://a/x.mp3', 'https://b/x.mp3', 'https://c/x.mp3'))
  audio.fire('error')
  assert.equal(audio.src, 'https://b/x.mp3')
  audio.fire('error')
  assert.equal(audio.src, 'https://c/x.mp3')
  assert.equal(events.notices.length, 2)
  audio.fire('error')
  assert.deepEqual(last(events), { status: 'error', error: 'This track would not play' })
  assert.equal(audio.srcHistory.length, 3, 'no fourth attempt')
})

test('stuck re-buffering mid-song switches url and resumes at the same position', async () => {
  const { playback, audio, events } = setup()
  await playback.load(remote('https://a/x.mp3', 'https://b/x.mp3'))
  audio.fire('playing')
  audio.currentTime = 42
  audio.fire('waiting')
  mock.timers.tick(STALL_MS - 1)
  assert.equal(audio.src, 'https://a/x.mp3', 'not yet')
  mock.timers.tick(1)
  assert.equal(audio.src, 'https://b/x.mp3')
  assert.equal(audio.currentTime, 0, 'a fresh source starts at zero')
  audio.fire('loadedmetadata')
  assert.equal(audio.currentTime, 42)
  assert.equal(events.notices.length, 1)
})

test('the very start of a track is not "resumed"; only a real position is', async () => {
  const { playback, audio } = setup()
  await playback.load(remote('https://a/x.mp3', 'https://b/x.mp3'))
  audio.currentTime = 0.4
  mock.timers.tick(START_TIMEOUT_MS)
  audio.fire('loadedmetadata')
  assert.equal(audio.currentTime, 0)
})

test('a short hiccup that recovers is left alone', async () => {
  const { playback, audio, events } = setup()
  await playback.load(remote('https://a/x.mp3', 'https://b/x.mp3'))
  audio.fire('playing')
  audio.fire('waiting')
  mock.timers.tick(STALL_MS - 2000)
  audio.fire('playing')
  mock.timers.tick(STALL_MS * 5)
  assert.equal(audio.src, 'https://a/x.mp3')
  assert.equal(events.notices.length, 0)
})

test('a waiting event during start does not postpone the start deadline', async () => {
  const { playback, audio } = setup()
  await playback.load(remote('https://a/x.mp3', 'https://b/x.mp3'))
  mock.timers.tick(5000)
  audio.fire('waiting')
  mock.timers.tick(START_TIMEOUT_MS - 5000)
  assert.equal(audio.src, 'https://b/x.mp3')
})

test('a rescued stream that starts is not rescued again', async () => {
  const { playback, audio } = setup()
  await playback.load(remote('https://a/x.mp3', 'https://b/x.mp3', 'https://c/x.mp3'))
  mock.timers.tick(START_TIMEOUT_MS)
  audio.fire('playing')
  mock.timers.tick(START_TIMEOUT_MS * 4)
  assert.equal(audio.src, 'https://b/x.mp3')
})

test('with no fallback, a start that never happens fails the track as before', async () => {
  const { playback, events } = setup()
  await playback.load(remote('https://a/x.mp3'))
  mock.timers.tick(START_TIMEOUT_MS)
  assert.deepEqual(last(events), { status: 'error', error: 'This track stopped responding' })
  assert.equal(events.notices.length, 0)
})

test('running out of urls after a stall ends in an error, never a loop', async () => {
  const { playback, audio, events } = setup()
  await playback.load(remote('https://a/x.mp3', 'https://b/x.mp3'))
  mock.timers.tick(START_TIMEOUT_MS)
  mock.timers.tick(START_TIMEOUT_MS)
  assert.equal(last(events).status, 'error')
  assert.equal(audio.srcHistory.length, 2)
  mock.timers.tick(START_TIMEOUT_MS * 5)
  assert.equal(audio.srcHistory.length, 2)
})

test('pausing during a stall cancels the rescue', async () => {
  const { playback, audio } = setup()
  await playback.load(remote('https://a/x.mp3', 'https://b/x.mp3'))
  audio.fire('playing')
  audio.fire('waiting')
  playback.pause()
  await Promise.resolve()
  mock.timers.tick(STALL_MS * 3)
  assert.equal(audio.src, 'https://a/x.mp3')
})

test('synthesized audio can never hang, so it is never rescued', async () => {
  const { playback, audio, events } = setup()
  await playback.load({ audio: { seed: 's', seconds: 2 } })
  assert.match(audio.src, /^blob:/)
  audio.fire('waiting')
  mock.timers.tick(STALL_MS * 5)
  assert.ok(!events.status.some((s) => s.status === 'error'))
  assert.equal(events.notices.length, 0)
})

test("stopping, or loading another track, cancels the old track's timers", async () => {
  const stopped = setup()
  await stopped.playback.load(remote('https://a/x.mp3', 'https://b/x.mp3'))
  stopped.playback.stop()
  mock.timers.tick(START_TIMEOUT_MS * 2)
  assert.equal(stopped.audio.srcHistory.includes('https://b/x.mp3'), false)
  assert.equal(stopped.events.notices.length, 0)

  const replaced = setup()
  await replaced.playback.load(remote('https://a/x.mp3', 'https://b/x.mp3'))
  await replaced.playback.load(remote('https://c/y.mp3', 'https://d/y.mp3'))
  mock.timers.tick(START_TIMEOUT_MS)
  assert.equal(replaced.audio.src, 'https://d/y.mp3', "the new track's own fallback, not the old one's")
  assert.equal(replaced.audio.srcHistory.includes('https://b/x.mp3'), false)
})

test('pressing play on an unbuffered stream is timed like any other start', async () => {
  const { playback, audio } = setup()
  await playback.load(remote('https://a/x.mp3', 'https://b/x.mp3'), { autoplay: false })
  mock.timers.tick(START_TIMEOUT_MS * 2)
  assert.equal(audio.src, 'https://a/x.mp3', 'nothing is timed until play')
  await playback.play()
  mock.timers.tick(START_TIMEOUT_MS)
  assert.equal(audio.src, 'https://b/x.mp3')
})

test('the notice callback is optional', async () => {
  const { playback, audio } = setup({ onNotice: undefined })
  await playback.load(remote('https://a/x.mp3', 'https://b/x.mp3'))
  mock.timers.tick(START_TIMEOUT_MS)
  assert.equal(audio.src, 'https://b/x.mp3')
})
