import type { DesktopApi } from '../../src/shared/desktop.ts'
import { gameLocales } from '../../src/shared/operator.ts'
import { localizeOperatorDataset } from '../../src/shared/gameLocalization.ts'
import { canonicalPackageJson } from '../../src/shared/dataPackageFormat.ts'
import { digestData } from '../../src/shared/dataPackageReader.ts'

/** Fingerprint actual API results, preserving every field and array order. */
export async function checkpointDataSnapshot(
  api: Pick<DesktopApi, 'getOperatorDataset' | 'getOperatorDataInfo' | 'getGarrisonEvents'>,
) {
  const dataset = await api.getOperatorDataset()
  const files: Array<{
    path: string
    sha256: string
    bytes: number
    events?: number
    stages?: number
  }> = []
  const add = async (path: string, value: unknown, counts = {}) => {
    const text = canonicalPackageJson(value)
    files.push({
      path,
      sha256: await digestData(text),
      bytes: new TextEncoder().encode(text).length,
      ...counts,
    })
  }
  await add('operators.json', dataset)
  for (const region of ['cn', 'global'] as const)
    for (const locale of gameLocales) {
      const events = await api.getGarrisonEvents(region, locale)
      await add(
        `garrison/${region}-${locale}.json`,
        { schemaVersion: 1, region, locale, events },
        {
          events: events.length,
          stages: events.reduce(
            (sum, event) =>
              sum + Object.values(event.stages).reduce((n, codes) => n + codes.length, 0),
            0,
          ),
        },
      )
    }
  const localized = Object.fromEntries(
    await Promise.all(
      gameLocales.map(async (locale) => [
        locale,
        await digestData(canonicalPackageJson(localizeOperatorDataset(dataset, locale))),
      ]),
    ),
  )
  return {
    info: await api.getOperatorDataInfo(),
    operatorCount: dataset.operators.length,
    files,
    localized,
  }
}
