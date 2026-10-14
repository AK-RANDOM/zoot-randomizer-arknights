import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import type { ImportedArknightsAccount } from '../../shared/arknightsAccount'
import { importAccountSyncData } from './accountSnapshotService'
import { AccountSnapshotStore } from './snapshotStore'

const temporaryDirectories: string[] = []

async function createStore(): Promise<{ store: AccountSnapshotStore; path: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'zoot-account-test-'))
  temporaryDirectories.push(directory)
  const path = join(directory, 'account.json')
  return { store: new AccountSnapshotStore(path), path }
}

function sampleSnapshot(): ImportedArknightsAccount {
  return {
    schemaVersion: 1,
    server: 'en',
    operators: [
      {
        operatorId: 'char_103_angel',
        level: 90,
        elite: 2,
        equippedSkinId: 'char_103_angel@skin#1',
      },
    ],
    ownedSkinIds: ['char_103_angel@skin#1'],
    fetchedAt: '2026-10-15T12:00:00.000Z',
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  )
})

describe('Arknights account snapshot store', () => {
  it('round-trips a sanitized snapshot', async () => {
    const { store } = await createStore()
    const snapshot = sampleSnapshot()

    await store.save(snapshot)
    await expect(store.load()).resolves.toEqual(snapshot)
  })

  it('strips undeclared credential-like fields instead of persisting them', async () => {
    const { store, path } = await createStore()
    const unsafe = {
      ...sampleSnapshot(),
      token: 'must-not-persist',
      operators: [
        {
          ...sampleSnapshot().operators[0],
          authSecret: 'must-not-persist-either',
        },
      ],
    } as unknown as ImportedArknightsAccount

    await store.save(unsafe)
    const file = await readFile(path, 'utf8')

    expect(file).not.toContain('must-not-persist')
    expect(JSON.parse(file)).toEqual(sampleSnapshot())
  })

  it('returns null for missing or malformed local snapshots', async () => {
    const { store, path } = await createStore()
    await expect(store.load()).resolves.toBeNull()

    const { writeFile } = await import('node:fs/promises')
    await writeFile(path, '{bad json', 'utf8')
    await expect(store.load()).resolves.toBeNull()
  })

  it('preserves the previous valid snapshot when a refresh payload fails parsing', async () => {
    const { store } = await createStore()
    const existing = sampleSnapshot()
    await store.save(existing)

    await expect(importAccountSyncData(store, { user: {} }, 'en')).rejects.toThrow(
      'user.troop.chars',
    )
    await expect(store.load()).resolves.toEqual(existing)
  })

  it('can explicitly clear imported account data', async () => {
    const { store } = await createStore()
    await store.save(sampleSnapshot())
    await store.clear()
    await expect(store.load()).resolves.toBeNull()
  })
})
