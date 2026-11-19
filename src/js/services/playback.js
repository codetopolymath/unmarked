import { synthesizeWav } from './tone-synth.js'

// First start of a url: past this the server is not answering
export const START_TIMEOUT_MS = 15000
// Stuck re-buffering mid-song: short enough to notice, long enough to ride out an ordinary hiccup
export const STALL_MS = 10000

// One <audio> element behind a small interface. A track carries a stream url plus optional fallback urls
// (other servers or formats), or a seed for the prototype synth. A dead, silent or stalled url moves on
// to the next one and resumes at the same place; only when all are spent does the track fail.
export function createPlayback({ synth = synthesizeWav, onStatus, onClock, onEnded, onNotice = () => {} }) {
  const audio = new Audio()
  audio.preload = 'auto'

  const blobs = new Map()
  let objectUrl = null
  let token = 0
  let ownPause = false

  // Remote urls to try in order; empty for synthesized audio, which cannot hang
  let candidates = []
  let candidate = 0

  let watchdog = null
  const disarm = () => {
    clearTimeout(watchdog)
    watchdog = null
  }
  const arm = (ms) => {
    disarm()
    watchdog = setTimeout(() => {
      watchdog = null
      if (!rescue()) {
        ownPause = !audio.paused
        audio.pause()
        onStatus({ status: 'error', error: 'This track stopped responding' })
      }
    }, ms)
  }

  // Next url, same position; false when none is left
  function rescue() {
    if (candidate + 1 >= candidates.length) return false
    const position = audio.currentTime || 0
    candidate += 1
    onNotice('That server is not responding. Trying another.')
    ownPause = !audio.paused
    audio.pause()
    audio.src = candidates[candidate]
    if (position > 1) {
      audio.addEventListener(
        'loadedmetadata',
        () => {
          audio.currentTime = position
        },
        { once: true },
      )
    }
    onStatus({ status: 'loading' })
    arm(START_TIMEOUT_MS)
    play()
    return true
  }

  const clock = () =>
    onClock({
      position: audio.currentTime || 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    })

  audio.addEventListener('playing', () => {
    disarm()
    onStatus({ status: 'playing' })
  })
  audio.addEventListener('waiting', () => {
    onStatus({ status: 'loading' })
    // A start already being timed keeps its own clock; otherwise this is a mid-song stall
    if (candidates.length && !watchdog) arm(STALL_MS)
  })
  audio.addEventListener('pause', () => {
    // Our own pause() before a track swap must not surface as a user pause
    if (ownPause) {
      ownPause = false
      return
    }
    disarm()
    if (!audio.ended) onStatus({ status: 'paused' })
  })
  audio.addEventListener('timeupdate', clock)
  audio.addEventListener('durationchange', clock)
  audio.addEventListener('ended', () => {
    disarm()
    onEnded()
  })
  audio.addEventListener('error', () => {
    disarm()
    if (rescue()) return
    onStatus({ status: 'error', error: 'This track would not play' })
  })

  async function play() {
    // Pressing play on a stream that has not buffered yet is a start like any other
    if (candidates.length && audio.readyState < 3 && !watchdog) arm(START_TIMEOUT_MS)
    try {
      await audio.play()
    } catch (error) {
      // AbortError: a newer load replaced this one. NotSupportedError: the source failed, and the element's own
      // error event reports that (and tries the next url); answering "paused" here would overwrite it.
      if (error.name === 'AbortError' || error.name === 'NotSupportedError') return
      onStatus({ status: 'paused', blocked: error.name === 'NotAllowedError' })
    }
  }

  async function load(track, { autoplay = true } = {}) {
    const mine = ++token
    disarm()
    if (!audio.paused) {
      ownPause = true
      audio.pause()
    }
    onClock({ position: 0, duration: 0 })
    if (track.fail) {
      onStatus({ status: 'error', error: 'This track would not play' })
      return
    }
    onStatus({ status: 'loading' })

    candidates = track.audio.url ? [track.audio.url, ...(track.audio.fallbacks ?? [])] : []
    candidate = 0
    let src = candidates[0]
    if (!src) {
      const key = `${track.audio.seed}:${track.audio.seconds}`
      let blob = blobs.get(key)
      if (!blob) {
        blob = await synth(track.audio)
        blobs.set(key, blob)
        if (blobs.size > 4) blobs.delete(blobs.keys().next().value)
      }
      if (mine !== token) return
      src = URL.createObjectURL(blob)
    }

    if (objectUrl) URL.revokeObjectURL(objectUrl)
    // Only synthesized audio lives behind an object URL that needs revoking
    objectUrl = candidates.length ? null : src
    audio.src = src
    if (autoplay) await play()
    else onStatus({ status: 'paused' })
  }

  return {
    load,
    play,
    pause: () => audio.pause(),
    seek(seconds) {
      if (audio.duration) audio.currentTime = Math.max(0, Math.min(audio.duration, seconds))
    },
    setVolume: (value) => {
      audio.volume = value
    },
    setMuted: (muted) => {
      audio.muted = muted
    },
    stop() {
      token += 1
      disarm()
      candidates = []
      candidate = 0
      ownPause = !audio.paused
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      onClock({ position: 0, duration: 0 })
    },
    get position() {
      return audio.currentTime
    },
    get duration() {
      return Number.isFinite(audio.duration) ? audio.duration : 0
    },
  }
}
