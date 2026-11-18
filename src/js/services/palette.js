const BASE = [18, 17, 16]
const INK_3 = [163, 155, 142]

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function luminance([r, g, b]) {
  const f = (c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t))
export const rgbCss = (c) => `rgb(${c.join(' ')})`

function hueOf(r, g, b, max, min) {
  if (max === min) return 0
  const d = max - min
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

function rgbToHsl([r, g, b]) {
  const hi = Math.max(r, g, b)
  const lo = Math.min(r, g, b)
  const l = (hi + lo) / 510
  const d = (hi - lo) / 255
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return [hueOf(r, g, b, hi, lo), s, l]
}

function hslToRgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  return [r, g, b].map((v) => Math.round((v + m) * 255))
}

// Dominant vivid colours from a coarse hue/saturation/value histogram
export function extractPalette({ data, width, height }) {
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 32))
  const buckets = new Map()
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4
      if (data[i + 3] < 128) continue
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const v = max / 255
      const s = max === 0 ? 0 : (max - min) / max
      // Near-black and near-white paper would wash out every cover
      if (v < 0.12 || (s < 0.08 && v > 0.93)) continue
      const hue = hueOf(r, g, b, max, min)
      const key = `${Math.floor(hue / 30)}:${Math.min(2, Math.floor(s * 3))}:${Math.min(2, Math.floor(v * 3))}`
      const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0, s: 0, v: 0, hue }
      bucket.n += 1
      bucket.r += r
      bucket.g += g
      bucket.b += b
      bucket.s += s
      bucket.v += v
      buckets.set(key, bucket)
    }
  }

  const ranked = [...buckets.values()]
    .map((b) => ({
      rgb: [Math.round(b.r / b.n), Math.round(b.g / b.n), Math.round(b.b / b.n)],
      hue: b.hue,
      score: b.n * (0.35 + b.s / b.n) * (b.v / b.n > 0.25 && b.v / b.n < 0.85 ? 1 : 0.6),
    }))
    .sort((a, z) => z.score - a.score)

  if (!ranked.length) return { tint: [120, 108, 96], tint2: [80, 72, 64] }
  const first = ranked[0]
  const distinct = ranked.find((c) => Math.min(Math.abs(c.hue - first.hue), 360 - Math.abs(c.hue - first.hue)) >= 60)
  return { tint: first.rgb, tint2: (distinct ?? first).rgb }
}

// Strength shrinks until tertiary text keeps 4.6:1 on the wash, so bright covers cannot break legibility
export function deriveTheme({ tint, tint2 }) {
  const [h, s, l] = rgbToHsl(tint)
  const safe = hslToRgb([h, Math.min(s, 0.75), clamp(l, 0.22, 0.6)])
  let strength = 0.16
  while (strength > 0.02 && contrast(INK_3, mix(BASE, safe, strength)) < 4.6) strength -= 0.01
  return { tint: safe, tint2, strength, wash: mix(BASE, safe, strength) }
}
