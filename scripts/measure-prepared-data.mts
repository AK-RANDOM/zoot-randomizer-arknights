import * as fs from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { resolve } from 'node:path'
import { createDataPackageRepository } from '../src/main/dataPackageRepository.ts'
import { fetchDataChannel, fetchDataPackage } from '../src/shared/dataPackageReader.ts'
import { DATA_PACKAGE_PIN } from '../src/shared/dataPackagePin.ts'
import { canonicalPackageJson } from '../src/shared/dataPackageJson.ts'

const output = resolve('.tmp/m6-data-measurements.json')
const samples: number[] = []
let startupNetworkRequests = 0
for (let index = 0; index < 30; index++) {
  const client = createDataPackageRepository({
    bundledRoot: resolve('resources/bundled-data'),
    userDataRoot: resolve('.tmp/measurement-profile'),
    fetchImpl: async () => {
      startupNetworkRequests++
      throw Error('Unexpected startup network request')
    },
  })
  const start = performance.now()
  await client.getDataset()
  for (const region of ['cn', 'global'] as const)
    for (const locale of ['en', 'jp', 'kr', 'tw', 'cn'] as const)
      await client.getCatalog(region, locale)
  samples.push(performance.now() - start)
}
const sorted = [...samples].sort((a, b) => a - b)
const percentiles = Object.fromEntries(
  [1, 10, 25, 50, 75, 90, 99].map((p) => {
    const x = ((sorted.length - 1) * p) / 100,
      lo = Math.floor(x),
      hi = Math.ceil(x)
    return [`P${p}`, +(sorted[lo] + (sorted[hi] - sorted[lo]) * (x - lo)).toFixed(3)]
  }),
)
const requests: Array<{ url: string; status: number; bodyBytes: number; elapsedMs: number }> = []
const fetchImpl: typeof fetch = async (input, init) => {
  const start = performance.now(),
    response = await fetch(input, init)
  const bytes = await response.clone().arrayBuffer()
  requests.push({
    url: String(input),
    status: response.status,
    bodyBytes: bytes.byteLength,
    elapsedMs: performance.now() - start,
  })
  return response
}
const start = performance.now()
const pointer = await fetchDataChannel(DATA_PACKAGE_PIN.baseUrl, 'preview', fetchImpl)
const read = await fetchDataPackage(DATA_PACKAGE_PIN.baseUrl, pointer, fetchImpl)
const report = {
  packageId: read.artifact.manifest.packageId,
  environment: { node: process.version, platform: process.platform },
  localRead: {
    samples: samples.length,
    percentilesMs: percentiles,
    networkRequests: startupNetworkRequests,
    scope:
      'New client instances with warm filesystem cache, including complete validation and all ten catalogs. Not Electron cold-start timing.',
  },
  download: {
    requests,
    bodyBytes: requests.reduce((sum, item) => sum + item.bodyBytes, 0),
    compressedArtifactBytes: pointer.compressedBytes,
    decodedArtifactBytes: pointer.artifactBytes,
    elapsedMs: performance.now() - start,
    scope:
      'One live preview pointer and gzip retrieval plus complete validation. HTTP body bytes exclude headers and transport overhead; one observation, not a controlled speed comparison.',
  },
}
await fs.mkdir(resolve('.tmp'), { recursive: true })
await fs.writeFile(output, canonicalPackageJson(report))
console.log(canonicalPackageJson(report))
