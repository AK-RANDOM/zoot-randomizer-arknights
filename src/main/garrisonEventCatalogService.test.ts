import { describe, expect, it, vi } from 'vitest'
const client = vi.hoisted(() => ({ getCatalog: vi.fn() }))
vi.mock('./operatorDataService', () => ({ getOperatorDataClient: () => client }))
import { getGarrisonEventCatalog } from './garrisonEventCatalogService'

describe('Garrison package catalog service', () => {
  it('reads each requested locale from the active package and observes activation without stale caching', async () => {
    client.getCatalog
      .mockResolvedValueOnce([{ id: 'old' }])
      .mockResolvedValueOnce([{ id: 'updated' }])
    expect(await getGarrisonEventCatalog('cn', 'en')).toEqual([{ id: 'old' }])
    expect(await getGarrisonEventCatalog('cn', 'en')).toEqual([{ id: 'updated' }])
    expect(client.getCatalog).toHaveBeenLastCalledWith('cn', 'en')
  })
})
