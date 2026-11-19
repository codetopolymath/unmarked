// Real-browser check that playback survives a dead or stalling server by moving to the next url.
// A local server stands in for the archives: one answer is fine, one is 503, one goes silent mid-song.
import { createServer } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import { createReporter, openPage } from './harness.mjs'

const RATE = 8000
const SECONDS = 20
// Sixteen of the twenty seconds are delivered, then silence. Chrome only starts a stream once about 80% has
// arrived; with less it sits in "loading", which would test a failed start instead of a stall mid-song.
const STALL_AT_SECONDS = 16
const STALL_AFTER_BYTES = RATE * 2 * STALL_AT_SECONDS

// A 440 Hz tone as a WAV, so the browser has real audio to decode and a duration to report
function tone() {
  const samples = RATE * SECONDS
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples * 2, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(RATE, 24)
  buffer.writeUInt32LE(RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  for (let i = 0; i < samples; i++)
    buffer.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / RATE) * 6000), 44 + i * 2)
  return buffer
}

function startAudioServer() {
  const wav = tone()
  const requests = []
  const server = createServer((request, response) => {
    const path = request.url.split('?')[0]
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? '')
    const start = range ? Number(range[1]) : 0
    requests.push({ path, start })
    if (path.startsWith('/dead')) {
      response.writeHead(503, { 'content-type': 'text/plain' })
      response.end('unavailable')
      return
    }
    const end = range && range[2] ? Number(range[2]) : wav.length - 1
    response.writeHead(range ? 206 : 200, {
      'content-type': 'audio/wav',
      'accept-ranges': 'bytes',
      'content-length': end - start + 1,
      ...(range && { 'content-range': `bytes ${start}-${end}/${wav.length}` }),
    })
    if (path === '/stall.wav') {
      // Promise the whole range, deliver two seconds of it, then say nothing and never finish
      response.write(wav.subarray(start, Math.min(end + 1, start + STALL_AFTER_BYTES)))
      return
    }
    response.end(wav.subarray(start, end + 1))
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, requests, base: `http://127.0.0.1:${server.address().port}` }),
    )
  })
}

export async function run(browser, baseUrl) {
  const { check, summary } = createReporter('rescue')
  const { server, requests, base } = await startAudioServer()
  const page = await openPage(browser, `${baseUrl}/index.html?source=mock&debug=1&latency=0`)
  await sleep(2000)

  const play = (audio) =>
    page.eval(`(() => {
      const record = structuredClone(__unmarked.store.get().viewed)
      record.id = 'test:rescue:' + Math.random()
      record.tracks = [{ index: 0, title: 'Rescue', duration_s: ${SECONDS}, audio: ${JSON.stringify(audio)} }]
      __unmarked.actions.playTrack(record, 0)
    })()`)
  const player = () =>
    page.json(`(() => ({ status: __unmarked.store.get().player.status, pos: __unmarked.clock.get().position }))()`)
  const until = async (test, timeoutMs) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const now = await player()
      if (test(now)) return now
      await sleep(250)
    }
    return null
  }
  const toasts = () => page.eval(`document.querySelector('.toasts')?.textContent || ''`)

  try {
    // 1. The first server is down; the second is fine
    requests.length = 0
    await play({ url: `${base}/dead.wav`, fallbacks: [`${base}/ok.wav`] })
    const recovered = await until((p) => p.status === 'playing' && p.pos > 0.5, 15000)
    check('a dead first server is skipped and the next one plays', Boolean(recovered), JSON.stringify(await player()))
    check(
      '...after trying the dead one first',
      requests[0]?.path === '/dead.wav' && requests.some((r) => r.path === '/ok.wav'),
    )
    check('the listener is told', /another/i.test(await toasts()), await toasts())

    // 2. The server goes silent sixteen seconds in; after the stall window the next url takes over at the same place
    requests.length = 0
    await play({ url: `${base}/stall.wav`, fallbacks: [`${base}/ok.wav`] })
    const started = await until((p) => p.status === 'playing' && p.pos > 0.5, 15000)
    check('the stalling stream starts out playing', Boolean(started))
    // Jump to just before the end of what was delivered, so the stall comes a second later, not sixteen
    await page.eval(`__unmarked.actions.seek(${STALL_AT_SECONDS - 1.2})`)
    const reached = await until((p) => p.pos >= STALL_AT_SECONDS - 0.5, 15000)
    const stalledAt = reached?.pos ?? 0
    // The first moment the fallback is audibly playing. Requests cannot show the resume (the small file arrives
    // whole, so seeking is served from memory); the position can: near the stall, not back at zero.
    const switched = await until((p) => p.status === 'playing' && requests.some((r) => r.path === '/ok.wav'), 40000)
    check(
      'after the stall the fallback takes over',
      Boolean(switched),
      JSON.stringify({ stalledAt, now: await player() }),
    )
    check(
      '...resuming where it stalled, not replaying the song from the start',
      Boolean(switched) && switched.pos >= stalledAt - 2 && switched.pos <= stalledAt + 5,
      JSON.stringify({ stalledAt, resumedAt: switched?.pos }),
    )
    const carried = await until((p) => p.status === 'playing' && p.pos > (switched?.pos ?? 0) + 1.5, 10000)
    check('...and keeps playing from there', Boolean(carried), JSON.stringify(await player()))
    check('...having stalled first, so the stall was real', requests.filter((r) => r.path === '/stall.wav').length >= 1)

    // 3. Every server is down: the track fails instead of looping forever
    requests.length = 0
    await play({ url: `${base}/dead-1.wav`, fallbacks: [`${base}/dead-2.wav`] })
    const failed = await until((p) => p.status === 'error', 15000)
    check('when every url is dead the track reports an error', Boolean(failed), JSON.stringify(await player()))
    check('...after trying each url once', requests.length === 2, JSON.stringify(requests))
  } finally {
    await page.close()
    server.closeAllConnections?.()
    server.close()
  }
  return summary()
}
