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

  it('does not render a bottom data update status area', () => {
    expect(source.match(/onInstallUpdate\(\)/g)).toHaveLength(1)
    expect(source).not.toContain('className="update-box"')
    expect(source).not.toContain('New operator data is available.')
  })
})
