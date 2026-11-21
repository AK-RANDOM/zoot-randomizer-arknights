import { DataPackageClient, type DataPackageStorage } from '../../shared/dataPackageClient'
import { DATA_PACKAGE_PIN } from '../../shared/dataPackagePin'

// A separate database leaves account, Rulebook, pool and appearance preferences untouched.
export function browserDataPackageStorage(): DataPackageStorage {
  function database(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('akr-data-packages', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('packages')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Data storage unavailable.'))
      request.onblocked = () => reject(new Error('Close older app tabs to update data storage.'))
    })
  }
  async function access(mode: IDBTransactionMode, value?: string): Promise<string | null> {
    const db = await database()
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction('packages', mode)
        const store = transaction.objectStore('packages')
        const request = mode === 'readonly' ? store.get('active') : store.put(value, 'active')
        transaction.oncomplete = () =>
          resolve(mode === 'readonly' && typeof request.result === 'string' ? request.result : null)
        transaction.onerror = () =>
          reject(transaction.error ?? new Error('Could not save the data update.'))
        transaction.onabort = () =>
          reject(transaction.error ?? new Error('Data storage was interrupted.'))
      })
    } finally {
      db.close()
    }
  }
  return {
    load: () => access('readonly'),
    save: async (value) => {
      await access('readwrite', value)
    },
  }
}

export function createBrowserDataPackage(dataRoot: string): DataPackageClient {
  let channel: Promise<'preview' | 'production'> | undefined
  return new DataPackageClient({
    async loadBundled() {
      const response = await fetch(`${dataRoot}data-package.json`, {
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) throw new Error('Could not load bundled data.')
      return response.text()
    },
    bundledPin: DATA_PACKAGE_PIN,
    storage: browserDataPackageStorage(),
    cacheBundled: true,
    baseUrl: DATA_PACKAGE_PIN.baseUrl,
    channel: () =>
      (channel ??= (async () => {
        try {
          const response = await fetch(`${dataRoot}data-package-build.json`, {
            signal: AbortSignal.timeout(30_000),
          })
          if (!response.ok) return DATA_PACKAGE_PIN.updateChannel
          const build = (await response.json()) as { channel?: unknown }
          if (build.channel === 'preview' || build.channel === 'production') return build.channel
        } catch {
          /* The local package remains usable without the marker. */
        }
        return DATA_PACKAGE_PIN.updateChannel
      })()),
  })
}
