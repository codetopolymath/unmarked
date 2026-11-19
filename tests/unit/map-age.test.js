import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { mapAge, STALE_AFTER_DAYS } from '../../src/js/data/ia/map-age.js'
import { checkMapAge } from '../../tools/check-map-age.mjs'

const run = promisify(execFile)
const TOOL = fileURLToPath(new URL('../../tools/check-map-age.mjs', import.meta.url))
const DAY = 86400000
const BUILT = '2026-11-18T11:00:00.000Z'
const at = (days) => Date.parse(BUILT) + days * DAY

test('age is counted in whole days and worded for people', () => {
  assert.deepEqual(mapAge(BUILT, at(0)), { days: 0, stale: false, text: 'today' })
  assert.deepEqual(mapAge(BUILT, at(0.9)), { days: 0, stale: false, text: 'today' })
  assert.deepEqual(mapAge(BUILT, at(1)), { days: 1, stale: false, text: '1 day ago' })
  assert.deepEqual(mapAge(BUILT, at(12)), { days: 12, stale: false, text: '12 days ago' })
})

test('a map becomes stale exactly at the threshold, not a day before', () => {
  assert.equal(mapAge(BUILT, at(STALE_AFTER_DAYS - 1)).stale, false)
  assert.equal(mapAge(BUILT, at(STALE_AFTER_DAYS)).stale, true)
  assert.equal(mapAge(BUILT, at(200)).text, '200 days ago')
})

test('a clock before the build date, or an unreadable date, never throws and an unknown date is stale', () => {
  assert.equal(mapAge(BUILT, at(-3)).days, 0)
  for (const bad of [undefined, null, '', 'not a date']) {
    assert.deepEqual(mapAge(bad, at(1)), { days: null, stale: true, text: 'at an unknown date' })
  }
})

async function withMap(builtAt, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'unmarked-age-'))
  const file = join(dir, 'ia-map.json')
  await writeFile(file, JSON.stringify({ builtAt, windows: [] }))
  try {
    return await fn(file)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('the check says fresh when fresh, and emits a GitHub warning annotation when stale', async () => {
  await withMap(BUILT, async (file) => {
    const fresh = await checkMapAge({ file, now: at(10) })
    assert.equal(fresh.stale, false)
    assert.match(fresh.lines[0], /fresh/)
    assert.ok(!fresh.lines[0].startsWith('::warning'))

    const stale = await checkMapAge({ file, now: at(60) })
    assert.equal(stale.stale, true)
    assert.match(stale.lines[0], /^::warning file=src\/data\/ia-map\.json,title=Archive map is stale::/)
    assert.match(stale.lines[0], /60 days ago/)
    assert.match(stale.lines[0], /npm run build:map/)
  })
})

test('the command line never fails the build, even for a very old map', async () => {
  const { stdout } = await run('node', [TOOL, '--now=2030-01-01'])
  assert.match(stdout, /^::warning /, 'a far-future date reads as stale')
  const today = await run('node', [TOOL])
  assert.match(today.stdout, /Archive map built/)
})
