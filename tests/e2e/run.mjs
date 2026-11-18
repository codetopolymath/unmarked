// Runs every end-to-end suite against a local server, each in a fresh browser profile.
import { startServer } from '../../tools/serve.mjs'
import { launch } from './harness.mjs'
import * as interaction from './interaction.mjs'
import * as motion from './motion.mjs'

const SUITES = [
  ['interaction', interaction],
  ['motion', motion],
]

const { server, host, port } = await startServer({ port: 0 })
const baseUrl = `http://${host}:${port}`
let failed = 0

try {
  for (const [name, suite] of SUITES) {
    console.log(`\n=== ${name} ===`)
    const browser = await launch()
    try {
      const { failures } = await suite.run(browser, baseUrl)
      failed += failures.length
    } finally {
      await browser.close()
    }
  }
} finally {
  server.close()
}

console.log(failed ? `\n${failed} end-to-end check(s) failed` : '\nAll end-to-end checks passed')
process.exit(failed ? 1 : 0)
