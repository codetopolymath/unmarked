// Audius REST API: anonymous reads with CORS, over the shared retrying HTTP layer.
import { createHttp } from '../http.js'

const API_URL = 'https://api.audius.co/v1'

export class AudiusError extends Error {
  constructor(message, { status = 0, cause } = {}) {
    super(message, { cause })
    this.name = 'AudiusError'
    this.status = status
  }
}

export function createAudiusClient({ apiKey = '', appName = 'unmarked', ...options } = {}) {
  const { request, probe } = createHttp({ ...options, ErrorType: AudiusError })

  function withIdentity(url) {
    url.searchParams.set('app_name', appName)
    if (apiKey) url.searchParams.set('api_key', apiKey)
    return url
  }

  async function get(path, params = {}, { signal } = {}) {
    const url = withIdentity(new URL(API_URL + path))
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
    const body = await (await request(url, { signal, init: { cache: 'no-store' } })).json()
    return body?.data
  }

  // The API answers with a redirect to a creator node; the browser follows it, so this url is stable
  const streamUrl = (id) => withIdentity(new URL(`${API_URL}/tracks/${encodeURIComponent(id)}/stream`)).href

  // A fresh random batch on every call, no cache-busting needed (probed 2026-11-20)
  async function lucky({ count = 20, signal } = {}) {
    const tracks = await get('/tracks/feeling-lucky', { limit: count }, { signal })
    return Array.isArray(tracks) ? tracks : []
  }

  async function byId(id, { signal } = {}) {
    const track = await get(`/tracks/${encodeURIComponent(id)}`, {}, { signal })
    return track && !Array.isArray(track) ? track : null
  }

  return { lucky, byId, probe, streamUrl }
}
