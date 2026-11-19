// Warns (never fails) when the Archive partition map is stale: npm run check:map
// Failing on a calendar date would break unrelated pushes, so staleness is an annotation, not an error.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { mapAge, STALE_AFTER_DAYS } from '../src/js/data/ia/map-age.js'

const MAP_FILE = fileURLToPath(new URL('../src/data/ia-map.json', import.meta.url))

export async function checkMapAge({ now = Date.now(), file = MAP_FILE } = {}) {
  const { builtAt } = JSON.parse(await readFile(file, 'utf8'))
  const age = mapAge(builtAt, now)
  const summary = `Archive map built ${builtAt} (${age.days ?? '?'} days ago)`
  if (!age.stale) return { stale: false, lines: [`${summary}: fresh (stale after ${STALE_AFTER_DAYS} days).`] }
  return {
    stale: true,
    lines: [
      // GitHub Actions turns this line into a visible annotation on the run
      `::warning file=src/data/ia-map.json,title=Archive map is stale::${summary}. Uploads since then are not drawn. Run: npm run build:map (about 20 minutes), then commit src/data/ia-map.json.`,
    ],
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // --now=<ISO date> lets tests and a dry run pretend it is later
  const stated = process.argv.find((arg) => arg.startsWith('--now='))?.slice(6)
  const { lines } = await checkMapAge({ now: stated ? Date.parse(stated) : Date.now() })
  for (const line of lines) console.log(line)
}
