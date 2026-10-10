import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./GlobalPoolFeature.tsx', import.meta.url), 'utf8')

describe('Global Pool data update control', () => {
  it('uses the top data update button for both checking and installing', () => {
    expect(source).toContain(
      "updateCheck?.updateAvailable ? onInstallUpdate() : onCheckUpdates()",
    )
    expect(source).toContain(
      "updateCheck?.updateAvailable ? 'Update data' : 'Check data updates'",
    )
  })

  it('does not render a second install button in the bottom update status', () => {
    expect(source.match(/onInstallUpdate\(\)/g)).toHaveLength(1)
    expect(source).toContain(
      'New operator data is available. Use Update data above to install it.',
    )
  })
})
