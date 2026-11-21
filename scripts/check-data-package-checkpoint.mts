import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { build } from 'vite'
import { canonicalPackageJson, dataSha256 } from '../src/shared/dataPackageJson.ts'
import { readDataPackage } from '../src/shared/dataPackageReader.ts'
import { DATA_PACKAGE_PIN } from '../src/shared/dataPackagePin.ts'
import { checkpointDataSnapshot } from './lib/dataPackageCheckpoint.ts'
import { fixtureFeed, rehashDataPackage } from './testFixtures/dataPackage.ts'
import type { DataPackageArtifact } from '../src/shared/dataPackage.ts'

// Run after desktop/web builds. Generated candidates, profiles and reports stay under .tmp.
const project = resolve('.')
const root = resolve('.tmp/data-checkpoint')
await fs.mkdir(root, { recursive: true })
const directory = await fs.mkdtemp(join(root, 'run-'))
const bundledText = await fs.readFile('resources/bundled-data/data-package.json', 'utf8')
assert.equal(dataSha256(bundledText), DATA_PACKAGE_PIN.artifactSha256)
assert.equal(Buffer.byteLength(bundledText), DATA_PACKAGE_PIN.artifactBytes)
assert.equal(await fs.readFile('dist/web/operator-data/data-package.json', 'utf8'), bundledText)
assert.equal(
  (await fs.readFile('dist/web/data-package-revision.txt', 'utf8')).trim(),
  DATA_PACKAGE_PIN.packageId,
)
const bundled = (await readDataPackage(bundledText)).artifact
const next = structuredClone(bundled)
next.manifest.generatedAt = new Date(
  Date.parse(bundled.manifest.generatedAt) + 86400000,
).toISOString()
const roster = JSON.parse(next.files['operators.json'])
roster.generatedAt = next.manifest.generatedAt
next.files['operators.json'] = canonicalPackageJson(roster)
for (const path of Object.keys(next.files).filter((path) => path.startsWith('garrison/'))) {
  const catalog = JSON.parse(next.files[path])
  catalog.events[0].name += ' [checkpoint]'
  next.files[path] = canonicalPackageJson(catalog)
}
rehashDataPackage(next)
await readDataPackage(next)
const expected = async (artifact: DataPackageArtifact) =>
  checkpointDataSnapshot({
    getOperatorDataset: async () => JSON.parse(artifact.files['operators.json']),
    getGarrisonEvents: async (region, locale) =>
      JSON.parse(artifact.files[`garrison/${region}-${locale}.json`]).events,
    getOperatorDataInfo: async () => ({
      origin: 'bundled',
      generatedAt: artifact.manifest.generatedAt,
      operatorCount: roster.operators.length,
      sources: roster.sources,
      packageId: artifact.manifest.packageId,
    }),
  })
const feed = fixtureFeed(next)
await fs.writeFile(join(directory, 'package.json.gz'), feed.gzip)
await fs.writeFile(join(directory, 'channel.json'), canonicalPackageJson(feed.pointer))
const marker = JSON.parse(
  await fs.readFile('resources/bundled-data/data-package-build.json', 'utf8'),
)
assert.equal(marker.channel, 'preview', 'This local checkpoint requires a preview build.')
const config = {
  project,
  pin: DATA_PACKAGE_PIN,
  expected: await expected(bundled),
  next: await expected(next),
  marker,
  sourceFiles: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(),
}
await fs.writeFile(join(directory, 'config.json'), canonicalPackageJson(config))
await fs.writeFile(join(directory, 'legacy-operators.json'), next.files['operators.json'])
const entry = join(directory, 'entry.ts')
const source = project.replaceAll('\\', '/')
await fs.writeFile(
  entry,
  [
    `export { checkpointDataSnapshot } from '${source}/scripts/lib/dataPackageCheckpoint.ts'`,
    `export { browserDataPackageStorage } from '${source}/src/renderer/src/browserDataPackage.ts'`,
    `export { createGarrison, createGarrisonStage } from '${source}/src/shared/garrison.ts'`,
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
await fs.writeFile(join(directory, 'electron.cjs'), `(${checkpointMain.toString()})()`)
const require = createRequire(import.meta.url)
const executable = require('electron') as string
async function launch(platform: string, scenario: string) {
  await new Promise<void>((accept, reject) => {
    const child = spawn(
      executable,
      [join(directory, 'electron.cjs'), directory, platform, scenario],
      {
        cwd: project,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 90_000,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
      },
    )
    child.stdout.on('data', (value: Buffer) => process.stdout.write(value))
    child.stderr.on('data', (value: Buffer) => process.stderr.write(value))
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? accept() : reject(new Error(`${platform}/${scenario} exited ${code}`)),
    )
  })
  return JSON.parse(await fs.readFile(join(directory, `${platform}-${scenario}.json`), 'utf8'))
}
const browser = await launch('browser', 'flow')
const windows = await launch('windows', 'flow')
const restarted = await launch('windows', 'restart')
const target = join(
  directory,
  'windows-profile',
  'Arknights-Randomizer-Data',
  'data-packages/cache.json',
)
const saved = JSON.parse(await fs.readFile(target, 'utf8'))
saved.current.artifact.files['operators.json'] += 'corrupt'
await fs.writeFile(target, JSON.stringify(saved))
const recovered = await launch('windows', 'recovery')
const legacy = await launch('windows', 'legacy')
for (const stage of ['bundled', 'installed']) {
  assert.deepEqual(browser[stage].files, windows[stage].files)
  assert.deepEqual(browser[stage].localized, windows[stage].localized)
}
const report = {
  passed: true,
  packageId: DATA_PACKAGE_PIN.packageId,
  generatedTestPackageId: next.manifest.packageId,
  application: marker,
  browser,
  windows,
  restarted,
  recovered,
  legacy,
  allElevenPayloadsIdenticalAcrossPlatforms: true,
  allFiveLocalizedViewsIdenticalAcrossPlatforms: true,
}
await fs.writeFile(join(directory, 'report.json'), canonicalPackageJson(report))
console.log(
  `PASS: M4 end-to-end checkpoint. Both actual application interfaces match all eleven payloads and five localized views.\nEvidence: ${directory}`,
)

async function checkpointMain() {
  const { app, BrowserWindow, session } = require('electron') as typeof import('electron')
  const fs = require('node:fs/promises') as typeof import('node:fs/promises')
  const path = require('node:path') as typeof import('node:path')
  const http = require('node:http') as typeof import('node:http')
  const assert: typeof import('node:assert/strict') = require('node:assert/strict')
  const directory = process.argv[2],
    platform = process.argv[3],
    scenario = process.argv[4]
  const config = JSON.parse(await fs.readFile(path.join(directory, 'config.json'), 'utf8'))
  const pointer = JSON.parse(await fs.readFile(path.join(directory, 'channel.json'), 'utf8'))
  const profile = path.join(
    directory,
    `${platform}-${scenario === 'legacy' ? 'legacy-' : ''}profile`,
  )
  const portable = path.join(profile, 'Arknights-Randomizer-Data')
  await fs.mkdir(profile, { recursive: true })
  app.setPath('userData', profile)
  app.setPath('sessionData', path.join(profile, 'session'))
  app.commandLine.appendSwitch('disable-gpu')
  let mode = scenario === 'flow' ? 'truncated' : 'offline'
  let bundleAvailable = true
  const requests: string[] = []
  const blocked: string[] = []
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      requests.push(url.pathname)
      response.setHeader('Access-Control-Allow-Origin', '*')
      let body: Buffer
      if (url.pathname === '/feed/channels/preview.json') {
        if (mode === 'offline') {
          response.writeHead(503)
          response.end('Offline')
          return
        }
        body = Buffer.from(
          JSON.stringify({ ...pointer, minimumReaderVersion: mode === 'incompatible' ? 2 : 1 }),
        )
      } else if (url.pathname === `/feed/${pointer.artifactPath}`) {
        body = await fs.readFile(path.join(directory, 'package.json.gz'))
        if (mode === 'truncated') body = body.subarray(0, -10)
      } else if (url.pathname === '/harness.js')
        body = await fs.readFile(path.join(directory, 'harness/harness.js'))
      else {
        if (!bundleAvailable && url.pathname.endsWith('/data-package.json')) {
          response.writeHead(503)
          response.end('Offline bundle')
          return
        }
        const root = path.resolve(config.project, 'dist/web')
        const file = path.resolve(root, `.${url.pathname === '/' ? '/index.html' : url.pathname}`)
        if (!file.startsWith(root + path.sep)) throw Error('Invalid test path')
        body = await fs.readFile(file)
      }
      response.setHeader(
        'Content-Type',
        url.pathname.endsWith('.js')
          ? 'text/javascript'
          : url.pathname.endsWith('.css')
            ? 'text/css'
            : url.pathname === '/' || url.pathname.endsWith('.html')
              ? 'text/html'
              : url.pathname.endsWith('.json')
                ? 'application/json'
                : 'application/octet-stream',
      )
      response.end(body)
    } catch {
      response.writeHead(404)
      response.end('Missing test resource')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as import('node:net').AddressInfo
  const origin = `http://127.0.0.1:${address.port}`
  if (platform === 'windows') {
    process.env.ELECTRON_SMOKE_TEST = '1'
    process.env.PORTABLE_EXECUTABLE_DIR = profile
    app.getAppPath = () => config.project
    app.quit = () => undefined
    const nativeFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      if (url.startsWith(config.pin.baseUrl))
        return nativeFetch(`${origin}/feed/${url.slice(config.pin.baseUrl.length)}`, init)
      blocked.push(url)
      throw new Error('External network blocked by checkpoint')
    }
  }
  if (scenario === 'legacy') {
    await fs.mkdir(path.join(portable, 'operator-data'), { recursive: true })
    await fs.copyFile(
      path.join(directory, 'legacy-operators.json'),
      path.join(portable, 'operator-data/operators.json'),
    )
    await fs.writeFile(path.join(portable, 'retained-account-sentinel.json'), 'unchanged')
  }
  await app.whenReady()
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.startsWith(config.pin.baseUrl)) {
      callback({ redirectURL: `${origin}/feed/${details.url.slice(config.pin.baseUrl.length)}` })
      return
    }
    const cancel = /^https?:/.test(details.url) && new URL(details.url).hostname !== '127.0.0.1'
    if (cancel) blocked.push(details.url)
    callback({ cancel })
  })
  let window: Electron.BrowserWindow
  if (platform === 'browser') {
    window = new BrowserWindow({
      show: false,
      width: 1440,
      height: 900,
      webPreferences: { contextIsolation: true, sandbox: true },
    })
    await window.loadURL(origin)
  } else {
    const loaded = new Promise<Electron.BrowserWindow>((resolve) =>
      app.once('browser-window-created', (_event, win) => {
        win.webContents.once('did-finish-load', () => resolve(win))
      }),
    )
    require(path.join(config.project, 'out/main/index.js'))
    window = await loaded
  }
  const evaluate = (script: string) => window.webContents.executeJavaScript(script, true)
  const snapshot = async () =>
    evaluate(`(async()=>{
    window.checkpoint = await import('${origin}/harness.js')
    return window.checkpoint.checkpointDataSnapshot(window.desktop)
  })()`)
  const matches = (
    actual: { info: { packageId?: string }; files: unknown; localized: unknown },
    expected: typeof config.expected,
  ) => {
    assert.equal(actual.info.packageId, expected.info.packageId)
    assert.deepEqual(actual.files, expected.files)
    assert.deepEqual(actual.localized, expected.localized)
  }
  const click = (label: string) =>
    evaluate(`(() => {
    const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)})
    if(!button || button.disabled)throw Error('Button unavailable: '+${JSON.stringify(label)})
    button.click()
  })()`)
  const waitFor = (expression: string) =>
    evaluate(`(async()=>{
    for(let n=0;n<500;n++){if(${expression})return;await new Promise(r=>setTimeout(r,20))}
    throw Error('Timed out waiting for: '+${JSON.stringify(expression)})
  })()`)
  const report: Record<string, unknown> = { platform, scenario }
  try {
    await evaluate('window.confirm=()=>true;window.alert=()=>undefined;void 0')
    const initial = await snapshot()
    if (scenario === 'restart' || scenario === 'recovery') {
      matches(initial, scenario === 'restart' ? config.next : config.expected)
      report.snapshot = initial
      report.offline = await evaluate('window.desktop.checkOperatorUpdates()')
    } else {
      if (scenario === 'flow') matches(initial, config.expected)
      else {
        assert.equal(initial.info.packageId, undefined)
        assert.match(initial.info.warning, /previously downloaded/)
        report.legacyBridge = initial.info
      }
      report.bundled = initial
      await waitFor(
        `document.querySelector('.data-summary')?.textContent.includes('440 operators')`,
      )
      if (scenario === 'flow') {
        await waitFor(
          `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Randomize'&&!b.disabled)`,
        )
        await click('Randomize')
        await waitFor(`document.querySelectorAll('.operator-card').length>=12`)
        await click('Draft')
        await waitFor(
          `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Start Draft'&&!b.disabled)`,
        )
        await click('Start Draft')
        await waitFor(
          `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Finalize')&&document.querySelectorAll('.operator-card').length>=3`,
        )
        await evaluate(`(async()=>{
          const g=window.checkpoint.createGarrison('Checkpoint saved Garrison','checkpoint-saved')
          const stage=window.checkpoint.createGarrisonStage('Saved stage','checkpoint-stage')
          stage.operatorIds=[(await window.desktop.getOperatorDataset()).operators.find(op=>op.availableOn.global).id]
          g.stages=[stage]
          const key='arknights-randomizer:renderer-state:v1',state=JSON.parse(localStorage.getItem(key))
          state.garrisons=[g];localStorage.setItem(key,JSON.stringify(state))
        })()`)
        await click('Garrison')
        await waitFor(`document.body.textContent.includes('Checkpoint saved Garrison')`)
        await evaluate(`(()=>{
          const select=[...document.querySelectorAll('label')].find(label=>label.textContent.includes('Saved Garrison')).querySelector('select')
          select.value='checkpoint-saved';select.dispatchEvent(new Event('change',{bubbles:true}))
        })()`)
        await waitFor(
          `[...document.querySelectorAll('input')].some(input=>input.value==='Saved stage')`,
        )
        report.standardDraftAndSavedGarrison = true
      }
      await click('Options')
      await waitFor(
        `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Check data updates'&&!b.disabled)`,
      )
      if (scenario === 'flow') {
        await evaluate(`(async()=>{
          const field=name=>[...document.querySelectorAll('label')].find(label=>label.querySelector('span')?.textContent.trim()===name)?.querySelector('select')
          const set=(name,value)=>{const select=field(name);if(!select)throw Error('Missing field '+name);select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}))}
          for(const region of ['cn','global']) {set('Metadata region',region);await new Promise(r=>setTimeout(r,40))}
          for(const locale of ['jp','kr','tw','cn','en']) {set('App Localization',locale);await new Promise(r=>setTimeout(r,40))}
          set('Theme','zoot');await new Promise(r=>setTimeout(r,40))
          if(document.documentElement.dataset.theme!=='zoot')throw Error('Theme preference did not apply')
        })()`)
        report.regionsLocalesAndTheme = true
      }
      const preferences = await evaluate(`(() => {
        localStorage.setItem('checkpoint-preference-sentinel','retained')
        return localStorage.getItem('arknights-randomizer:renderer-state:v1')
      })()`)
      if (scenario === 'flow') {
        await click('Check data updates')
        await waitFor(
          `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Update data'&&!b.disabled)`,
        )
        await click('Update data')
        await waitFor(`document.body.textContent.includes('checksum/size mismatch')`)
        matches(await snapshot(), config.expected)
        report.truncatedDownloadRetainedData = true
      } else {
        mode = 'valid'
        await click('Check data updates')
        await waitFor(
          `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Update data'&&!b.disabled)`,
        )
      }
      mode = 'valid'
      if (scenario === 'flow') {
        if (platform === 'windows')
          await fs.writeFile(path.join(portable, 'data-packages'), 'blocked storage')
        else
          await evaluate(`window.originalTransaction = IDBDatabase.prototype.transaction;
          IDBDatabase.prototype.transaction = function(...args){if(args[1]==='readwrite')throw new DOMException('Checkpoint quota failure','QuotaExceededError');return window.originalTransaction.apply(this,args)};void 0`)
        await click('Update data')
        await waitFor(
          `document.body.textContent.includes(${JSON.stringify(platform === 'windows' ? 'EEXIST' : 'Checkpoint quota failure')})`,
        )
        matches(await snapshot(), config.expected)
        if (platform === 'windows') await fs.unlink(path.join(portable, 'data-packages'))
        else await evaluate('IDBDatabase.prototype.transaction=window.originalTransaction;void 0')
        report.storageFailureRetainedData = true
      }
      await waitFor(
        `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Update data'&&!b.disabled)`,
      )
      await click('Update data')
      await waitFor(`document.body.textContent.includes('Operator and event data updated.')`)
      const installed = await snapshot()
      matches(installed, config.next)
      report.installed = installed
      assert.equal(
        await evaluate("localStorage.getItem('checkpoint-preference-sentinel')"),
        'retained',
      )
      assert.equal(
        await evaluate("localStorage.getItem('arknights-randomizer:renderer-state:v1')"),
        preferences,
      )
      mode = 'incompatible'
      const beforeRequests = requests.length
      const incompatible = await evaluate(`(async()=>{
        const check=await window.desktop.checkOperatorUpdates();let error=''
        try{await window.desktop.updateOperatorData()}catch(reason){error=reason.message}
        return {check,error}
      })()`)
      assert.match(incompatible.check.message, /newer version of the app/)
      assert.match(incompatible.error, /newer version of the app/)
      assert.equal(requests.slice(beforeRequests).filter((url) => url.endsWith('.gz')).length, 0)
      matches(await snapshot(), config.next)
      report.incompatibleRetainedData = true
      if (platform === 'browser') {
        mode = 'offline'
        bundleAvailable = false
        await window.loadURL(origin)
        matches(await snapshot(), config.next)
        report.offlineMetadataReload = true
        await evaluate(`(async()=>{
          const storage=window.checkpoint.browserDataPackageStorage()
          const saved=JSON.parse(await storage.load())
          saved.current.artifact.files['operators.json']+='corrupt'
          await storage.save(JSON.stringify(saved))
        })()`)
        await window.loadURL(origin)
        matches(await snapshot(), config.expected)
        report.previousPackageRecovery = true
      }
      if (scenario === 'legacy') {
        assert.equal(
          await fs.readFile(path.join(portable, 'operator-data/operators.json'), 'utf8'),
          await fs.readFile(path.join(directory, 'legacy-operators.json'), 'utf8'),
        )
        assert.equal(
          await fs.readFile(path.join(portable, 'retained-account-sentinel.json'), 'utf8'),
          'unchanged',
        )
        report.legacyFilesRetained = true
      }
    }
    assert.ok(blocked.every((url) => !/gamedata\/excel|prts\.wiki|api\.github\.com/.test(url)))
    report.requests = requests
    report.blockedArtworkRequests = blocked.length
    await fs.writeFile(
      path.join(directory, `${platform}-${scenario}.json`),
      JSON.stringify(report, null, 2),
    )
    console.log(`PASS: ${platform}/${scenario}`)
  } catch (error) {
    await fs.writeFile(
      path.join(directory, `${platform}-${scenario}-failure.json`),
      JSON.stringify(
        {
          error: String(error),
          report,
          body: await evaluate('document.body.innerText').catch(() => null),
        },
        null,
        2,
      ),
    )
    console.error(error)
    process.exitCode = 1
  } finally {
    window.destroy()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    app.exit(Number(process.exitCode ?? 0))
  }
}
