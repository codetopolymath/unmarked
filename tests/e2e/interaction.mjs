// Behavioural contract of the app, exercised in a real browser.
import { setTimeout as sleep } from 'node:timers/promises'
import { SOURCES } from '../../src/js/data/sources-catalog.js'
import { createReporter, openPage } from './harness.mjs'

const SETTLED = `new Promise((resolve) => {
  const timer = setInterval(() => { if (__unmarked.store.get().draw.status !== 'drawing') { clearInterval(timer); resolve() } }, 10)
})`

export async function run(browser, baseUrl) {
  const { check, summary } = createReporter('interaction')
  const base = `${baseUrl}/index.html?source=mock&debug=1&latency=0`
  const page = await openPage(browser, `${base}&record=mock:001`)

  const state = () =>
    page.json(`(() => {
      const s = __unmarked.store.get()
      return { view: s.view, draw: s.draw.status, viewed: s.viewed?.id, origin: s.viewed?.origin, status: s.player.status,
        trackIndex: s.player.trackIndex, playing: s.player.record?.id, expanded: s.player.expanded, details: s.ui.detailsOpen,
        kept: s.kept.length, history: s.history.length, stack: s.stack.length }
    })()`)
  const reset = async (query = 'record=mock:001') => {
    await page.eval('localStorage.clear()')
    await page.send('Page.navigate', { url: `${base}&${query}` })
    await sleep(1800)
  }

  await reset()
  let s = await state()
  check(
    'initial draw completes and shows the forced record',
    s.draw === 'ready' && s.viewed === 'mock:001',
    JSON.stringify(s),
  )
  check('document title follows the record', (await page.eval('document.title')).startsWith('Salt Meridian'))
  check(
    'exactly one visible h1',
    (await page.eval(`[...document.querySelectorAll('h1')].filter((h) => h.offsetParent !== null).length`)) === 1,
  )
  check(
    'fonts loaded',
    await page.eval(`document.fonts.check('16px "Instrument Serif"') && document.fonts.check('12px "IBM Plex Mono"')`),
  )
  check('no runtime errors recorded', !(await page.eval('document.documentElement.dataset.errors || ""')))

  // Discovery and theme
  const washBefore = await page.eval(`getComputedStyle(document.documentElement).getPropertyValue('--wash').trim()`)
  await page.eval('__unmarked.source.settings.nextId = "mock:008"')
  await page.key('d')
  await sleep(1500)
  s = await state()
  const washAfter = await page.eval(`getComputedStyle(document.documentElement).getPropertyValue('--wash').trim()`)
  check('D draws the forced record', s.draw === 'ready' && s.viewed === 'mock:008', JSON.stringify(s))
  check('page wash colour changes with the artwork', washBefore !== washAfter, `${washBefore} vs ${washAfter}`)
  check('history logged the draw', s.history === 2, `history=${s.history}`)
  check(
    'autoplay started the new record',
    s.playing === 'mock:008' && ['playing', 'loading'].includes(s.status),
    `${s.playing} ${s.status}`,
  )

  await page.key('b')
  await sleep(300)
  check('B returns to the previous discovery', (await state()).viewed === 'mock:001')

  // Keep
  await page.key('k')
  await sleep(200)
  check('K keeps the record', (await state()).kept === 1)
  check(
    'kept record persisted to localStorage',
    (await page.eval(`JSON.parse(localStorage.getItem('unmarked.v1.kept') || '[]').length`)) === 1,
  )
  await page.key('k')
  await sleep(100)
  check('K again releases it', (await state()).kept === 0)

  // Playback controls
  await page.click('.actions__play')
  await sleep(900)
  s = await state()
  check('Play button plays this record', s.playing === 'mock:001' && s.status === 'playing', `${s.playing} ${s.status}`)
  await page.key(' ')
  await sleep(300)
  check('Space pauses', (await state()).status === 'paused')
  await page.key(' ')
  await sleep(500)
  check('Space resumes', (await state()).status === 'playing')
  await page.key('ArrowRight')
  await sleep(700)
  check('Right arrow goes to the next track', (await state()).trackIndex === 1)
  await page.key('ArrowLeft')
  await sleep(700)
  check('Left arrow within 3 s goes to the previous track', (await state()).trackIndex === 0)

  // Seeking by keyboard
  const before = await page.json('__unmarked.clock.get().position')
  await page.eval(
    `(() => { const el = document.querySelector('.dock__progress .scrubber'); el.focus(); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })) })()`,
  )
  await sleep(300)
  const after = await page.json('__unmarked.clock.get().position')
  check(
    'scrubber keyboard seek moves ~5 s forward',
    after - before > 4 && after - before < 8,
    `${before.toFixed(1)} -> ${after.toFixed(1)}`,
  )
  check(
    'scrubber exposes slider semantics',
    await page.eval(
      `(() => { const el = document.querySelector('.dock__progress .scrubber'); return el.getAttribute('role') === 'slider' && /of/.test(el.getAttribute('aria-valuetext')) })()`,
    ),
  )

  // A track that cannot play is skipped
  await page.eval(
    '__unmarked.source.settings.nextId = "mock:009"; void __unmarked.actions.discover({ autoplay: false })',
  )
  await sleep(600)
  await page.eval('__unmarked.actions.playTrack(__unmarked.store.get().viewed, 2)')
  await sleep(300)
  check('failing track enters the error state', (await state()).status === 'error')
  await sleep(2600)
  s = await state()
  check('failing track is skipped to the next', s.trackIndex === 3 && s.status !== 'error', JSON.stringify(s))
  check(
    'a toast announced the skip',
    (await page.eval(`document.querySelector('.toasts')?.textContent || ''`)).includes('Skipping'),
  )

  // Unavailable records are never shown
  const shown = new Set()
  for (let i = 0; i < 40; i++) {
    await page.eval('void __unmarked.actions.discover({ autoplay: false })')
    await sleep(60)
    await page.eval(SETTLED)
    shown.add((await state()).viewed)
  }
  check('40 draws never show the unavailable record', !shown.has('mock:010'), [...shown].join(','))
  check('draws are varied (at least 8 distinct records)', shown.size >= 8, `${shown.size} distinct`)

  // End of a record: pause by default, continue only when the preference is on
  await page.eval(
    '__unmarked.source.settings.nextId = "mock:003"; void __unmarked.actions.discover({ autoplay: false })',
  )
  await sleep(500)
  check(
    'continue-after-last-track defaults to off',
    (await page.json('__unmarked.store.get().prefs.autocontinue')) === false,
  )
  const endedId = (await state()).viewed
  await page.eval('__unmarked.actions.playTrack(__unmarked.store.get().viewed, 4)')
  await sleep(700)
  await page.eval('__unmarked.actions.proto.seekToEnd(2)')
  await sleep(3500)
  s = await state()
  check(
    'last track ends: playback pauses and the same record stays',
    s.status === 'paused' && s.viewed === endedId,
    JSON.stringify(s),
  )
  check(
    'a toast says the record has finished',
    (await page.eval(`document.querySelector('.toasts')?.textContent || ''`)).includes('finished'),
  )
  await page.eval('__unmarked.actions.setPref("autocontinue", true)')
  await page.eval('__unmarked.actions.playTrack(__unmarked.store.get().viewed, 4)')
  await sleep(700)
  await page.eval('__unmarked.actions.proto.seekToEnd(2)')
  await sleep(4500)
  s = await state()
  check(
    'with the preference on, the end draws a new record',
    s.viewed !== endedId && s.playing === s.viewed,
    JSON.stringify(s),
  )
  await page.eval('__unmarked.actions.setPref("autocontinue", false)')

  // Overlays and focus
  await page.eval('document.querySelector(".actions__details").focus()')
  await page.key('i')
  await sleep(700)
  check('I opens details', (await state()).details === true)
  check('focus moves into the dialog', await page.eval(`document.activeElement.closest('.sheet') !== null`))
  check(
    'background is inert while the dialog is open',
    await page.eval(`document.querySelector('.main').hasAttribute('inert')`),
  )
  await page.key('Escape')
  await sleep(800)
  check('Escape closes details', (await state()).details === false)
  check(
    'focus returns to the trigger',
    await page.eval(`document.activeElement.classList.contains('actions__details')`),
  )
  check('background no longer inert', await page.eval(`!document.querySelector('.main').hasAttribute('inert')`))

  await page.key('e')
  await sleep(700)
  check('E expands the player', (await state()).expanded === true)
  check(
    'expanded player is visible and the dock is hidden',
    await page.eval(`!document.querySelector('.np').hidden && document.querySelector('.dock').hidden`),
  )
  await page.key('Escape')
  await sleep(600)
  check('Escape collapses the player', (await state()).expanded === false)

  // Library
  await page.eval('__unmarked.actions.proto.seedDemoLibrary()')
  await page.key('l')
  await sleep(500)
  check('L opens the library', (await state()).view === 'library')
  check('library shows kept tiles', (await page.eval(`document.querySelectorAll('.library__grid .tile').length`)) === 7)
  await page.eval(`document.querySelector('.library__grid .tile').click()`)
  await sleep(1000)
  s = await state()
  check(
    'opening a kept tile reopens that record on the stage',
    s.view === 'discover' && s.origin === 'library',
    JSON.stringify(s),
  )
  check(
    'reopened record shows the library eyebrow',
    (await page.eval(`document.querySelector('.stage .eyebrow').textContent`)).startsWith('Reopened'),
  )

  // Sources status board
  await page.key('s')
  await sleep(500)
  check('S opens the sources board', (await state()).view === 'sources')
  check('the stage is hidden behind it', await page.eval(`document.querySelector('.stage').hidden`))
  const rows = await page.json(
    `[...document.querySelectorAll('.src-row')].map((row) => ({ status: row.dataset.status, label: row.querySelector('.src-row__status').textContent.trim(), todo: Boolean(row.querySelector('.src-row__todo')) }))`,
  )
  check('every catalogued source is listed', rows.length === SOURCES.length, `${rows.length} rows`)
  check(
    'Internet Archive collections in scope are marked in scope',
    rows.filter((r) => r.status === 'selected').length === SOURCES.filter((s) => s.status === 'selected').length,
  )
  check(
    'unavailable sources all carry a todo',
    rows.filter((r) => r.status === 'unavailable').every((r) => r.todo),
  )
  check(
    'status is written out, not only coloured',
    rows.every((r) => (r.status === 'selected' ? r.label === 'In scope' : r.label === 'Unavailable')),
  )
  check(
    'in-scope rows are green',
    await page.eval(
      `getComputedStyle(document.querySelector('.src-row[data-status="selected"] .src-dot')).backgroundColor === 'rgb(127, 197, 143)'`,
    ),
  )
  // Switching views faster than a transition can finish skips the earlier ones; that must not surface as an error
  await page.eval(`(() => {
    for (let i = 0; i < 6; i++) {
      __unmarked.actions.showLibrary()
      __unmarked.actions.showSources()
      __unmarked.actions.showDiscover()
    }
    __unmarked.actions.showSources()
  })()`)
  await sleep(1200)
  check(
    'rapid view switching raises no errors',
    !(await page.eval('document.documentElement.dataset.errors || ""')),
    await page.eval('document.documentElement.dataset.errors || ""'),
  )
  check('...and ends on the last requested view', (await state()).view === 'sources')

  // The map-age line describes the live Archive map, which mock mode does not have
  check('mock mode shows no Archive map status', await page.eval(`!document.querySelector('.sources__map')`))
  await page.key('Escape')
  await sleep(500)
  check('Escape leaves the sources board', (await state()).view === 'discover')

  // Documentation sheet: the docs open inside the page, so navigating never interrupts the music.
  // Reload without clearing storage: the export checks below still need the seeded library.
  await page.send('Page.navigate', { url: `${base}&record=mock:001` })
  await sleep(1800)
  await page.eval('__unmarked.actions.togglePlayViewed()')
  await sleep(500)
  const playingBefore = (await state()).status
  check('music is playing before the docs open', playingBefore === 'playing', playingBefore)
  const docsLinkLabel = await page.eval(
    `[...document.querySelectorAll('.topbar .navlink')].find((b) => b.textContent.trim() === 'Docs')?.textContent ?? ''`,
  )
  check('the topbar has a Docs control', docsLinkLabel === 'Docs')
  check('nothing is loaded before the docs are opened', await page.eval(`!document.querySelector('.docs-frame')`))
  await page.eval(
    `[...document.querySelectorAll('.topbar .navlink')].find((b) => b.textContent.trim() === 'Docs').click()`,
  )
  await sleep(700)
  check('opening Docs shows the sheet', await page.eval(`!document.querySelector('.sheet--docs').hidden`))
  check(
    'the docs load in an iframe with an accessible title, in the page',
    await page.eval(
      `(() => { const f = document.querySelector('.docs-frame'); return f?.tagName === 'IFRAME' && f.title !== '' && f.src.endsWith('/docs/') })()`,
    ),
  )
  check(
    'the sheet is a modal dialog and the background is inert',
    await page.eval(
      `document.querySelector('.sheet--docs').getAttribute('aria-modal') === 'true' && document.querySelector('.main').hasAttribute('inert')`,
    ),
  )
  check(
    'focus moves into the sheet',
    await page.eval(`document.querySelector('.sheet--docs').contains(document.activeElement)`),
  )
  check('the music keeps playing underneath', (await state()).status === playingBefore, `${playingBefore}`)
  await page.key('Escape')
  await sleep(700)
  check(
    'Escape closes the docs and frees the background',
    await page.eval(
      `document.querySelector('.sheet--docs').hidden && !document.querySelector('.main').hasAttribute('inert')`,
    ),
  )
  check('closing keeps the music going', (await state()).status === playingBefore)
  await page.eval('__unmarked.actions.togglePrefs()')
  await sleep(300)
  await page.eval(
    `[...document.querySelectorAll('.prefs .btn')].find((b) => b.textContent.includes('Documentation')).click()`,
  )
  await sleep(700)
  check(
    'Preferences opens the same sheet and closes itself, so nothing stacks (the phone path)',
    await page.eval(`!document.querySelector('.sheet--docs').hidden && document.querySelector('.prefs').hidden`),
  )
  await page.eval('__unmarked.actions.closeDocs()')
  await sleep(700)

  // Export and import round trip
  const exported = await page.eval('__unmarked.actions.exportLibrary()')
  const parsed = JSON.parse(exported)
  check(
    'export is valid, versioned JSON',
    parsed.app === 'unmarked' && parsed.version === 1 && parsed.kept.length === 7,
  )
  await page.eval('__unmarked.actions.proto.resetLibrary()')
  await page.eval(`__unmarked.actions.importLibrary(${JSON.stringify(exported)})`)
  check('import restores kept entries', (await state()).kept === 7)
  const rejected = await page.eval(
    `(() => { try { __unmarked.actions.importLibrary('{"nope":1}'); return 'accepted' } catch (e) { return e.message } })()`,
  )
  check('import rejects a foreign file', /not an Unmarked export/.test(rejected), rejected)

  await page.send('Page.navigate', { url: `${base}&record=mock:002` })
  await sleep(1800)
  check('kept entries survive a reload', (await state()).kept === 7)

  // Failure and retry
  await page.eval('__unmarked.source.settings.failNext = true; void __unmarked.actions.discover({ autoplay: false })')
  await sleep(500)
  check('failed draw shows the notice', await page.eval(`Boolean(document.querySelector('.notice')?.isConnected)`))
  check(
    'notice is announced as an alert',
    await page.eval(`document.querySelector('.notice').getAttribute('role') === 'alert'`),
  )
  await page.eval(`document.querySelector('.notice .btn').click()`)
  await sleep(1200)
  check(
    'Try again recovers',
    (await state()).draw === 'ready' && !(await page.eval(`document.querySelector('.notice')?.isConnected`)),
  )

  // Reduced motion and accessibility basics
  await page.eval('__unmarked.actions.setPref("motion", "reduced")')
  await sleep(200)
  check(
    'reduced motion collapses duration tokens',
    (await page.eval(`getComputedStyle(document.documentElement).getPropertyValue('--dur-develop').trim()`)) === '1ms',
  )
  await page.eval('__unmarked.actions.setPref("motion", "system")')

  const unnamed = await page.json(
    `[...document.querySelectorAll('button, [role=slider], input')].filter((el) => el.offsetParent !== null || el.closest('.dock, .actionbar')).filter((el) => !(el.getAttribute('aria-label') || el.textContent.trim() || el.getAttribute('aria-labelledby'))).map((el) => el.className)`,
  )
  check('every visible control has an accessible name', unnamed.length === 0, JSON.stringify(unnamed))
  check(
    'every image has an alt attribute',
    (await page.eval(`[...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length`)) === 0,
  )
  const small = await page.json(
    `[...document.querySelectorAll('button, [role=slider], a[href]')].filter((el) => el.offsetParent !== null).map((el) => { const r = el.getBoundingClientRect(); return { cls: String(el.className || el.tagName), w: Math.round(r.width), h: Math.round(r.height) } }).filter((t) => t.w < 24 || t.h < 24)`,
  )
  check(
    'no interactive target smaller than 24px (WCAG 2.2 AA)',
    small.length === 0,
    JSON.stringify(small).slice(0, 240),
  )

  await page.close()
  return summary()
}
