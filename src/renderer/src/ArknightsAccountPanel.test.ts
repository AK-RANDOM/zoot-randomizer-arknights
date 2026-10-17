import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./ArknightsAccountPanel.tsx', import.meta.url), 'utf8')

describe('Arknights account management panel', () => {
  it('keeps ephemeral authentication inputs local and supports sync, refresh, and clearing', () => {
    expect(source).toContain('requestArknightsLoginCode(server, email)')
    expect(source).toContain('syncArknightsAccount(server, email, code)')
    expect(source).toContain("setCode('')")
    expect(source).toContain('Refresh account')
    expect(source).toContain('clearImportedArknightsAccount()')
    expect(source).toContain('Clear imported account data')
    expect(source).toContain('className="danger-button"')
    expect(source).not.toContain('u8Token')
    expect(source).not.toContain('sessionSecret')
    expect(source).not.toContain('yostarToken')
  })

  it('shows account identity, last-sync, and reconciliation summaries', () => {
    expect(source).toContain('snapshot.accountName')
    expect(source).toContain('snapshot.uid')
    expect(source).toContain('Last synced')
    expect(source).toContain('reconcileArknightsAccount(snapshot, dataset)')
    expect(source).toContain('title="Operators"')
    expect(source).toContain('title="Owned outfits"')
    expect(source).not.toContain('Equipped skins')
    expect(source).not.toContain('Dataset reconciliation')
  })

  it('keeps the unofficial-session warning while omitting the progression inspector', () => {
    expect(source).toContain('Unofficial read-only integration')
    expect(source).toContain('disconnect an active Arknights game')
    expect(source).toContain('are not saved')
    expect(source).not.toContain('Inspect imported operator progression')
  })

  it('resolves account avatars through the current default-art/skin identity model', () => {
    expect(source).toContain('resolveArknightsSkinIdentity(dataset, avatar.id)')
    expect(source).toContain('operator?.defaultArts?.find')
    expect(source).toContain('getOperatorAvatarAsset(defaultArt.avatarId)')
    expect(source).toContain('getArknightsProfileAvatar(avatar.id)')
  })
})
