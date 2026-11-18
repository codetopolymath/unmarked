import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, ArchiveError } from '../../src/js/data/ia/client.js'

const reply = (status, body = {}, headers = {}) => new Response(JSON.stringify(body), { status, headers })

function scripted(...responses) {
  const calls = []
  const delays = []
  const client = createClient({
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init })
      const next = responses.shift()
      if (next instanceof Error) throw next
      return next
    },
    sleep: async (ms) => delays.push(ms),
    baseDelayMs: 100,
  })
  return { client, calls, delays }
}

test('search sends the query and returns total and docs', async () => {
  const { client, calls } = scripted(reply(200, { response: { numFound: 7, docs: [{ identifier: 'a' }] } }))
  const result = await client.search({ query: 'x AND y', rows: 1, page: 3, sort: 'identifier asc' })
  assert.deepEqual(result, { total: 7, docs: [{ identifier: 'a' }] })
  const url = new URL(calls[0].url)
  assert.equal(url.searchParams.get('q'), 'x AND y')
  assert.equal(url.searchParams.get('page'), '3')
  assert.equal(url.searchParams.get('sort[]'), 'identifier asc')
  assert.equal(url.searchParams.get('fl[]'), 'identifier')
})

test('retries 503 with exponential back-off, then succeeds', async () => {
  const { client, calls, delays } = scripted(
    reply(503),
    reply(503),
    reply(200, { response: { numFound: 0, docs: [] } }),
  )
  await client.search({ query: 'q' })
  assert.equal(calls.length, 3)
  assert.deepEqual(delays, [100, 200])
})

test('honours Retry-After on 429', async () => {
  const { client, delays } = scripted(
    reply(429, {}, { 'retry-after': '2' }),
    reply(200, { response: { numFound: 0, docs: [] } }),
  )
  await client.search({ query: 'q' })
  assert.deepEqual(delays, [2000])
})

test('does not retry a 404 and surfaces the status', async () => {
  const { client, calls } = scripted(reply(404))
  await assert.rejects(client.metadata('gone'), (error) => error instanceof ArchiveError && error.status === 404)
  assert.equal(calls.length, 1)
})

test('gives up after the retry budget', async () => {
  const { client, calls } = scripted(reply(503), reply(503), reply(503), reply(503))
  await assert.rejects(client.search({ query: 'q' }), { name: 'ArchiveError' })
  assert.equal(calls.length, 4)
})

test('network failures are retried and then reported as ArchiveError', async () => {
  const { client } = scripted(...Array.from({ length: 4 }, () => new TypeError('fetch failed')))
  await assert.rejects(client.search({ query: 'q' }), { name: 'ArchiveError' })
})

test('a caller abort is passed through, not retried', async () => {
  const controller = new AbortController()
  const { client, calls } = scripted(new DOMException('aborted', 'AbortError'))
  controller.abort()
  await assert.rejects(client.search({ query: 'q', signal: controller.signal }), { name: 'AbortError' })
  assert.equal(calls.length, 0)
})

test('metadata returns null for the empty object the archive sends for missing items', async () => {
  const { client } = scripted(reply(200, {}))
  assert.equal(await client.metadata('missing'), null)
})

test('probe asks for two bytes and rejects HTML busy pages', async () => {
  const good = scripted(new Response('ab', { status: 206, headers: { 'content-type': 'audio/mpeg' } }))
  assert.deepEqual(await good.client.probe('https://x/a.mp3'), { ok: true, status: 206, ranges: true })
  assert.equal(good.calls[0].init.headers.Range, 'bytes=0-1')

  const busy = scripted(new Response('<html>busy</html>', { status: 200, headers: { 'content-type': 'text/html' } }))
  assert.equal((await busy.client.probe('https://x/a.mp3')).ok, false)

  const gone = scripted(reply(503))
  assert.deepEqual(await gone.client.probe('https://x/a.mp3'), { ok: false, status: 503, ranges: false })
  assert.equal(gone.calls.length, 1)
})
