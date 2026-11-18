// Retrying fetch plus a cheap playability probe, shared by every remote source.
export class RemoteError extends Error {
  constructor(message, { status = 0, cause } = {}) {
    super(message, { cause })
    this.name = 'RemoteError'
    this.status = status
  }
}

// 507 is what the Archive's search answers under load
const RETRYABLE = new Set([429, 500, 502, 503, 504, 507])

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

export function createHttp({
  fetchImpl = (...args) => globalThis.fetch(...args),
  sleep = defaultSleep,
  retries = 3,
  timeoutMs = 15000,
  baseDelayMs = 600,
  ErrorType = RemoteError,
} = {}) {
  // Retry-worthy failures that arrive with a 200 (the Commons search does this) can ask for another attempt
  async function request(url, { signal, init, attempts = retries, shouldRetry } = {}) {
    for (let attempt = 0; ; attempt++) {
      signal?.throwIfAborted()
      const timeout = AbortSignal.timeout(timeoutMs)
      let response
      try {
        response = await fetchImpl(url, { ...init, signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
      } catch (cause) {
        // Caller cancelled: not a network failure, never retried
        if (signal?.aborted) throw signal.reason
        if (attempt >= attempts) throw new ErrorType('The source did not answer', { cause })
        await sleep(baseDelayMs * 2 ** attempt, signal)
        continue
      }
      if (response.ok || response.status === 206) {
        if (!shouldRetry) return response
        const body = await response.json()
        if (!shouldRetry(body)) return { json: async () => body, status: response.status, headers: response.headers }
        if (attempt >= attempts) throw new ErrorType('The source is too busy', { status: 429 })
        await sleep(baseDelayMs * 2 ** attempt, signal)
        continue
      }
      if (!RETRYABLE.has(response.status) || attempt >= attempts) {
        throw new ErrorType(`The source answered ${response.status}`, { status: response.status })
      }
      // A stated Retry-After beats our own back-off
      const stated = Number(response.headers.get('retry-after'))
      await sleep(stated > 0 ? stated * 1000 : baseDelayMs * 2 ** attempt, signal)
    }
  }

  // Two bytes are enough to learn whether a file streams, without paying for the audio
  async function probe(url, { signal } = {}) {
    try {
      const response = await request(url, { signal, init: { headers: { Range: 'bytes=0-1' } }, attempts: 0 })
      const type = response.headers.get('content-type') ?? ''
      return { ok: !type.startsWith('text/'), status: response.status, ranges: response.status === 206 }
    } catch (error) {
      if (error instanceof ErrorType) return { ok: false, status: error.status, ranges: false }
      throw error
    }
  }

  return { request, probe }
}
