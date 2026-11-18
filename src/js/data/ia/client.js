// The three archive.org endpoints the app uses, over the shared retrying HTTP layer.
import { createHttp } from '../http.js'

const SEARCH_URL = 'https://archive.org/advancedsearch.php'
const METADATA_URL = 'https://archive.org/metadata/'

export class ArchiveError extends Error {
  constructor(message, { status = 0, cause } = {}) {
    super(message, { cause })
    this.name = 'ArchiveError'
    this.status = status
  }
}

export function createClient(options = {}) {
  const { request, probe } = createHttp({ ...options, ErrorType: ArchiveError })

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

  // Small text files inside an item, such as Jamendo's License.txt
  async function text(url, { signal } = {}) {
    return (await request(url, { signal })).text()
  }

  // The archive answers {} for items that are missing or taken down
  async function metadata(identifier, { signal } = {}) {
    const body = await (await request(METADATA_URL + encodeURIComponent(identifier), { signal })).json()
    return body?.metadata ? body : null
  }

  return { search, metadata, text, probe }
}
