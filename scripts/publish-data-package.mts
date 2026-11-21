import { resolve } from 'node:path'
import { advanceDataChannel, publishPreparedData } from '../src/shared/dataPackageDistribution.ts'

const args = process.argv.slice(2)
function option(name: string, fallback?: string): string | undefined {
  const index = args.indexOf(name)
  if (index < 0) return fallback
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${name} needs a value`)
  return args[index + 1]
}
async function main() {
  if (args.includes('--help')) {
    console.log(
      'Stage a validated package: --prepared <build output> --store <data feed directory> --expect-package <package ID> [--channel preview|production]',
    )
    console.log(
      'Rollback: --rollback <package ID> --store <feed> --channel <channel>. Production also requires --confirm-production <same package ID>.',
    )
    return
  }
  const store = resolve(option('--store', '.tmp/data-feed')!)
  const channel = option('--channel', 'preview')!
  const confirmProduction = option('--confirm-production')
  const prepared = option('--prepared')
  const rollback = option('--rollback')
  if (!!prepared === !!rollback)
    throw new Error('Choose one prepared build or an existing rollback version.')
  const result = rollback
    ? await advanceDataChannel({ store, channel, packageId: rollback, confirmProduction })
    : await publishPreparedData({
        preparedRoot: resolve(prepared!),
        store,
        channel,
        expectedPackageId: option('--expect-package') ?? '',
        confirmProduction,
      })
  console.log(JSON.stringify({ store, ...result }, null, 2))
}
main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
