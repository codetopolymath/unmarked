import { seeded, pick } from '../core/random.js'

const TAU = Math.PI * 2
const ROOTS = [98, 110, 123.47, 130.81, 146.83, 164.81]
const RATIOS = [9 / 8, 5 / 4, 3 / 2, 5 / 3, 15 / 8]
const CONTROL_RATE = 128

function writeHeader(view, samples, rate) {
  const bytes = samples * 2
  const text = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + bytes, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, bytes, true)
}

// Placeholder audio: a slow three-voice drone, deterministic per seed. Not music, not a recording.
export async function synthesizeWav({ seed, seconds, sampleRate = 11025 }) {
  const rnd = seeded(`tone:${seed}`)
  const samples = Math.max(1, Math.floor(seconds * sampleRate))
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  writeHeader(view, samples, sampleRate)

  const root = pick(rnd, ROOTS)
  const voices = [1, pick(rnd, RATIOS), 2 * pick(rnd, RATIOS)].map((ratio, i) => ({
    inc: (TAU * root * ratio) / sampleRate,
    phase: rnd() * TAU,
    lfo: (TAU * (0.04 + rnd() * 0.16)) / sampleRate,
    lfoPhase: rnd() * TAU,
    gain: [0.5, 0.32, 0.2][i],
    amp: 0,
  }))

  let noise = 0
  for (let n = 0; n < samples; n++) {
    if (n % CONTROL_RATE === 0) for (const v of voices) v.amp = 0.55 + 0.45 * Math.sin(v.lfoPhase + v.lfo * n)
    let sum = 0
    for (const v of voices) {
      v.phase += v.inc
      sum += Math.sin(v.phase) * v.amp * v.gain
    }
    noise = noise * 0.985 + (rnd() - 0.5) * 0.03
    const t = n / sampleRate
    const envelope = Math.max(0, Math.min(1, t / 1.5, (seconds - t) / 2))
    const value = Math.max(-1, Math.min(1, (sum + noise) * 0.2 * envelope))
    view.setInt16(44 + n * 2, value * 32767, true)
    // Yield so long tracks never freeze the page
    if (n % 400000 === 399999) await new Promise((resolve) => setTimeout(resolve))
  }
  return new Blob([buffer], { type: 'audio/wav' })
}
