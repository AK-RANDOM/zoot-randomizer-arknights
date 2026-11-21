import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { build } from 'vite'
import { canonicalPackageJson } from '../src/shared/dataPackageJson.ts'
import { DATA_PACKAGE_PIN } from '../src/shared/dataPackagePin.ts'
import type { DataPackageArtifact } from '../src/shared/dataPackage.ts'
import { fixtureFeed, rehashDataPackage } from './testFixtures/dataPackage.ts'

// Run after build:web. The hidden Chromium instance uses an isolated profile and localhost only.
const project = resolve('.')
const root = resolve('.tmp/browser-data-smoke')
await mkdir(root, { recursive: true })
const directory = await mkdtemp(join(root, 'run-'))
const bundled = JSON.parse(
  await readFile('resources/bundled-data/data-package.json', 'utf8'),
) as DataPackageArtifact
const next = structuredClone(bundled)
const operators = JSON.parse(next.files['operators.json'])
next.manifest.generatedAt = new Date(Date.parse(next.manifest.generatedAt) + 86400000).toISOString()
operators.generatedAt = next.manifest.generatedAt
next.files['operators.json'] = canonicalPackageJson(operators)
for (const path of Object.keys(next.files).filter((path) => path.startsWith('garrison/'))) {
  const catalog = JSON.parse(next.files[path])
  catalog.events[0].name += ' [smoke update]'
  next.files[path] = canonicalPackageJson(catalog)
}
rehashDataPackage(next)
const feed = fixtureFeed(next)
await writeFile(join(directory, 'package.json.gz'), feed.gzip)
await writeFile(join(directory, 'channel.json'), canonicalPackageJson(feed.pointer))
await writeFile(
  join(directory, 'config.json'),
  JSON.stringify({ project, pin: DATA_PACKAGE_PIN, nextId: next.manifest.packageId }),
)
const entry = join(directory, 'entry.ts')
const source = project.replaceAll('\\', '/')
await writeFile(
  entry,
  [
    `export { DataPackageClient } from '${source}/src/shared/dataPackageClient.ts'`,
    `export { browserDataPackageStorage } from '${source}/src/renderer/src/browserDataPackage.ts'`,
  ].join('\n'),
)
await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    outDir: join(directory, 'harness'),
    lib: { entry, formats: ['es'], fileName: () => 'harness.js' },
  },
})
await writeFile(join(directory, 'electron.cjs'), `(${browserSmokeMain.toString()})()`)
const require = createRequire(import.meta.url)
const executable = require('electron') as string
await new Promise<void>((accept, reject) => {
  const child = spawn(executable, [join(directory, 'electron.cjs'), directory], {
    cwd: project,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 90_000,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  })
  child.stdout.on('data', (value: Buffer) => process.stdout.write(value))
  child.stderr.on('data', (value: Buffer) => process.stderr.write(value))
  child.on('error', reject)
  child.on('exit', (code) =>
    code === 0 ? accept() : reject(new Error(`Browser smoke test exited ${code}`)),
  )
})
console.log(`Browser data smoke evidence: ${directory}`)

async function browserSmokeMain() {
  const { app, BrowserWindow, session } = require('electron') as typeof import('electron')
  const fs = require('node:fs/promises') as typeof import('node:fs/promises')
  const path = require('node:path') as typeof import('node:path')
  const http = require('node:http') as typeof import('node:http')
  const assert: typeof import('node:assert/strict') = require('node:assert/strict')
  const directory = process.argv[2]
  const config = JSON.parse(await fs.readFile(path.join(directory, 'config.json'), 'utf8'))
  const pointer = JSON.parse(await fs.readFile(path.join(directory, 'channel.json'), 'utf8'))
  app.setPath('userData', path.join(directory, 'browser-profile'))
  app.commandLine.appendSwitch('disable-gpu')
  let mode = 'truncated'
  let bundleAvailable = true
  const requests: string[] = []
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      requests.push(url.pathname)
      let body: Buffer
      if (url.pathname === '/feed/channels/preview.json')
        body = Buffer.from(JSON.stringify(pointer))
      else if (url.pathname === `/feed/${pointer.artifactPath}`) {
        body = await fs.readFile(path.join(directory, 'package.json.gz'))
        if (mode === 'truncated') body = body.subarray(0, -10)
      } else if (url.pathname === '/harness.js') {
        body = await fs.readFile(path.join(directory, 'harness/harness.js'))
      } else {
        if (!bundleAvailable && url.pathname.endsWith('/data-package.json')) {
          response.writeHead(503)
          response.end('Offline package')
          return
        }
        const root = path.resolve(config.project, 'dist/web')
        const target = path.resolve(root, `.${url.pathname === '/' ? '/index.html' : url.pathname}`)
        if (!target.startsWith(root + path.sep)) throw new Error('Unexpected file path')
        body = await fs.readFile(target)
      }
      response.setHeader(
        'Content-Type',
        url.pathname.endsWith('.js')
          ? 'text/javascript'
          : url.pathname.endsWith('.css')
            ? 'text/css'
            : url.pathname.endsWith('.html') || url.pathname === '/'
              ? 'text/html'
              : url.pathname.endsWith('.json')
                ? 'application/json'
                : 'application/octet-stream',
      )
      response.end(body)
    } catch {
      response.writeHead(404)
      response.end('Not found')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  await app.whenReady()
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({
      cancel: /^https?:/.test(details.url) && new URL(details.url).hostname !== '127.0.0.1',
    })
  })
  const window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  const address = server.address() as import('node:net').AddressInfo
  const url = `http://127.0.0.1:${address.port}/`
  const evaluate = (script: string) => window.webContents.executeJavaScript(script, true)
  const report: Record<string, unknown> = {}
  try {
    await window.loadURL(url)
    const first = await evaluate(`(async () => {
      const info = await window.desktop.getOperatorDataInfo()
      const catalogs = []
      for (const region of ['cn','global']) for (const locale of ['en','jp','kr','tw','cn'])
        catalogs.push({region,locale,count:(await window.desktop.getGarrisonEvents(region,locale)).length})
      localStorage.setItem('m4-user-preferences-sentinel', 'unchanged')
      return {info,catalogs}
    })()`)
    assert.equal(first.info.packageId, config.pin.packageId)
    assert.equal(first.info.operatorCount, 440)
    assert.equal(first.catalogs.length, 10)
    assert.ok(first.catalogs.every((catalog: { count: number }) => catalog.count > 0))
    report.bundled = first
    const failed = await evaluate(`(async () => {
      window.smoke = await import('/harness.js')
      window.smokeStorage = window.smoke.browserDataPackageStorage()
      const body = await (await fetch('/operator-data/data-package.json')).text()
      window.smokeOptions = { loadBundled: async () => body, storage: window.smokeStorage, baseUrl: new URL('/feed/',location.href).href, channel:'preview' }
      window.smokeClient = new window.smoke.DataPackageClient(window.smokeOptions)
      const before = await window.smokeClient.getInfo()
      let error = ''
      try { await window.smokeClient.installUpdate() } catch(reason) { error = reason.message }
      return {before, after: await window.smokeClient.getInfo(), error}
    })()`)
    assert.equal(failed.after.packageId, config.pin.packageId)
    assert.match(failed.error, /checksum\/size mismatch/)
    report.failedDownloadRetainedOld = true
    mode = 'valid'
    const installed = await evaluate(`(async () => {
      const check = await window.smokeClient.checkUpdates()
      await window.smokeClient.installUpdate()
      const info = await window.smokeClient.getInfo()
      const name = (await window.smokeClient.getCatalog('global','en'))[0].name
      const offline = new window.smoke.DataPackageClient({...window.smokeOptions, loadBundled: async () => {throw Error('Offline')}})
      const recovered = await offline.getInfo()
      const saved = JSON.parse(await window.smokeStorage.load())
      const previous = saved.previous.artifact.manifest.packageId
      saved.current.artifact.files['operators.json'] += 'corrupt'
      await window.smokeStorage.save(JSON.stringify(saved))
      const rollback = new window.smoke.DataPackageClient(window.smokeOptions)
      return {check, info, name, recovered, previous, rollback:await rollback.getInfo(), preferences:localStorage.getItem('m4-user-preferences-sentinel')}
    })()`)
    assert.equal(installed.check.updateAvailable, true)
    assert.equal(installed.info.packageId, config.nextId)
    assert.match(installed.name, /smoke update/)
    assert.equal(installed.recovered.packageId, config.nextId)
    assert.equal(installed.previous, config.pin.packageId)
    assert.equal(installed.rollback.packageId, config.pin.packageId)
    assert.equal(installed.preferences, 'unchanged')
    report.atomicUpdateAndStorage = installed
    bundleAvailable = false
    await window.loadURL(url)
    const restored = await evaluate('window.desktop.getOperatorDataInfo()')
    assert.equal(restored.packageId, config.pin.packageId)
    report.reloadWithoutBundledResponse = restored
    assert.ok(
      requests.every(
        (request) => !request.includes('gamedata/excel') && !request.includes('avatar/'),
      ),
    )
    report.requests = requests
    await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2))
    console.log(
      'PASS: real Chromium bundle, ten catalogs, gzip validation, failed download, IndexedDB activation/previous recovery, offline metadata reload and preference retention.',
    )
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  } finally {
    window.destroy()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    app.exit(Number(process.exitCode ?? 0))
  }
}
