import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAudiusClient, AudiusError } from '../../src/js/data/audius/client.js'

const reply = (body, status = 200) => new Response(JSON.stringify(body), { status })

function scripted(options, ...responses) {
  const calls = []
  const client = createAudiusClient({
    ...options,
    fetchImpl: async (url, init) => {
      calls.push({ url: new URL(url), init })
      return responses.shift()
    },
    sleep: async () => {},
    baseDelayMs: 1,
  })
  return { client, calls }
}

test('lucky asks the Feeling Lucky list for a batch, identified by app name, uncached', async () => {
  const tracks = [{ id: 'a' }, { id: 'b' }]
  const { client, calls } = scripted({}, reply({ data: tracks }))
  assert.deepEqual(await client.lucky({ count: 20 }), tracks)
  assert.equal(calls[0].url.origin + calls[0].url.pathname, 'https://api.audius.co/v1/tracks/feeling-lucky')
  assert.equal(calls[0].url.searchParams.get('limit'), '20')
  assert.equal(calls[0].url.searchParams.get('app_name'), 'unmarked')
  assert.equal(calls[0].url.searchParams.has('api_key'), false)
  assert.equal(calls[0].init.cache, 'no-store')
})

test('a registered API key is sent on every request and in the stream url', async () => {
  const { client, calls } = scripted({ apiKey: 'KEY123' }, reply({ data: [] }), reply({ data: { id: 'a' } }))
  await client.lucky()
  await client.byId('a')
  assert.deepEqual(
    calls.map((c) => c.url.searchParams.get('api_key')),
    ['KEY123', 'KEY123'],
  )
  const stream = new URL(client.streamUrl('a b'))
  assert.equal(stream.pathname, '/v1/tracks/a%20b/stream')
  assert.equal(stream.searchParams.get('api_key'), 'KEY123')
  assert.equal(stream.searchParams.get('app_name'), 'unmarked')
})

test('an unexpected body gives an empty batch, not a crash', async () => {
  const { client } = scripted({}, reply({}), reply({ data: { not: 'a list' } }))
  assert.deepEqual(await client.lucky(), [])
  assert.deepEqual(await client.lucky(), [])
})

test('byId returns the track, or null when nothing matches', async () => {
  const { client, calls } = scripted({}, reply({ data: { id: 'x1' } }), reply({ data: [] }))
  assert.deepEqual(await client.byId('x1'), { id: 'x1' })
  assert.equal(calls[0].url.pathname, '/v1/tracks/x1')
  assert.equal(await client.byId('gone'), null)
})

test('a busy API is retried, and a hard failure becomes an AudiusError', async () => {
  const busy = scripted({}, new Response('', { status: 503 }), reply({ data: [{ id: 'a' }] }))
  assert.equal((await busy.client.lucky()).length, 1)
  assert.equal(busy.calls.length, 2)

  const missing = scripted({}, new Response('', { status: 404 }))
  await assert.rejects(missing.client.lucky(), (error) => error instanceof AudiusError && error.status === 404)
})
