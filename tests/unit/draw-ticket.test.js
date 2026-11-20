import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { formatCount, planColumns, rollTravel, ticketText, windowLabel } from '../../src/js/ui/draw-ticket.js'
import { createIaSource } from '../../src/js/data/ia/ia-source.js'
import { createCommonsSource } from '../../src/js/data/commons/commons-source.js'
import { createCombinedSource } from '../../src/js/data/live-source.js'
import { ArchiveError } from '../../src/js/data/ia/client.js'

const load = (dir, name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${dir}/${name}.json`, import.meta.url), 'utf8'))

test('formatCount groups thousands', () => {
  assert.equal(formatCount(0), '0')
  assert.equal(formatCount(999), '999')
  assert.equal(formatCount(385611), '385,611')
  assert.equal(formatCount(932104), '932,104')
})

test('ticketText reads like the catalogue label', () => {
  assert.equal(ticketText({ rank: 385611, total: 932104 }), 'Ticket 385,611 of 932,104')
})

test('windowLabel names the month, a month span, or no date', () => {
  assert.equal(windowLabel('2021-09-01T00:00:00Z', '2021-09-30T23:59:59Z'), 'uploaded Sep 2021')
  assert.equal(windowLabel('2021-01-01T00:00:00Z', '2021-03-31T23:59:59Z'), 'uploaded Jan–Mar 2021')
  assert.equal(windowLabel('2020-12-01T00:00:00Z', '2021-02-28T23:59:59Z'), 'uploaded Dec 2020 – Feb 2021')
  assert.equal(windowLabel(null, null), 'no upload date')
  assert.equal(windowLabel('nonsense', 'nonsense'), 'no upload date')
})

test('planColumns pads to the width of the total and marks thousands groups', () => {
  const plan = planColumns(385611, 932104)
  assert.deepEqual(
    plan.map((c) => c.digit),
    [3, 8, 5, 6, 1, 1],
  )
  assert.deepEqual(
    plan.map((c) => c.group),
    [false, false, false, true, false, false],
  )
  assert.ok(plan.every((c) => !c.pad))
  const small = planColumns(42, 932104)
  assert.deepEqual(
    small.map((c) => c.pad),
    [true, true, true, true, false, false],
  )
  assert.equal(planColumns(0, 18).length, 2)
})

test('rollTravel always moves forward by at least the requested turns', () => {
  assert.equal(rollTravel(3, 7, 0), 4)
  assert.equal(rollTravel(7, 3, 0), 6)
  assert.equal(rollTravel(5, 5, 0), 0)
  assert.equal(rollTravel(5, 5, 1), 10)
  assert.equal(rollTravel(9, 0, 1), 11)
  for (let from = 0; from < 10; from++) for (let to = 0; to < 10; to++) assert.ok(from + rollTravel(from, to) < 30)
})

// Search hands out identifiers in order; an unknown one has no metadata, so that candidate fails
const ITEMS = { alpha: load('ia', '78rpm'), beta: load('ia', 'netlabel') }
const IDS = Object.values(ITEMS).map((reply) => reply.metadata.identifier)
const MAP = {
  noDate: 0,
  windows: [
    ['2020-01-01T00:00:00Z', '2020-01-31T23:59:59Z', 3],
    ['2020-02-01T00:00:00Z', '2020-02-29T23:59:59Z', 3],
  ],
}

function iaClient(order) {
  let i = 0
  return {
    async search() {
      return { total: 6, docs: [{ identifier: order[i++ % order.length], subject: ['Jazz'] }] }
    },
    async metadata(identifier) {
      return Object.values(ITEMS).find((r) => r.metadata.identifier === identifier) ?? null
    },
    async probe() {
      return { ok: true, status: 206, ranges: true }
    },
  }
}

test('onAttempt reports each real ticket, including a failed candidate then a retry', async () => {
  const ranks = [0.1, 0.9]
  let n = 0
  const source = createIaSource({
    map: MAP,
    client: iaClient(['ghost', IDS[0]]),
    bufferSize: 0,
    random: () => ranks[n++],
  })
  const tickets = []
  const record = await source.draw({ onAttempt: (ticket) => tickets.push(ticket) })
  assert.deepEqual(tickets, [
    { rank: 0, total: 6, from: '2020-01-01T00:00:00Z', to: '2020-01-31T23:59:59Z' },
    { rank: 5, total: 6, from: '2020-02-01T00:00:00Z', to: '2020-02-29T23:59:59Z' },
  ])
  assert.deepEqual(record.draw, tickets[1], 'the record carries the ticket that found it')
})

test('a failing onAttempt hint never breaks a draw', async () => {
  const source = createIaSource({ map: MAP, client: iaClient([IDS[1]]), bufferSize: 0, random: () => 0.5 })
  const record = await source.draw({
    onAttempt: () => {
      throw new Error('hint failed')
    },
  })
  assert.equal(record.draw.total, 6)
})

test('a search error still reports the ticket that was tried', async () => {
  const client = iaClient([IDS[0]])
  client.search = async () => {
    throw new ArchiveError('down')
  }
  const tickets = []
  const source = createIaSource({ map: MAP, client, bufferSize: 0, random: () => 0 })
  await assert.rejects(source.draw({ onAttempt: (t) => tickets.push(t) }), { name: 'SourceUnreachable' })
  assert.equal(tickets.length, 3)
})

test('buffered records keep their own draw, and no attempt is reported for them', async () => {
  const source = createIaSource({ map: MAP, client: iaClient([IDS[0], IDS[1]]), bufferSize: 1, random: () => 0.5 })
  await source.draw()
  await new Promise((resolve) => setTimeout(resolve, 20))
  const tickets = []
  const record = await source.draw({ onAttempt: (t) => tickets.push(t) })
  assert.equal(tickets.length, 0)
  assert.equal(record.draw.total, 6)
  assert.equal(typeof record.draw.rank, 'number')
})

test('Commons never calls onAttempt and its records carry no draw', async () => {
  const page = load('commons', 'mp3')
  const client = {
    async random() {
      return [page]
    },
    async byPageId() {
      return page
    },
    async probe() {
      return { ok: true, status: 206, ranges: true }
    },
  }
  const commons = createCommonsSource({ client, bufferSize: 0 })
  const combined = createCombinedSource({
    parts: [{ name: 'commons', prefix: 'commons:', weight: 1, source: commons }],
    random: () => 0,
  })
  let calls = 0
  const record = await combined.draw({ onAttempt: () => calls++ })
  assert.equal(calls, 0)
  assert.equal(record.draw, undefined)
})
