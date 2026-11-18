import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contrast, deriveTheme, extractPalette, luminance, mix } from '../../src/js/services/palette.js'

const INK_3 = [163, 155, 142]

// Builds ImageData-shaped input from a function of (x, y)
function image(width, height, colourAt) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = colourAt(x, y)
      data.set([r, g, b, 255], (y * width + x) * 4)
    }
  }
  return { data, width, height }
}

test('contrast matches the WCAG reference values', () => {
  assert.equal(Math.round(contrast([255, 255, 255], [0, 0, 0])), 21)
  assert.equal(contrast([10, 20, 30], [10, 20, 30]), 1)
  assert.ok(luminance([255, 255, 255]) > luminance([128, 128, 128]))
})

test('mix interpolates channel by channel', () => {
  assert.deepEqual(mix([0, 0, 0], [100, 200, 50], 0.5), [50, 100, 25])
})

test('extractPalette picks the dominant vivid colour and ignores near-black and paper', () => {
  const picture = image(64, 64, (x, y) => {
    if (x < 8) return [250, 250, 250]
    if (y < 8) return [5, 5, 5]
    return x < 52 ? [210, 40, 30] : [30, 60, 200]
  })
  const { tint } = extractPalette(picture)
  assert.ok(tint[0] > 180 && tint[1] < 90 && tint[2] < 90, `expected a red tint, got ${tint}`)
})

test('extractPalette offers a second, distinct hue when there is one', () => {
  const picture = image(64, 64, (x) => (x < 40 ? [210, 40, 30] : [30, 60, 200]))
  const { tint, tint2 } = extractPalette(picture)
  assert.notDeepEqual(tint, tint2)
})

test('extractPalette falls back to a neutral when nothing usable is found', () => {
  const { tint } = extractPalette(image(16, 16, () => [0, 0, 0]))
  assert.deepEqual(tint, [120, 108, 96])
})

test('the wash always keeps tertiary text legible, even on bright covers', () => {
  const covers = { white: [255, 255, 255], yellow: [232, 211, 74], red: [208, 48, 42], teal: [47, 143, 138] }
  for (const [name, colour] of Object.entries(covers)) {
    const theme = deriveTheme({ tint: colour, tint2: colour })
    assert.ok(theme.strength <= 0.16 && theme.strength >= 0.02, `${name}: strength ${theme.strength}`)
    assert.ok(contrast(INK_3, theme.wash) >= 4.5, `${name}: contrast ${contrast(INK_3, theme.wash).toFixed(2)}`)
  }
})

test('bright covers get a weaker wash than dark ones', () => {
  const bright = deriveTheme({ tint: [255, 255, 255], tint2: [255, 255, 255] })
  const dark = deriveTheme({ tint: [120, 30, 30], tint2: [120, 30, 30] })
  assert.ok(bright.strength <= dark.strength)
})
