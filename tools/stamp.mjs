// Deploy-time cache busting. GitHub Pages sends max-age=600 for every file and cannot be configured, so after a
// deploy a browser can hold an old module and a new one at once and run a mixed graph. This copies src/ to dist/
// and gives every asset a URL that changes only when its content does. Development still serves src/ untouched.
import { createHash } from 'node:crypto'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HASH_LENGTH = 10
const MAP_FILE = 'data/ia-map.json'

const toPosix = (path) => path.split(sep).join('/')

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => (entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)])),
  )
  return nested.flat()
}

async function hashOf(file) {
  return createHash('sha1')
    .update(await readFile(file))
    .digest('hex')
    .slice(0, HASH_LENGTH)
}

// Each replacement must land exactly where expected, so a reshaped index.html fails the build loudly
function replaceOnce(html, pattern, replacement, what) {
  if (!pattern.test(html)) throw new Error(`stamp: could not find ${what} in index.html`)
  return html.replace(pattern, replacement)
}

export async function build({ src, out }) {
  const source = resolve(src)
  const target = resolve(out)
  await rm(target, { recursive: true, force: true })
  await mkdir(dirname(target), { recursive: true })
  await cp(source, target, { recursive: true })

  const files = (await listFiles(target)).map((file) => toPosix(relative(target, file)))
  const hashes = new Map()
  for (const file of files) hashes.set(file, await hashOf(join(target, file)))
  const versioned = (file) => `./${file}?v=${hashes.get(file)}`

  // Every module except the entry (which the page loads by URL) is mapped, so import() and import statements agree
  const imports = {}
  for (const file of files.filter((f) => f.endsWith('.js') && f !== 'js/main.js'))
    imports[`./${file}`] = versioned(file)
  const importMap = `<script type="importmap">${JSON.stringify({ imports })}</script>`

  let html = await readFile(join(target, 'index.html'), 'utf8')
  html = replaceOnce(html, /<head>/, `<head>\n    ${importMap}`, '<head>')
  html = replaceOnce(html, /src="\.\/js\/main\.js"/, `src="${versioned('js/main.js')}"`, 'the main.js script')
  for (const css of files.filter((f) => f.startsWith('css/') && f.endsWith('.css'))) {
    html = replaceOnce(html, new RegExp(`href="\\./${css}"`), `href="${versioned(css)}"`, css)
  }
  // The Archive map is fetched, not imported, so the page tells main.js which version to ask for
  html = replaceOnce(
    html,
    /<meta name="ia-map-version" content="dev" \/>/,
    `<meta name="ia-map-version" content="${hashes.get(MAP_FILE)}" />`,
    'the map-version meta',
  )
  await writeFile(join(target, 'index.html'), html)
  return { files: files.length, modules: Object.keys(imports).length, mapVersion: hashes.get(MAP_FILE) }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const result = await build({ src: join(root, 'src'), out: join(root, 'dist') })
  console.log(`dist/: ${result.files} files, ${result.modules} versioned modules, map ${result.mapVersion}`)
}
