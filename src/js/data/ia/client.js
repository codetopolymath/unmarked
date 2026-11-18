// Thin, retrying wrapper over the three archive.org endpoints the app uses.
const SEARCH_URL = 'https://archive.org/advancedsearch.php'
const METADATA_URL = 'https://archive.org/metadata/'

// 507 is what the search service answers under load
const RETRYABLE = new Set([429, 500, 502, 503, 504, 507])

export class ArchiveError extends Error {
  constructor(message, { status = 0, cause } = {}) {
    super(message, { cause })
    this.name = 'ArchiveError'
    this.status = status
  }
}

const defaultSleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })

export function createClient({
  fetchImpl = (...args) => globalThis.fetch(...args),
  sleep = defaultSleep,
  retries = 3,
  timeoutMs = 15000,
  baseDelayMs = 600,
} = {}) {
  async function request(url, { signal, init, attempts = retries } = {}) {
    for (let attempt = 0; ; attempt++) {
      signal?.throwIfAborted()
      const timeout = AbortSignal.timeout(timeoutMs)
      let response
      try {
        response = await fetchImpl(url, { ...init, signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
      } catch (cause) {
        // Caller cancelled: not a network failure, never retried
        if (signal?.aborted) throw signal.reason
        if (attempt >= attempts) throw new ArchiveError('The archive did not answer', { cause })
        await sleep(baseDelayMs * 2 ** attempt, signal)
        continue
      }
      if (response.ok || response.status === 206) return response
      if (!RETRYABLE.has(response.status) || attempt >= attempts) {
        throw new ArchiveError(`The archive answered ${response.status}`, { status: response.status })
      }
      // A stated Retry-After beats our own back-off
      const stated = Number(response.headers.get('retry-after'))
      await sleep(stated > 0 ? stated * 1000 : baseDelayMs * 2 ** attempt, signal)
    }
  }

  async function search({ query, rows = 1, page = 1, sort, fields = ['identifier'], signal }) {
    const url = new URL(SEARCH_URL)
    url.searchParams.set('q', query)
    url.searchParams.set('rows', String(rows))
    url.searchParams.set('page', String(page))
    url.searchParams.set('output', 'json')
    for (const field of fields) url.searchParams.append('fl[]', field)
    if (sort) url.searchParams.append('sort[]', sort)
    const body = await (await request(url, { signal })).json()
    if (!body?.response) throw new ArchiveError('The archive sent a malformed search reply')
    return { total: body.response.numFound, docs: body.response.docs }
  }

  // The archive answers {} for items that are missing or taken down
  async function metadata(identifier, { signal } = {}) {
    const body = await (await request(METADATA_URL + encodeURIComponent(identifier), { signal })).json()
    return body?.metadata ? body : null
  }

  // Two bytes are enough to learn whether a file streams, without paying for the audio
  async function probe(url, { signal } = {}) {
    try {
      const response = await request(url, { signal, init: { headers: { Range: 'bytes=0-1' } }, attempts: 0 })
      const type = response.headers.get('content-type') ?? ''
      return { ok: !type.startsWith('text/'), status: response.status, ranges: response.status === 206 }
    } catch (error) {
      if (error.name === 'ArchiveError') return { ok: false, status: error.status, ranges: false }
      throw error
    }
  }

  return { search, metadata, probe }
}
