import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./AccountSyncTestPanel.tsx', import.meta.url), 'utf8')

describe('Arknights account M1 test surface', () => {
  it('keeps authentication inputs local while rendering sanitized sync results', () => {
    expect(source).toContain('requestArknightsLoginCode(server, email)')
    expect(source).toContain('syncArknightsAccount(server, email, code)')
    expect(source).toContain("setCode('')")
    expect(source).toContain('snapshot.operators.length')
    expect(source).toContain('snapshot.ownedSkinIds.length')
    expect(source).toContain('progress.equippedSkinId')
    expect(source).not.toContain('u8Token')
    expect(source).not.toContain('sessionSecret')
    expect(source).not.toContain('yostarToken')
  })

  it('warns that the integration is unofficial and can interrupt the active game session', () => {
    expect(source).toContain('Unofficial read-only integration')
    expect(source).toContain('disconnect an active Arknights game')
    expect(source).toContain('are not stored in')
  })
})
