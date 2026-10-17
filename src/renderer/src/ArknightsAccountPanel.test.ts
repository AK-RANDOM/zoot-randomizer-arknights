import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./ArknightsAccountPanel.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./ArknightsAccountPanel.css', import.meta.url), 'utf8')
const optionsSource = readFileSync(new URL('./OptionsPanel.tsx', import.meta.url), 'utf8')

describe('Arknights account management panel', () => {
  it('keeps ephemeral authentication inputs local and supports sync, refresh, and unlinking', () => {
    expect(source).toContain('requestArknightsLoginCode(server, email)')
    expect(source).toContain('syncArknightsAccount(server, email, code)')
    expect(source).toContain("setCode('')")
    expect(source).toContain('setRefreshOpen(true)')
    expect(source).toContain('Refresh imported account')
    expect(source).toContain('clearImportedArknightsAccount()')
    expect(source).toContain("'Unlink'")
    expect(source).toContain('className="danger-button arknights-account__compact-action"')
    expect(source).not.toContain('u8Token')
    expect(source).not.toContain('sessionSecret')
    expect(source).not.toContain('yostarToken')
  })

  it('renders the compact account and ownership summaries in the requested format', () => {
    expect(source).toContain('{SERVER_LABELS[snapshot.server]} Service')
    expect(source).toContain("(UID: {snapshot.uid ?? '—'})")
    expect(source).toContain('Last Sync:')
    expect(source).toContain('Operator Owned')
    expect(source).toContain('snapshot.operators.length')
    expect(source).toContain('Outfit Owned')
    expect(source).toContain('snapshot.ownedSkinIds.length')
    expect(source).not.toContain('Recognized')
    expect(source).not.toContain('Unknown')
    expect(source).not.toContain('reconcileArknightsAccount')
  })

  it('removes redundant Account framing while keeping the login warning in the sync menu', () => {
    expect(source).not.toContain('ARKNIGHTS ACCOUNT')
    expect(source).not.toContain('arknights-account__eyebrow')
    expect(css).not.toContain('border: 1px solid #45413a')
    expect(source).toContain('Unofficial read-only integration')
    expect(source).toContain('disconnect an active Arknights game')
    expect(source).toContain('are not saved')
  })

  it('removes the redundant Options page heading', () => {
    expect(optionsSource).not.toContain('<p className="eyebrow">OPTIONS</p>')
    expect(optionsSource).not.toContain('App preferences')
    expect(optionsSource).toContain('aria-label="Options"')
  })

  it('resolves account avatars through the current default-art/skin identity model', () => {
    expect(source).toContain('resolveArknightsSkinIdentity(dataset, avatar.id)')
    expect(source).toContain('operator?.defaultArts?.find')
    expect(source).toContain('getOperatorAvatarAsset(defaultArt.avatarId)')
    expect(source).toContain('getArknightsProfileAvatar(avatar.id)')
  })
})
