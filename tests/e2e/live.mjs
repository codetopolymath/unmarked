// Live smoke test against the real Internet Archive. Local only: it needs the network and a built map.
// Usage: npm run test:live            (serves src/ locally)
//        LIVE_URL=https://codetopolymath.github.io/unmarked/ npm run test:live
import { setTimeout as sleep } from 'node:timers/promises'
import { startServer } from '../../tools/serve.mjs'
import { createReporter, launch, openPage } from './harness.mjs'

const DRAWS = 3
const { check, summary } = createReporter('live archive')

async function until(page, expression, timeoutMs, stepMs = 400) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await page.json(expression)) return true
    await sleep(stepMs)
  }
  return false
}

const local = process.env.LIVE_URL ? null : await startServer({ port: 0 })
const base = process.env.LIVE_URL ?? `http://${local.host}:${local.port}/`
const browser = await launch()

try {
  const page = await openPage(browser, `${base}${base.includes('?') ? '&' : '?'}source=ia&debug=1`)
  await sleep(1500)
  check(
    'live mode is announced in the header',
    (await page.eval(`document.querySelector('.badge').textContent`)).includes('Beta'),
  )
  check('prototype controls are not offered', await page.eval(`!document.querySelector('#proto-panel')`))

  const ids = []
  for (let n = 1; n <= DRAWS; n++) {
    await page.key('d')
    const drawn = await until(
      page,
      `__unmarked.store.get().draw.status === 'ready' && __unmarked.store.get().viewed?.id !== ${JSON.stringify(ids.at(-1) ?? null)}`,
      90000,
    )
    const record = await page.json(
      `(() => { const v = __unmarked.store.get().viewed; return v && { id: v.id, title: v.title, kind: v.kind, tracks: v.tracks.length, url: v.tracks[0].audio.url, rights: v.rights.state, source: v.source.url, art: v.art?.origin } })()`,
    )
    check(`draw ${n}: a record arrives`, drawn && Boolean(record), JSON.stringify(record))
    if (!record) continue
    ids.push(record.id)
    check(
      `draw ${n}: it is an Internet Archive item with playable https audio`,
      record.id.startsWith('ia:') && record.url.startsWith('https://archive.org/download/'),
      record.url,
    )
    check(
      `draw ${n}: source link points at the item page`,
      record.source === `https://archive.org/details/${record.id.slice(3)}`,
      record.source,
    )
    check(
      `draw ${n}: rights are mapped to a known state`,
      ['licensed', 'public_domain', 'unknown', 'all_rights_reserved', 'restricted'].includes(record.rights),
      record.rights,
    )
    check(`draw ${n}: artwork resolved (${record.art})`, ['source', 'generated'].includes(record.art))
    const played = await until(
      page,
      `__unmarked.store.get().player.status === 'playing' && __unmarked.clock.get().position > 0.5`,
      30000,
    )
    check(
      `draw ${n}: audio actually plays`,
      played,
      JSON.stringify(await page.json('__unmarked.store.get().player')).slice(0, 200),
    )
    console.log(
      `      ${record.id} · "${record.title}" · ${record.tracks} track(s) · ${record.rights} · art:${record.art}`,
    )
    if (n === 1 && process.env.SHOT) await page.shot(process.env.SHOT)
  }
  check('draws are all different', new Set(ids).size === ids.length, ids.join(' '))
  check('every draw was logged to history', (await page.json('__unmarked.store.get().history.length')) >= ids.length)

  const first = ids[0]
  if (first) {
    await page.eval(`__unmarked.actions.openRecord(${JSON.stringify(first)})`)
    const reopened = await until(page, `__unmarked.store.get().viewed?.id === ${JSON.stringify(first)}`, 30000)
    check('a past record can be reopened by re-fetching it', reopened)
  }

  check(
    'no load or runtime errors',
    !(await page.eval('document.documentElement.dataset.errors || ""')),
    await page.eval('document.documentElement.dataset.errors || ""'),
  )
  await page.close()
} finally {
  await browser.close()
  local?.server.close()
}

const { failures } = summary()
process.exit(failures.length ? 1 : 0)
