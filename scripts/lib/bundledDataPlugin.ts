import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import type { Plugin } from 'vite'
import type { DataBuildInfo } from './dataPackageBundling.ts'
import { DATA_PACKAGE_PIN } from '../../src/shared/dataPackagePin.ts'

/** Both website locations inherit this source-owned build hook. */
export function bundledDataPlugin(output: string): Plugin {
  const bundled = resolve('resources/bundled-data')
  return {
    name: 'pinned-operator-data',
    configureServer(server) {
      server.middlewares.use('/operator-data', (request, response, next) => {
        const requested = (request.url ?? '').split('?')[0]
        const paths: Record<string, string> = {
          '/data-package.json': 'data-package.json',
          '/data-package-build.json': 'data-package-build.json',
          '/operators.json': 'operators/operators.json',
        }
        const path = paths[requested]
        if (!path) return next()
        try {
          response.setHeader('Content-Type', 'application/json')
          response.end(readFileSync(resolve(bundled, path)))
        } catch {
          response.statusCode = 503
          response.end('Prepare the pinned data package before starting the preview.')
        }
      })
    },
    writeBundle() {
      const info = JSON.parse(
        readFileSync(resolve(bundled, 'data-package-build.json'), 'utf8'),
      ) as DataBuildInfo
      const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
      if (
        info.applicationCommit !== revision ||
        info.packageId !== DATA_PACKAGE_PIN.packageId ||
        info.artifactSha256 !== DATA_PACKAGE_PIN.artifactSha256
      )
        throw new Error(
          'Bundled data provenance differs from this build. Prepare the pinned data again.',
        )
      const destination = resolve(output, 'operator-data')
      mkdirSync(destination, { recursive: true })
      for (const file of ['data-package.json', 'data-package-build.json', 'artwork-inventory.json'])
        copyFileSync(resolve(bundled, file), resolve(destination, file))
      copyFileSync(
        resolve(bundled, 'operators/operators.json'),
        resolve(destination, 'operators.json'),
      )
      writeFileSync(resolve(output, 'source-revision.txt'), `${info.applicationCommit}\n`)
      writeFileSync(resolve(output, 'data-package-revision.txt'), `${info.packageId}\n`)
      writeFileSync(resolve(output, 'artwork-revision.txt'), `${info.artworkId}\n`)
    },
  }
}
