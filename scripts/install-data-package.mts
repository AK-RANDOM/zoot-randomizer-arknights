import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { bundleSelectedData } from './lib/dataPackageBundling.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
function option(name: string): string | undefined {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${name} needs a value`)
  return args[index + 1]
}
async function main() {
  const info = await bundleSelectedData(root, {
    store: option('--store') ?? process.env['AKR_DATA_STORE'],
    producerSnapshotPath: option('--producer-snapshot'),
  })
  if (!args.includes('--skip-ui-assets')) {
    const result = spawnSync(
      process.execPath,
      [
        '--experimental-transform-types',
        join(root, 'scripts/update-operator-data.mts'),
        '--ui-assets-only',
      ],
      { cwd: root, stdio: 'inherit', windowsHide: true },
    )
    if (result.status !== 0)
      throw new Error('UI asset preparation failed; the build must not be published.')
  }
  console.log(JSON.stringify(info, null, 2))
}
main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
