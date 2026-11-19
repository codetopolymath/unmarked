import { test } from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { docsUrl } from '../../src/js/core/links.js'

const SRC = fileURLToPath(new URL('../../src/', import.meta.url))
const read = (file) => readFile(join(SRC, file), 'utf8')
const exists = (file) =>
  access(join(SRC, file)).then(
    () => true,
    () => false,
  )
const at = (href) => new URL(href)

test('over https the docs sit beside the app, wherever the app is hosted', () => {
  assert.equal(
    docsUrl(at('https://codetopolymath.github.io/unmarked/')),
    'https://codetopolymath.github.io/unmarked/docs/',
  )
  assert.equal(
    docsUrl(at('https://codetopolymath.github.io/unmarked/index.html?source=mock')),
    'https://codetopolymath.github.io/unmarked/docs/',
  )
  assert.equal(docsUrl(at('https://example.org/music/')), 'https://example.org/music/docs/')
})

test('local and file previews use the published docs, because they have no /docs/', () => {
  const published = 'https://codetopolymath.github.io/unmarked/docs/'
  assert.equal(docsUrl(at('http://127.0.0.1:4173/')), published)
  assert.equal(docsUrl(at('file:///tmp/unmarked/index.html')), published)
})

test('the manifest makes a standalone app with real icons and the design-token colours', async () => {
  const manifest = JSON.parse(await read('manifest.webmanifest'))
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, './')
  assert.equal(manifest.scope, './')
  assert.equal(manifest.background_color, '#121110')
  assert.equal(manifest.theme_color, '#121110')
  const sizes = manifest.icons.map((icon) => icon.sizes)
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'))
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'))
  for (const icon of manifest.icons) assert.ok(await exists(icon.src.replace('./', '')), `${icon.src} exists`)
})

test('index.html links the manifest and carries the iOS home-screen tags, and every file they name exists', async () => {
  const html = await read('index.html')
  for (const needle of [
    'rel="manifest" href="./manifest.webmanifest"',
    'name="apple-mobile-web-app-capable" content="yes"',
    'name="apple-mobile-web-app-title" content="Unmarked"',
    'name="apple-mobile-web-app-status-bar-style"',
  ])
    assert.ok(html.includes(needle), needle)
  const touch = html.match(/rel="apple-touch-icon" href="\.\/([^"]+)"/)
  assert.ok(touch && (await exists(touch[1])), 'apple-touch-icon file exists')
  const favicon = html.match(/rel="icon"[^>]*href="\.\/([^"]+)"/)
  assert.ok(favicon && (await exists(favicon[1])), 'favicon file exists')
})

test('the iOS icon is an opaque 180 px PNG (iOS rounds the corners itself)', async () => {
  const png = await readFile(join(SRC, 'assets/icons/icon-180.png'))
  assert.equal(png.subarray(1, 4).toString(), 'PNG')
  assert.equal(png.readUInt32BE(16), 180)
  assert.equal(png.readUInt32BE(20), 180)
  // Colour type 2 is RGB; 6 would carry an alpha channel that iOS paints black
  assert.equal(png[25], 2)
})
