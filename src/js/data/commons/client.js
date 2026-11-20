// Wikimedia Commons Action API, anonymous and cross-origin (origin=*), over the shared retrying HTTP layer.
import { createHttp } from '../http.js'

const API_URL = 'https://commons.wikimedia.org/w/api.php'

// Music files over 300 KB (kilobytes in Cirrus), MIDI excluded: drops the short pronunciation-style clips
export const FRAME = 'filetype:audio deepcategory:"Audio files of music" filesize:>300 -filemime:midi'

const VIDEOINFO = {
  prop: 'videoinfo|categories',
  // "size" is what makes the reply include duration
  viprop: 'url|mime|size|derivatives|extmetadata|mediatype',
  viextmetadatafilter:
    'LicenseShortName|LicenseUrl|UsageTerms|AttributionRequired|Artist|Credit|ImageDescription|DateTimeOriginal|ObjectName',
  // Visible categories only; the provenance one ("Audio files from ...") is picked out in normalize
  clshow: '!hidden',
  cllimit: 'max',
}

// The search answers 200 with an error body when it is overloaded
const BUSY = new Set(['cirrussearch-too-busy-error', 'ratelimited'])

export class CommonsError extends Error {
  constructor(message, { status = 0, cause } = {}) {
    super(message, { cause })
    this.name = 'CommonsError'
    this.status = status
  }
}

export function createCommonsClient(options = {}) {
  const { request, probe } = createHttp({ ...options, ErrorType: CommonsError })

  async function query(params, { signal } = {}) {
    const url = new URL(API_URL)
    for (const [key, value] of Object.entries({
      action: 'query',
      format: 'json',
      formatversion: 2,
      origin: '*',
      ...params,
    })) {
      url.searchParams.set(key, String(value))
    }
    const body = await (await request(url, { signal, shouldRetry: (reply) => BUSY.has(reply?.error?.code) })).json()
    if (body?.error) throw new CommonsError(body.error.info ?? 'Commons rejected the request')
    return body
  }

  // The CDN caches identical requests for an hour, so an unrecognised unique parameter is what makes each pick fresh
  async function random({ count = 5, signal } = {}) {
    const body = await query(
      {
        generator: 'search',
        gsrnamespace: 6,
        gsrsearch: FRAME,
        gsrsort: 'random',
        gsrlimit: count,
        ...VIDEOINFO,
        rnd: Math.random().toString(36).slice(2),
      },
      { signal },
    )
    return body.query?.pages ?? []
  }

  async function byPageId(pageId, { signal } = {}) {
    const body = await query({ pageids: pageId, ...VIDEOINFO }, { signal })
    const page = body.query?.pages?.[0]
    return page && !page.missing ? page : null
  }

  return { random, byPageId, probe }
}
