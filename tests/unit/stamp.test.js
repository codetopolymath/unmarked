import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from '../../tools/stamp.mjs'

const REAL_SRC = fileURLToPath(new URL('../../src', import.meta.url))

const INDEX = `<!doctype html>
<html><head>
<meta name="ia-map-version" content="dev" />
<link rel="stylesheet" href="./css/a.css" />
<link rel="stylesheet" href="./css/b.css" />
</head><body><script type="module" src="./js/main.js"></script></body></html>`

async function fixture(files) {
  const root = await mkdtemp(join(tmpdir(), 'unmarked-stamp-'))
  for (const [name, content] of Object.entries(files)) {
    await mkdir(join(root, 'src', name, '..'), { recursive: true })
    await writeFile(join(root, 'src', name), content)
  }
  return { root, src: join(root, 'src'), out: join(root, 'dist') }
}

const BASE = {
  'index.html': INDEX,
  'css/a.css': 'a{}',
  'css/b.css': 'b{}',
  'js/main.js': "import './core/x.js'",
  'js/core/x.js': 'export const x = 1',
  'js/core/y.js': 'export const y = 1',
  'data/ia-map.json': '{"windows":[]}',
}

async function stamped(files) {
  const f = await fixture(files)
  const result = await build(f)
  const html = await readFile(join(f.out, 'index.html'), 'utf8')
  const map = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/)[1]).imports
  return { f, result, html, map }
}

test('every module is mapped to a content-hashed URL, and the entry, styles and map version are stamped', async () => {
  const { f, result, html, map } = await stamped(BASE)
  try {
    assert.deepEqual(Object.keys(map).sort(), ['./js/core/x.js', './js/core/y.js'])
    for (const [key, value] of Object.entries(map))
      assert.match(value, new RegExp(`^${key.replace('.', '\\.')}\\?v=[0-9a-f]{10}$`))
    assert.match(html, /src="\.\/js\/main\.js\?v=[0-9a-f]{10}"/)
    assert.match(html, /href="\.\/css\/a\.css\?v=[0-9a-f]{10}"/)
    assert.match(html, /href="\.\/css\/b\.css\?v=[0-9a-f]{10}"/)
    assert.match(html, /content="[0-9a-f]{10}"/)
    assert.ok(!html.includes('content="dev"'))
    assert.ok(html.indexOf('importmap') < html.indexOf('type="module"'), 'the import map must come first')
    assert.equal(result.modules, 2)
  } finally {
    await rm(f.root, { recursive: true, force: true })
  }
})

test('every module and the map are preloaded by the same versioned URLs the import map uses', async () => {
  const { f, html, map } = await stamped(BASE)
  try {
    const preloaded = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1])
    // The entry plus every mapped module, each exactly once, entry first
    assert.deepEqual(preloaded, [preloaded[0], ...Object.values(map)])
    assert.match(preloaded[0], /^\.\/js\/main\.js\?v=[0-9a-f]{10}$/)
    assert.match(html, /<link rel="preload" href="\.\/data\/ia-map\.json\?v=[0-9a-f]{10}" as="fetch" crossorigin \/>/)
    assert.ok(
      html.indexOf('type="importmap"') < html.indexOf('rel="modulepreload"'),
      'preloads resolve through the map',
    )
  } finally {
    await rm(f.root, { recursive: true, force: true })
  }
})

test('a URL changes only when its own content does', async () => {
  const first = await stamped(BASE)
  const second = await stamped({ ...BASE, 'js/core/x.js': 'export const x = 2' })
  try {
    assert.notEqual(first.map['./js/core/x.js'], second.map['./js/core/x.js'], 'changed file gets a new URL')
    assert.equal(first.map['./js/core/y.js'], second.map['./js/core/y.js'], 'untouched file keeps its cached URL')
    const again = await stamped(BASE)
    assert.deepEqual(again.map, first.map, 'rebuilding the same source is stable')
    assert.equal(again.result.mapVersion, first.result.mapVersion)
  } finally {
    await Promise.all([first, second].map(({ f }) => rm(f.root, { recursive: true, force: true })))
  }
})

test('a new Archive map changes the map version only', async () => {
  const first = await stamped(BASE)
  const second = await stamped({ ...BASE, 'data/ia-map.json': '{"windows":[1]}' })
  try {
    assert.notEqual(first.result.mapVersion, second.result.mapVersion)
    assert.deepEqual(first.map, second.map)
  } finally {
    await Promise.all([first, second].map(({ f }) => rm(f.root, { recursive: true, force: true })))
  }
})

test('the source is copied untouched, and rebuilding replaces the old output', async () => {
  const { f } = await stamped(BASE)
  try {
    assert.equal(await readFile(join(f.out, 'js/core/x.js'), 'utf8'), 'export const x = 1')
    assert.equal(await readFile(join(f.src, 'index.html'), 'utf8'), INDEX, 'src/index.html is never modified')
    await writeFile(join(f.out, 'stale.txt'), 'left over')
    await build(f)
    assert.ok(!(await readdir(f.out)).includes('stale.txt'))
  } finally {
    await rm(f.root, { recursive: true, force: true })
  }
})

test('a reshaped index.html fails the build instead of shipping unversioned', async () => {
  for (const [label, html] of [
    ['no map-version meta', INDEX.replace('<meta name="ia-map-version" content="dev" />', '')],
    ['no entry script', INDEX.replace('src="./js/main.js"', 'src="./js/app.js"')],
    ['unlisted stylesheet', INDEX.replace('href="./css/b.css"', 'href="./css/c.css"')],
  ]) {
    const f = await fixture({ ...BASE, 'index.html': html })
    try {
      await assert.rejects(build(f), /stamp: could not find/, label)
    } finally {
      await rm(f.root, { recursive: true, force: true })
    }
  }
})

test('the real source builds, and every module in it is covered by the import map', async () => {
  const root = await mkdtemp(join(tmpdir(), 'unmarked-real-'))
  try {
    const result = await build({ src: REAL_SRC, out: join(root, 'dist') })
    const html = await readFile(join(root, 'dist/index.html'), 'utf8')
    const map = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/)[1]).imports
    const walk = async (dir) =>
      (await readdir(dir, { withFileTypes: true })).flatMap((e) => (e.isDirectory() ? [] : [e.name]))
    const jsFiles = [...(await walk(join(REAL_SRC, 'js'))), ...(await walk(join(REAL_SRC, 'js/core')))]
    assert.ok(jsFiles.length > 5 && result.modules > 40)
    assert.ok(map['./js/core/dom.js'] && map['./js/data/live-source.js'] && map['./js/data/commons/client.js'])
    assert.ok(!map['./js/main.js'], 'the entry is stamped in the script tag instead')
    assert.ok(!html.includes('content="dev"'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
