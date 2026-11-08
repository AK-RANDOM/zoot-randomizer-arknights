import { useEffect, useState } from 'react'
import type { ArtworkStorageInfo, PortraitSyncProgress } from '../../shared/desktop'

export default function ArtworkDownloadStatus(): React.JSX.Element {
  const [progress, setProgress] = useState<PortraitSyncProgress | null>(null)
  const [storage, setStorage] = useState<ArtworkStorageInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refreshStorage = (): void => {
    void window.desktop
      .getArtworkStorageInfo()
      .then(setStorage)
      .catch((e: unknown) => setError(String(e)))
  }
  const run = (task: () => Promise<unknown>): void => {
    setError(null)
    void task()
      .then(refreshStorage)
      .catch((e: unknown) => setError(String(e)))
  }

  useEffect(() => {
    let active = true
    refreshStorage()
    void window.desktop.getPortraitSyncProgress().then((next) => {
      if (active) {
        setProgress(next)
        if (next.status !== 'downloading') refreshStorage()
      }
    })
    const unsubscribe = window.desktop.onPortraitSyncProgress((next) => {
      if (active) {
        setProgress(next)
        if (next.status !== 'downloading') refreshStorage()
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  if (!progress) {
    return <div className="artwork-download-status">Checking artwork cache…</div>
  }

  const downloading = progress.status === 'downloading'
  const canRetry = progress.status === 'cancelled' || progress.status === 'failed'
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  return (
    <div className="artwork-download-status" aria-live="polite">
      <div className="artwork-download-status__heading">
        <strong>Data &amp; Storage</strong>
        <small>
          {storage
            ? `${storage.totalFiles.toLocaleString()} cached images · ${(storage.totalBytes / 1024 ** 3).toFixed(2)} GiB`
            : 'Checking cache…'}
        </small>
      </div>
      <div className="bulk-appearance-control">
        <button
          type="button"
          className="secondary-button"
          disabled={downloading}
          onClick={() => run(() => window.desktop.startCompleteArtworkDownload())}
        >
          Download All / Resume
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => run(() => window.desktop.openArtworkStorageFolder())}
        >
          Open Folder
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={downloading}
          onClick={() => {
            if (
              window.confirm(
                'Delete downloaded artwork? Bundled assets and personal data will be preserved.',
              )
            )
              run(() => window.desktop.clearDownloadedArtwork())
          }}
        >
          Clear Cache
        </button>
      </div>
      <details>
        <summary>Storage details</summary>
        <small>Location: {storage?.path ?? 'Loading…'}</small>
        {storage?.categories.map((category) => (
          <div key={category.name}>
            <small>
              {category.name}: {category.files.toLocaleString()} files ·{' '}
              {(category.bytes / 1024 ** 2).toFixed(1)} MiB
            </small>
          </div>
        ))}
      </details>
      {storage?.warning && <p role="alert">{storage.warning}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="artwork-download-status__heading">
        <div>
          <strong>Offline artwork cache</strong>
          <p>{progress.message}</p>
        </div>
        {downloading && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void window.desktop.cancelPortraitSync().then(setProgress)}
          >
            Cancel
          </button>
        )}
        {canRetry && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => run(() => window.desktop.startCompleteArtworkDownload())}
          >
            Retry
          </button>
        )}
      </div>
      {downloading && (
        <>
          <progress value={progress.completed} max={Math.max(progress.total, 1)} />
          <small>
            {progress.completed} / {progress.total} assets · {percent}%
          </small>
        </>
      )}
    </div>
  )
}
