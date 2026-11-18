// Motion contract: what animates, for how long, and that nothing loops needlessly.
import { setTimeout as sleep } from 'node:timers/promises'
import { createReporter, openPage } from './harness.mjs'

const DESCRIBE = `(() => document.getAnimations().map((a) => {
  const timing = a.effect?.getTiming?.() ?? {}
  const target = a.effect?.target
  return {
    type: a.constructor.name,
    name: a.animationName || a.transitionProperty || '',
    target: target ? (target.className?.baseVal ?? target.className ?? target.tagName) : '',
    duration: timing.duration,
    infinite: timing.iterations === Infinity,
    state: a.playState,
  }
}))()`

// Resolves shortly after a draw lands, while its entrance animations are still running
const AFTER_DRAW = `new Promise((resolve) => {
  const timer = setInterval(() => {
    if (__unmarked.store.get().draw.status !== 'drawing') { clearInterval(timer); setTimeout(resolve, 120) }
  }, 20)
})`

export async function run(browser, baseUrl) {
  const { check, summary } = createReporter('motion')
  const page = await openPage(browser, `${baseUrl}/index.html?debug=1&latency=0&record=mock:001`)
  const animations = () => page.json(DESCRIBE)
  await sleep(1600)

  let list = await animations()
  check(
    'idle page has no infinite animations',
    list.every((a) => !a.infinite),
    JSON.stringify(list.filter((a) => a.infinite)),
  )

  // `void` so the evaluation returns immediately instead of waiting for the draw
  await page.eval(
    '__unmarked.source.settings.latencyMs = 1500; __unmarked.source.settings.nextId = "mock:008"; void __unmarked.actions.discover({ autoplay: false })',
  )
  await sleep(400)
  list = await animations()
  check(
    'scan line runs while a draw is in flight',
    list.some((a) => a.name === 'scan' && a.infinite),
  )

  await page.eval(AFTER_DRAW)
  list = await animations()
  check(
    'develop reveal runs on the new cover (900 ms)',
    list.some((a) => a.type === 'Animation' && a.target === 'plate__img' && a.duration === 900),
  )
  check(
    'wash colour transitions through the registered property',
    list.some((a) => a.type === 'CSSTransition' && a.name === '--wash'),
  )
  check(
    'metadata arrives with the staggered rise',
    list.some((a) => a.name === 'rise'),
  )

  await sleep(1500)
  list = await animations()
  check(
    'everything settles after the transition',
    list.every((a) => a.state !== 'running'),
    JSON.stringify(list.filter((a) => a.state === 'running')),
  )

  await page.eval('__unmarked.actions.playTrack(__unmarked.store.get().viewed, 0)')
  await sleep(900)
  list = await animations()
  const loops = list.filter((a) => a.infinite)
  check(
    'while playing, only the equaliser loops',
    loops.length > 0 && loops.every((a) => a.name === 'eq'),
    JSON.stringify(loops.map((a) => a.name)),
  )
  await page.eval('__unmarked.actions.togglePlayback()')
  await sleep(500)
  list = await animations()
  check(
    'pausing stops the equaliser',
    list.every((a) => !a.infinite),
  )

  await page.eval('__unmarked.actions.setPref("motion", "reduced")')
  await page.eval(
    '__unmarked.source.settings.latencyMs = 1000; __unmarked.source.settings.nextId = "mock:013"; void __unmarked.actions.discover({ autoplay: false })',
  )
  await sleep(300)
  list = await animations()
  check(
    'reduced motion: nothing loops while a draw is in flight',
    list.every((a) => !a.infinite),
    JSON.stringify(list.filter((a) => a.infinite)),
  )
  await page.eval(AFTER_DRAW)
  await sleep(400)
  list = await animations()
  check('reduced motion: no plate reveal animation', !list.some((a) => a.target === 'plate__img'))
  check(
    'reduced motion: nothing longer than a few milliseconds',
    list.every((a) => typeof a.duration !== 'number' || a.duration <= 20),
    JSON.stringify(list.filter((a) => a.duration > 20)),
  )
  check(
    'reduced motion: the cover is visible immediately',
    await page.eval(`getComputedStyle(document.querySelector('.plate__img')).opacity === '1'`),
  )

  await page.eval('__unmarked.actions.setPref("motion", "system")')
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await sleep(200)
  check(
    'the operating-system setting is honoured',
    (await page.eval(`getComputedStyle(document.documentElement).getPropertyValue('--dur-slow').trim()`)) === '1ms',
  )

  await page.close()
  return summary()
}
