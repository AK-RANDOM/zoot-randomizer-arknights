import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./GlobalPoolFeature.tsx', import.meta.url), 'utf8')

describe('Public Global Pool', () => {
  it('omits the manual data update controls', () => {
    expect(source).not.toContain('Check data updates')
    expect(source).not.toContain('onInstallUpdate')
    expect(source).not.toContain('className="update-box"')
  })
})
