import { describe, expect, it, vi } from 'vitest'
const client = vi.hoisted(() => ({
  getDataset: vi.fn(),
  getInfo: vi.fn(),
  checkUpdates: vi.fn(),
  installUpdate: vi.fn(),
}))
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '/application', getPath: () => '/portable-user' },
}))
vi.mock('./dataPackageRepository', () => ({ createDataPackageRepository: vi.fn(() => client) }))
import {
  getOperatorDataset,
  getOperatorDataInfo,
  checkOperatorUpdates,
  updateOperatorData,
} from './operatorDataService'
import { createDataPackageRepository } from './dataPackageRepository'

describe('desktop prepared metadata boundary', () => {
  it('uses one repository for the dataset, information, update checks and activation', async () => {
    const dataset = { operators: [{ id: 'char_fixture' }] }
    client.getDataset.mockResolvedValue(dataset)
    client.getInfo.mockResolvedValue({ packageId: 'selected' })
    client.checkUpdates.mockResolvedValue({ updateAvailable: true })
    client.installUpdate.mockResolvedValue({ updated: true, dataset, warnings: [] })
    const fetchImpl = vi.fn(() => {
      throw new Error('Unexpected direct source request')
    })
    vi.stubGlobal('fetch', fetchImpl)
    try {
      expect(await getOperatorDataset()).toBe(dataset)
      expect(await getOperatorDataInfo()).toEqual({ packageId: 'selected' })
      expect(await checkOperatorUpdates()).toEqual({ updateAvailable: true })
      expect((await updateOperatorData()).dataset).toBe(dataset)
      expect(createDataPackageRepository).toHaveBeenCalledTimes(1)
      expect(createDataPackageRepository).toHaveBeenCalledWith(
        expect.objectContaining({ userDataRoot: '/portable-user' }),
      )
      expect(fetchImpl).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
