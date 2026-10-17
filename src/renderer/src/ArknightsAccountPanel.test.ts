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
    expect(source).not.toContain('u8Token')
    expect(source).not.toContain('sessionSecret')
    expect(source).not.toContain('yostarToken')
  })

  it('shows required account identity, last-sync, and reconciliation summaries', () => {
    expect(source).toContain('snapshot.accountName')
    expect(source).toContain('snapshot.uid')
    expect(source).toContain('Last synced')
    expect(source).toContain('reconcileArknightsAccount(snapshot, dataset)')
    expect(source).toContain('title="Operators"')
    expect(source).toContain('title="Skins"')
    expect(source).toContain('Owned')
    expect(source).toContain('Recognized')
    expect(source).toContain('Unknown')
    expect(source).toContain('Show unknown native IDs')
    expect(source).toContain('Setup → Global Pool')
  })

  it('keeps the unofficial-session warning and retains the progression inspector', () => {
    expect(source).toContain('Unofficial read-only integration')
    expect(source).toContain('disconnect an active Arknights game')
    expect(source).toContain('are not saved')
    expect(source).toContain('Inspect imported operator progression')
    expect(source).toContain('progress.equippedSkinId')
    expect(source).toContain('progress.forms')
    expect(source).toContain('progress.activeFormId')
  })

  it('resolves supported account avatars through native M2 skin identity mapping', () => {
    expect(source).toContain('resolveArknightsSkinIdentity(dataset, avatar.id)')
    expect(source).toContain('getOperatorSkinAvatar(nativeSkin.operatorId, nativeSkin.skinId)')
    expect(source).toContain('getArknightsProfileAvatar(avatar.id)')
  })
})
