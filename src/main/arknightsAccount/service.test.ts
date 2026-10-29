import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ArknightsAccountProtocol } from './protocol'
import { ArknightsAccountService } from './service'
import { AccountSnapshotStore } from './snapshotStore'

const temporaryDirectories: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  )
})

async function createService(): Promise<{
  service: ArknightsAccountService
  protocol: ArknightsAccountProtocol
}> {
  const directory = await mkdtemp(join(tmpdir(), 'zoot-account-service-test-'))
  temporaryDirectories.push(directory)
  const protocol = new ArknightsAccountProtocol()
  return {
    service: new ArknightsAccountService(
      new AccountSnapshotStore(join(directory, 'account.json')),
      protocol,
    ),
    protocol,
  }
}

describe('Arknights account service', () => {
  it('validates email before requesting a code', async () => {
    const { service, protocol } = await createService()
    const request = vi.spyOn(protocol, 'requestLoginCode').mockResolvedValue()

    await expect(service.requestLoginCode('en', 'bad-address')).rejects.toThrow(
      'Invalid YoStar account email.',
    )
    expect(request).not.toHaveBeenCalled()
  })

  it('validates verification code before authentication', async () => {
    const { service, protocol } = await createService()
    const sync = vi.spyOn(protocol, 'fetchSyncDataWithEmailCode')

    await expect(service.syncWithEmailCode('en', 'doctor@example.com', '12x456')).rejects.toThrow(
      'Invalid YoStar verification code.',
    )
    expect(sync).not.toHaveBeenCalled()
  })

  it('persists only the parsed sanitized sync result', async () => {
    const { service, protocol } = await createService()
    vi.spyOn(protocol, 'fetchSyncDataWithEmailCode').mockResolvedValue({
      user: {
        troop: {
          chars: {
            '1': {
              charId: 'char_2025_shu',
              level: 90,
              evolvePhase: 2,
              skin: 'char_2025_shu@skin#1',
            },
          },
        },
        skin: {
          characterSkins: {
            'char_2025_shu@skin#1': { obtainedAt: 123 },
          },
        },
      },
      secret: 'should-never-be-persisted',
    })

    const result = await service.syncWithEmailCode('en', 'doctor@example.com', '123456')

    expect(result.snapshot.operators).toEqual([
      {
        operatorId: 'char_2025_shu',
        level: 90,
        elite: 2,
        equippedSkinId: 'char_2025_shu@skin#1',
      },
    ])
    expect(await service.getSnapshot()).toEqual(result.snapshot)
    expect(JSON.stringify(await service.getSnapshot())).not.toContain('should-never-be-persisted')
  })
})
