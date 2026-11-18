// The deployed shape: build dist/ (versioned URLs + import map), serve it, and check a real browser honours it.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { build } from '../../tools/stamp.mjs'
import { startServer } from '../../tools/serve.mjs'
import { createReporter, openPage } from './harness.mjs'

const SRC = fileURLToPath(new URL('../../src', import.meta.url))

export async function run(browser) {
  const { check, summary } = createReporter('built')
  const work = await mkdtemp(join(tmpdir(), 'unmarked-built-'))
  const { modules } = await build({ src: SRC, out: join(work, 'dist') })
  const { server, host, port } = await startServer({ port: 0, root: join(work, 'dist') })

  try {
    const page = await openPage(browser, `http://${host}:${port}/index.html?source=mock&debug=1&latency=0`)
    await sleep(2500)

    check(
      'the built page starts and draws a record',
      (await page.json(`__unmarked.store.get().draw.status`)) === 'ready',
    )
    check('no load or runtime errors', !(await page.eval('document.documentElement.dataset.errors || ""')))
    check(
      'the import map is present and ahead of every module script',
      await page.eval(`(() => {
      const map = document.querySelector('script[type="importmap"]')
      const entry = document.querySelector('script[type="module"]')
      return Boolean(map) && Boolean(entry) && Boolean(map.compareDocumentPosition(entry) & Node.DOCUMENT_POSITION_FOLLOWING)
    })()`),
    )

    // Chrome records each request; every script must have been asked for by its versioned URL
    const scripts = await page.json(
      `performance.getEntriesByType('resource').filter((e) => /\\.js(\\?|$)/.test(e.name)).map((e) => e.name.split('/js/')[1])`,
    )
    check(
      `every one of the ${scripts.length} scripts was requested with a version`,
      // Mock mode skips the lazily imported live sources, so not all 47 modules load here
      scripts.length > 25 && scripts.every((name) => /\?v=[0-9a-f]{10}$/.test(name)),
      JSON.stringify(scripts.filter((name) => !/\?v=/.test(name))),
    )
    check(
      'the entry and a deep module both carry versions',
      scripts.some((n) => n.startsWith('main.js?v=')) && scripts.some((n) => n.startsWith('ui/stage.js?v=')),
    )

    // Preloaded modules must be reused by the imports; a mismatch would download every file twice
    check('no script was downloaded twice', new Set(scripts).size === scripts.length, String(scripts.length))
    const preloads = await page.json(`document.querySelectorAll('link[rel="modulepreload"]').length`)
    check(
      'every module is preloaded, including the lazily imported ones',
      preloads === modules + 1 && scripts.length >= preloads,
      `${preloads} preloads, ${modules} modules`,
    )
    const mapRequests = await page.json(
      `performance.getEntriesByType('resource').filter((e) => e.name.includes('ia-map.json')).length`,
    )
    check(
      'the map is preloaded',
      (await page.eval(`Boolean(document.querySelector('link[rel="preload"][as="fetch"]'))`)) && mapRequests === 1,
      String(mapRequests),
    )
    check(
      'the three hosts are preconnected',
      (await page.json(`document.querySelectorAll('link[rel="preconnect"]').length`)) === 3,
    )

    const styles = await page.json(`[...document.styleSheets].map((s) => s.href.split('/css/')[1])`)
    check(
      'every stylesheet is versioned',
      styles.length === 5 && styles.every((name) => /\?v=[0-9a-f]{10}$/.test(name)),
      JSON.stringify(styles),
    )

    // A lazy import() goes through the same map: this is how live mode loads its sources
    await page.eval(
      `window.__lazy = null; import('./js/data/live-source.js').then(() => { window.__lazy = 'ok' }, (e) => { window.__lazy = String(e) })`,
    )
    await sleep(1500)
    check('a dynamic import() resolves through the import map', (await page.json('window.__lazy')) === 'ok')
    const lazy = await page.json(
      `performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/data/live-source.js'))`,
    )
    check(
      '...and was fetched by its versioned URL',
      lazy.length === 1 && /live-source\.js\?v=[0-9a-f]{10}$/.test(lazy[0]),
      JSON.stringify(lazy),
    )
    check(
      'the map version is stamped for main.js',
      /^[0-9a-f]{10}$/.test(await page.eval(`document.querySelector('meta[name="ia-map-version"]').content`)),
    )
    check('the build covers every module (>= 40)', modules >= 40, String(modules))

    await page.close()
  } finally {
    server.close()
    await rm(work, { recursive: true, force: true })
  }
  return summary()
}
