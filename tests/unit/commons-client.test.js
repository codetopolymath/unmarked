import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCommonsClient, CommonsError, FRAME } from '../../src/js/data/commons/client.js'

const reply = (body, status = 200) => new Response(JSON.stringify(body), { status })

function scripted(...responses) {
  const calls = []
  const delays = []
  const client = createCommonsClient({
    fetchImpl: async (url) => {
      calls.push(new URL(url))
      return responses.shift()
    },
    sleep: async (ms) => delays.push(ms),
    baseDelayMs: 100,
  })
  return { client, calls, delays }
}

test('random asks for fresh picks over the music frame, cross-origin', async () => {
  const pages = [{ pageid: 1 }, { pageid: 2 }]
  const { client, calls } = scripted(reply({ query: { pages } }))
  assert.deepEqual(await client.random({ count: 5 }), pages)
  const params = calls[0].searchParams
  assert.equal(params.get('origin'), '*')
  assert.equal(params.get('formatversion'), '2')
  assert.equal(params.get('generator'), 'search')
  assert.equal(params.get('gsrsort'), 'random')
  assert.equal(params.get('gsrlimit'), '5')
  assert.equal(params.get('gsrsearch'), FRAME)
  assert.match(params.get('viprop'), /\bsize\b/, 'size is what returns duration')
  assert.match(params.get('viprop'), /derivatives/)
})

test('every random call is a distinct URL, because the CDN caches identical ones for an hour', async () => {
  const { client, calls } = scripted(
    reply({ query: { pages: [] } }),
    reply({ query: { pages: [] } }),
    reply({ query: { pages: [] } }),
  )
  for (let i = 0; i < 3; i++) await client.random()
  assert.equal(new Set(calls.map((url) => url.href)).size, 3)
  assert.ok(calls.every((url) => url.searchParams.get('rnd')))
  assert.ok(!calls[0].searchParams.get('viprop').split('|').includes('duration'), 'duration is not a viprop value')
})

test('an empty result is an empty list, not an error', async () => {
  const { client } = scripted(reply({ batchcomplete: true }))
  assert.deepEqual(await client.random(), [])
})

test('the 200 "too busy" body is retried with back-off', async () => {
  const busy = () => reply({ error: { code: 'cirrussearch-too-busy-error', info: 'busy' } })
  const { client, calls, delays } = scripted(busy(), busy(), reply({ query: { pages: [{ pageid: 9 }] } }))
  assert.deepEqual(await client.random(), [{ pageid: 9 }])
  assert.equal(calls.length, 3)
  assert.deepEqual(delays, [100, 200])
})

test('staying busy past the retry budget fails as CommonsError', async () => {
  const busy = () => reply({ error: { code: 'cirrussearch-too-busy-error', info: 'busy' } })
  const { client, calls } = scripted(busy(), busy(), busy(), busy())
  await assert.rejects(client.random(), (error) => error instanceof CommonsError && error.status === 429)
  assert.equal(calls.length, 4)
})

test('other API errors are not retried', async () => {
  const { client, calls } = scripted(reply({ error: { code: 'badvalue', info: 'bad' } }))
  await assert.rejects(client.random(), { name: 'CommonsError', message: 'bad' })
  assert.equal(calls.length, 1)
})

test('HTTP 503 is retried like the Archive client', async () => {
  const { client, calls } = scripted(new Response('', { status: 503 }), reply({ query: { pages: [] } }))
  await client.random()
  assert.equal(calls.length, 2)
})

test('byPageId returns the page, or null when it is gone', async () => {
  const found = scripted(reply({ query: { pages: [{ pageid: 5, title: 'File:x' }] } }))
  assert.equal((await found.client.byPageId(5)).pageid, 5)
  assert.equal(found.calls[0].searchParams.get('pageids'), '5')
  const gone = scripted(reply({ query: { pages: [{ pageid: 6, missing: true }] } }))
  assert.equal(await gone.client.byPageId(6), null)
})
