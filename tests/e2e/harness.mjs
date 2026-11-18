// Drives Chrome over the DevTools protocol. No dependencies; needs a local Chrome (set CHROME_PATH to override).
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const DEFAULT_CHROME = {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: 'google-chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
}

export const chromePath = () => process.env.CHROME_PATH ?? DEFAULT_CHROME[process.platform]

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

export async function launch() {
  const profile = await mkdtemp(join(tmpdir(), 'unmarked-e2e-'))
  const port = await freePort()
  const proc = spawn(
    chromePath(),
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--autoplay-policy=no-user-gesture-required',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break
    } catch {
      // Chrome is still starting
    }
    await sleep(200)
    if (attempt === 59) throw new Error(`Chrome did not start (${chromePath()})`)
  }
  return {
    port,
    async close() {
      proc.kill()
      await sleep(300)
      await rm(profile, { recursive: true, force: true })
    },
  }
}

export async function openPage({ port }, url, { width = 1440, height = 900, mobile = false, scale = 1 } = {}) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  let nextId = 0
  const pending = new Map()
  const logs = []
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
    } else if (message.method === 'Runtime.exceptionThrown') {
      logs.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
  await send('Network.setCacheDisabled', { cacheDisabled: true })
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile })
  await send('Page.navigate', { url })
  await sleep(600)

  return {
    logs,
    send,
    async eval(expression) {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
      }
      return result.result.value
    },
    async json(expression) {
      return JSON.parse(await this.eval(`JSON.stringify(${expression})`))
    },
    async click(selector) {
      return this.eval(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return 'not found'; el.click(); return 'clicked' })()`,
      )
    },
    async key(key) {
      return this.eval(
        `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true }))`,
      )
    },
    async shot(path) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' })
      await writeFile(path, Buffer.from(data, 'base64'))
    },
    async close() {
      ws.close()
      await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {})
    },
  }
}

export function createReporter(label) {
  let passed = 0
  const failures = []
  return {
    check(name, ok, detail = '') {
      if (ok) passed += 1
      else failures.push(detail ? `${name} (${detail})` : name)
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  (${detail})` : ''}`)
    },
    summary() {
      console.log(`\n${label}: ${passed} passed, ${failures.length} failed`)
      return { passed, failures }
    },
  }
}
