import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./ArknightsAccountPanel.tsx', import.meta.url), 'utf8')
const styleSource = readFileSync(new URL('./ArknightsAccountPanel.css', import.meta.url), 'utf8')

describe('Arknights account management panel', () => {
  it('keeps ephemeral authentication inputs local and supports sync, refresh, and unlinking', () => {
    expect(source).toContain('requestArknightsLoginCode(server, email)')
    expect(source).toContain('syncArknightsAccount(server, email, code)')
    expect(source).toContain("setCode('')")
    expect(source).toContain('Refresh account')
    expect(source).toContain('clearImportedArknightsAccount()')
    expect(source).toContain("? 'Unlinking…' : 'Unlink'")
    expect(source).toContain('className="danger-button"')
    expect(source).not.toContain('u8Token')
    expect(source).not.toContain('sessionSecret')
    expect(source).not.toContain('yostarToken')
  })

  it('shows the compact account identity and direct owned counts', () => {
    expect(source).toContain('snapshot.accountName')
    expect(source).toContain('snapshot.uid')
    expect(source).toContain('Last Sync:')
    expect(source).toContain('Operator Owned')
    expect(source).toContain('Outfit Owned')
    expect(source).toContain('snapshot.operators.length')
    expect(source).toContain('snapshot.ownedSkinIds.length')
    expect(source).not.toContain('reconcileArknightsAccount(snapshot, dataset)')
  })

  it('uses a de-emphasized server label and normal-sized account action buttons', () => {
    expect(source).toContain('className="arknights-account__server"')
    expect(source).not.toContain('arknights-account__compact-action')
    expect(styleSource).toContain('.arknights-account__server')
    expect(styleSource).not.toContain('.arknights-account__compact-action')
  })

  it('keeps the unofficial-session warning wide on desktop while allowing responsive wrapping', () => {
    expect(source).toContain('Unofficial read-only integration')
    expect(source).toContain('disconnect an active Arknights game')
    expect(source).toContain('are not saved')
    expect(styleSource).toContain('max-width: none')
    expect(styleSource).toContain('white-space: nowrap')
    expect(styleSource).toContain('@media (max-width: 1100px)')
  })

  it('resolves account avatars through the current default-art/skin identity model', () => {
    expect(source).toContain('resolveArknightsSkinIdentity(dataset, avatar.id)')
    expect(source).toContain('operator?.defaultArts?.find')
    expect(source).toContain('getOperatorAvatarAsset(defaultArt.avatarId)')
    expect(source).toContain('getArknightsProfileAvatar(avatar.id)')
  })
})
