import { synthesizeWav } from './tone-synth.js'

const START_TIMEOUT_MS = 15000

// One <audio> element behind a small interface; tracks carry a stream url, or a seed for the prototype synth
export function createPlayback({ synth = synthesizeWav, onStatus, onClock, onEnded }) {
  const audio = new Audio()
  audio.preload = 'auto'

  const blobs = new Map()
  let objectUrl = null
  let token = 0
  let ownPause = false

  // A stream that never starts would leave the player "loading" forever
  let startTimer = null
  const disarm = () => {
    clearTimeout(startTimer)
    startTimer = null
  }
  const arm = () => {
    disarm()
    startTimer = setTimeout(() => {
      ownPause = !audio.paused
      audio.pause()
      onStatus({ status: 'error', error: 'This track took too long to start' })
    }, START_TIMEOUT_MS)
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
  audio.addEventListener('waiting', () => onStatus({ status: 'loading' }))
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
    onStatus({ status: 'error', error: 'This track would not play' })
  })

  async function play() {
    try {
      await audio.play()
    } catch (error) {
      if (error.name !== 'AbortError') onStatus({ status: 'paused', blocked: error.name === 'NotAllowedError' })
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

    let src = track.audio.url
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
    objectUrl = track.audio.url ? null : src
    audio.src = src
    if (autoplay) {
      // Synthesized audio starts instantly; only a remote stream can hang
      if (track.audio.url) arm()
      await play()
    } else onStatus({ status: 'paused' })
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
