import { seeded, pick } from '../core/random.js'
import { displayTitle } from '../core/format.js'
import { extractPalette } from './palette.js'

const SIZE = 720
const TAU = Math.PI * 2

// [background, accent, accent, accent]; the last two are test palettes for the wash guard
const PALETTES = {
  ember: ['#2b1a15', '#d9573b', '#f0c9a6', '#7a2e22'],
  moss: ['#131b15', '#5f7a4e', '#d6d2a8', '#2e3b2a'],
  tide: ['#0f1626', '#2f4a8a', '#e9e2d0', '#89a0c8'],
  ochre: ['#1d1710', '#c58b2a', '#efe3c2', '#6b4a16'],
  rose: ['#1f1215', '#b5485d', '#f2d5d0', '#5a2a35'],
  slate: ['#141414', '#bdbdbd', '#f2f2f2', '#4a4a4a'],
  saturated: ['#0a0a0a', '#ff2d55', '#ffd400', '#00a3ff'],
  bright: ['#f4f1ea', '#1a1a1a', '#d94f30', '#e9c46a'],
}
const PLACEHOLDER_PALETTES = ['ember', 'moss', 'tide', 'ochre', 'rose', 'slate']

const fill = (ctx, color) => {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, SIZE, SIZE)
}

function rings(ctx, rnd, p) {
  fill(ctx, p[0])
  const cx = SIZE * (0.32 + rnd() * 0.36)
  const cy = SIZE * (0.32 + rnd() * 0.36)
  const count = 8 + Math.floor(rnd() * 5)
  for (let i = count; i > 0; i--) {
    ctx.fillStyle = p[1 + (i % 3)]
    ctx.beginPath()
    ctx.arc(cx + (rnd() - 0.5) * 14, cy + (rnd() - 0.5) * 14, i * SIZE * 0.052, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = p[0]
  ctx.beginPath()
  ctx.arc(cx, cy, SIZE * 0.03, 0, TAU)
  ctx.fill()
}

function stripes(ctx, rnd, p) {
  fill(ctx, p[0])
  let x = 0
  let i = 0
  while (x < SIZE) {
    const w = SIZE * (0.03 + rnd() * 0.13)
    ctx.fillStyle = p[1 + (i++ % 3)]
    ctx.fillRect(x, 0, w, SIZE)
    x += w + (rnd() < 0.35 ? SIZE * 0.02 : 0)
  }
  ctx.fillStyle = p[0]
  ctx.fillRect(0, SIZE * (0.55 + rnd() * 0.2), SIZE, SIZE * 0.12)
}

function blocks(ctx, rnd, p) {
  fill(ctx, p[0])
  const n = 4
  const c = SIZE / n
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const x = col * c
      const y = row * c
      ctx.fillStyle = p[1 + Math.floor(rnd() * 3)]
      const shape = Math.floor(rnd() * 5)
      ctx.beginPath()
      if (shape === 0) ctx.rect(x, y, c, c)
      else if (shape === 1) ctx.arc(x + c / 2, y + c / 2, c / 2, 0, TAU)
      else if (shape === 2) {
        const corner = Math.floor(rnd() * 4)
        const ox = corner % 2 ? x + c : x
        const oy = corner > 1 ? y + c : y
        ctx.moveTo(ox, oy)
        ctx.arc(ox, oy, c, (corner * Math.PI) / 2, ((corner + 1) * Math.PI) / 2)
      } else if (shape === 3) ctx.arc(x + c / 2, y + c, c / 2, Math.PI, TAU)
      ctx.fill()
    }
  }
}

function halftone(ctx, rnd, p) {
  fill(ctx, p[0])
  const n = 20
  const step = SIZE / n
  const fx = rnd() * SIZE
  const fy = rnd() * SIZE
  ctx.fillStyle = p[1]
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const d = Math.hypot(col * step + step / 2 - fx, row * step + step / 2 - fy) / SIZE
      const r = step * 0.52 * Math.max(0.06, 1 - d * 1.35)
      ctx.beginPath()
      ctx.arc(col * step + step / 2, row * step + step / 2, r, 0, TAU)
      ctx.fill()
    }
  }
  ctx.fillStyle = p[2]
  ctx.fillRect(0, SIZE * (0.78 + rnd() * 0.08), SIZE, SIZE * 0.05)
}

function sun(ctx, rnd, p) {
  const gradient = ctx.createLinearGradient(0, 0, 0, SIZE)
  gradient.addColorStop(0, p[0])
  gradient.addColorStop(1, p[3])
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = p[1]
  ctx.beginPath()
  ctx.arc(SIZE * 0.5, SIZE * (0.4 + rnd() * 0.08), SIZE * 0.26, 0, TAU)
  ctx.fill()
  ctx.fillStyle = p[2]
  for (let i = 0; i < 7; i++) ctx.fillRect(0, SIZE * 0.62 + i * SIZE * 0.05, SIZE, SIZE * (0.006 + i * 0.004))
  ctx.fillStyle = p[0]
  ctx.fillRect(0, SIZE * 0.93, SIZE, SIZE * 0.07)
}

// Scan of a paper record label
function disc(ctx, rnd, p) {
  fill(ctx, p[2])
  ctx.fillStyle = p[3]
  ctx.beginPath()
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.4, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = p[1]
  ctx.lineWidth = SIZE * 0.012
  ctx.beginPath()
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.36, 0, TAU)
  ctx.stroke()
  ctx.fillStyle = p[2]
  ctx.textAlign = 'center'
  ctx.font = `500 ${SIZE * 0.042}px "IBM Plex Mono"`
  ctx.fillText('MOCK RECORDS', SIZE / 2, SIZE * 0.4)
  ctx.font = `400 ${SIZE * 0.1}px "Instrument Serif"`
  ctx.fillText('Side B', SIZE / 2, SIZE * 0.62)
  ctx.fillStyle = p[2]
  ctx.beginPath()
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.018, 0, TAU)
  ctx.fill()
  ctx.textAlign = 'start'
}

// Typographic card for records with no cover on file
function typeCard(ctx, rnd, p, spec) {
  fill(ctx, p[0])
  ctx.fillStyle = p[1]
  ctx.font = `400 ${SIZE * 0.82}px "Instrument Serif"`
  const initial = [...(spec.text ?? '?')][0]?.toUpperCase() ?? '?'
  ctx.fillText(initial, SIZE * 0.06, SIZE * 0.86)
  ctx.strokeStyle = p[2]
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 2
  ctx.strokeRect(SIZE * 0.05, SIZE * 0.05, SIZE * 0.9, SIZE * 0.9)
  ctx.globalAlpha = 1
  ctx.fillStyle = p[2]
  ctx.font = `500 ${SIZE * 0.028}px "IBM Plex Mono"`
  ctx.fillText('NO COVER ON RECORD', SIZE * 0.08, SIZE * 0.93)
}

const STYLES = { rings, stripes, blocks, halftone, sun, disc, type: typeCard }

function grain(ctx, rnd) {
  for (let i = 0; i < 7000; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'
    ctx.fillRect(rnd() * SIZE, rnd() * SIZE, 1.5, 1.5)
  }
}

function renderCover(spec, seed) {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const rnd = seeded(`art:${seed}`)
  STYLES[spec.style](ctx, rnd, PALETTES[spec.palette], spec)
  grain(ctx, rnd)
  return canvas
}

const cache = new Map()

// Accepts a full record or a library snapshot; both carry id, title and artwork
export function resolveArtwork(record) {
  if (!cache.has(record.id)) cache.set(record.id, build(record))
  return cache.get(record.id)
}

// Square centre-crop; null when the cover is missing or the host refuses pixel access
async function loadRemoteCover(url) {
  try {
    const image = new Image()
    // Without CORS the canvas would be tainted and the palette unreadable
    image.crossOrigin = 'anonymous'
    image.src = url
    await image.decode()
    if (image.naturalWidth < 32 || image.naturalHeight < 32) return null
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = SIZE
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    canvas
      .getContext('2d')
      .drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, SIZE, SIZE)
    return canvas
  } catch {
    return null
  }
}

async function build(record) {
  if (record.artwork?.url) {
    const canvas = await loadRemoteCover(record.artwork.url)
    if (canvas) return finish(record, canvas, 'source')
  }
  await Promise.all([
    document.fonts.load('400 40px "Instrument Serif"'),
    document.fonts.load('500 20px "IBM Plex Mono"'),
  ])
  const title = displayTitle(record)
  const stated = record.artwork?.spec
  const spec = stated ?? {
    style: 'type',
    palette: pick(seeded(`pal:${record.id}`), PLACEHOLDER_PALETTES),
    text: title,
  }
  const origin = stated ? (record.artwork.origin ?? 'source') : 'generated'
  return finish(record, renderCover(spec, record.id), origin)
}

async function finish(record, canvas, origin) {
  const title = displayTitle(record)
  const palette = extractPalette(canvas.getContext('2d').getImageData(0, 0, SIZE, SIZE))
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  return {
    url: URL.createObjectURL(blob),
    palette,
    origin,
    alt: origin === 'generated' ? `Generated artwork for ${title}` : `Artwork for ${title}`,
  }
}
