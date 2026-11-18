// Uniform random draw over the frame using the committed partition map: one rank, one search call.
const NO_DATE = 'NOT publicdate:[* TO *]'

// Map windows are [from, to, count] with inclusive ISO bounds; items lacking publicdate form a last bucket
export function createSampler({ map, random = Math.random }) {
  const buckets = [
    ...map.windows.map(([from, to, count]) => ({ clause: `publicdate:[${from} TO ${to}]`, count })),
    ...(map.noDate > 0 ? [{ clause: NO_DATE, count: map.noDate }] : []),
  ]
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0)

  const starts = []
  let running = 0
  for (const bucket of buckets) {
    starts.push(running)
    running += bucket.count
  }

  // Last bucket whose first rank is <= rank
  function locate(rank) {
    let low = 0
    let high = buckets.length - 1
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      if (starts[mid] <= rank) low = mid
      else high = mid - 1
    }
    return { bucket: buckets[low], offset: rank - starts[low] }
  }

  function plan(rank) {
    const { bucket, offset } = locate(rank)
    return { clause: bucket.clause, page: offset + 1 }
  }

  function next(frame) {
    const { clause, page } = plan(Math.floor(random() * total))
    // Stable order inside a window so page N always means the same item
    return { query: `${frame} AND ${clause}`, page, rows: 1, sort: 'identifier asc' }
  }

  return { next, plan, total }
}
