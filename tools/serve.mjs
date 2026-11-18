// Minimal static file server for local development and the end-to-end tests. No dependencies.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('../src', import.meta.url)))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0])
  const candidate = normalize(join(ROOT, decoded.endsWith('/') ? `${decoded}index.html` : decoded))
  // Stay inside the served directory
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null
  try {
    return (await stat(candidate)).isFile() ? candidate : null
  } catch {
    return null
  }
}

export function startServer({ port = 4173, host = '127.0.0.1' } = {}) {
  const server = createServer(async (request, response) => {
    const file = await resolveFile(request.url ?? '/')
    if (!file) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }
    response.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      // Files change constantly in development
      'cache-control': 'no-store',
    })
    response.end(await readFile(file))
  })
  return new Promise((resolveStart) => {
    server.listen(port, host, () => resolveStart({ server, port: server.address().port, host }))
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { host, port } = await startServer({ port: Number(process.env.PORT) || 4173 })
  console.log(`Serving src/ at http://${host}:${port}/`)
}
