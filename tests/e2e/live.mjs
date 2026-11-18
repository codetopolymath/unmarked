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

  const opening = await until(page, `__unmarked.store.get().draw.status === 'ready'`, 90000)
  check('a record is drawn on load, with no key press', opening)
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
    // Draws are mixed: about one in five comes from Commons
    const fromCommons = record.id.startsWith('commons:')
    check(
      `draw ${n}: it is an archive or Commons record with playable https audio`,
      fromCommons
        ? record.url.startsWith('https://upload.wikimedia.org/')
        : record.id.startsWith('ia:') && record.url.startsWith('https://archive.org/download/'),
      record.url,
    )
    check(
      `draw ${n}: source link points at the item page`,
      fromCommons
        ? record.source.startsWith('https://commons.wikimedia.org/wiki/File:')
        : record.source === `https://archive.org/details/${record.id.slice(3)}`,
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

  // Random draws rarely land on Commons (about one in five), so draw from it directly
  await page.eval(
    `window.__commons = null; window.__commonsError = ''; __unmarked.source.parts.commons.draw().then((r) => { window.__commons = r }, (e) => { window.__commonsError = String(e) })`,
  )
  const gotCommons = await until(page, `window.__commons || window.__commonsError`, 90000)
  const commons = await page.json(
    `window.__commons && { id: window.__commons.id, title: window.__commons.title, url: window.__commons.tracks[0].audio.url, rights: window.__commons.rights, source: window.__commons.source, seconds: window.__commons.tracks[0].duration_s }`,
  )
  check('Commons: a record arrives', gotCommons && Boolean(commons), await page.eval('window.__commonsError'))
  if (commons) {
    check(
      'Commons: playable file on upload.wikimedia.org',
      commons.url.startsWith('https://upload.wikimedia.org/'),
      commons.url,
    )
    check('Commons: it has a stated licence or says so', Boolean(commons.rights.short), JSON.stringify(commons.rights))
    check(
      'Commons: source link points at the file page',
      commons.source.url.startsWith('https://commons.wikimedia.org/wiki/File:'),
      commons.source.url,
    )
    check('Commons: clips under 30 s are filtered out', commons.seconds >= 30, String(commons.seconds))
    await page.eval(`__unmarked.actions.openRecord(${JSON.stringify(commons.id)})`)
    const shown = await until(page, `__unmarked.store.get().viewed?.id === ${JSON.stringify(commons.id)}`, 30000)
    check('Commons: the record opens on the stage', shown)
    await page.eval(`__unmarked.actions.playTrack(__unmarked.store.get().viewed, 0)`)
    const plays = await until(
      page,
      `__unmarked.store.get().player.status === 'playing' && __unmarked.clock.get().position > 0.5`,
      40000,
    )
    check(
      'Commons: audio actually plays',
      plays,
      JSON.stringify(await page.json('__unmarked.store.get().player')).slice(0, 200),
    )
    console.log(`      ${commons.id} · "${commons.title}" · ${commons.seconds}s · ${commons.rights.short}`)

    // The Commons CDN once served the same five files to everyone; picks must really vary
    await page.eval(
      `window.__more = null; Promise.all([1, 2].map(() => __unmarked.source.parts.commons.draw())).then((rs) => { window.__more = rs.map((r) => r.id) }, (e) => { window.__more = ['error ' + e] })`,
    )
    await until(page, `window.__more`, 90000)
    const more = await page.json(`window.__more`)
    check(
      'Commons: further draws are different records',
      new Set([commons.id, ...more]).size === 3 && !more.some((id) => id.startsWith('error')),
      JSON.stringify(more),
    )
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
