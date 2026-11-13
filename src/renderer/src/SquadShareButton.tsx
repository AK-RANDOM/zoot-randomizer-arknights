import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import OperatorCard from './OperatorCard'
import {
  formatSquadShareText,
  squadShareGeneratedLabel,
  squadShareImageSlots,
  squadShareTitle,
  type SquadShareResult,
} from './squadShare'
import './SquadShareButton.css'

function ShareText({ result }: { result: SquadShareResult }): React.JSX.Element {
  const text = formatSquadShareText(result)
  const field = useRef<HTMLTextAreaElement>(null)
  const [message, setMessage] = useState('')

  const copyText = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setMessage('Text copied.')
    } catch {
      field.current?.select()
      setMessage('Clipboard unavailable. Copy the selected text manually.')
    }
  }

  return (
    <>
      <textarea ref={field} aria-label="Squad text" readOnly value={text} />
      <div className="squad-share-actions">
        <span role="status">{message}</span>
        <button className="secondary-button" type="button" onClick={() => void copyText()}>
          Copy Text
        </button>
      </div>
    </>
  )
}

async function captureSquadImage(node: HTMLElement): Promise<Blob> {
  const [{ toBlob }, { default: archivo }] = await Promise.all([
    import('html-to-image'),
    import('./assets/Archivo-Variable.ttf?inline'),
  ])
  const images = [...node.querySelectorAll('img')]
  const decoded = await Promise.allSettled(images.map((image) => image.decode()))
  const failed = new Set(images.filter((_, index) => decoded[index].status === 'rejected'))
  await document.fonts.ready
  if (!node.isConnected) throw new Error('Image preview closed.')
  const png = await toBlob(node, {
    pixelRatio: 2,
    // The PNG is rasterized from an SVG that cannot load external fonts.
    fontEmbedCSS: `@font-face {
      font-family: Archivo;
      src: url("${archivo}") format('truetype');
      font-weight: 100 900;
      font-stretch: 62% 125%;
    }`,
    fetchRequestInit: { signal: AbortSignal.timeout(20_000) },
    filter: (child) => !(child instanceof HTMLImageElement && failed.has(child)),
  })
  if (!png) throw new Error('Image export failed.')
  return png
}

function ShareImage({ result }: { result: SquadShareResult }): React.JSX.Element {
  const image = useRef<HTMLElement>(null)
  const [preview, setPreview] = useState<{ png: Blob; url: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState('')
  const canCopy = typeof ClipboardItem !== 'undefined' && Boolean(navigator.clipboard?.write)
  const generatedLabel = squadShareGeneratedLabel(result.generatedAt)

  useEffect(() => {
    const node = image.current
    if (!node) return
    let cancelled = false
    let url: string | undefined

    const generateWhenReady = (): void => {
      if (node.querySelector('[data-artwork-loading]')) return
      observer.disconnect()
      void captureSquadImage(node)
        .then((png) => {
          if (cancelled) return
          url = URL.createObjectURL(png)
          setPreview({ png, url })
        })
        .catch(() => {
          if (!cancelled) setFailed(true)
        })
    }
    const observer = new MutationObserver(generateWhenReady)
    observer.observe(node, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-artwork-loading'],
    })
    generateWhenReady()
    return () => {
      cancelled = true
      observer.disconnect()
      if (url) URL.revokeObjectURL(url)
    }
  }, [attempt])

  const copyImage = async (): Promise<void> => {
    if (!preview) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': preview.png })])
      setMessage('Image copied.')
    } catch {
      setMessage('Could not copy the image. Try Download PNG.')
    }
  }

  return (
    <>
      {preview ? (
        <>
          <div className="squad-share-preview">
            <img src={preview.url} alt={`${squadShareTitle}. ${result.mode}. ${generatedLabel}.`} />
          </div>
          <div className="squad-share-actions">
            <span role="status">{message}</span>
            {canCopy && (
              <button className="secondary-button" type="button" onClick={() => void copyImage()}>
                Copy Image
              </button>
            )}
            <a
              className="secondary-button squad-share-download"
              href={preview.url}
              download={
                result.mode === 'Draft Mode' ? 'zoot-draft-squad.png' : 'zoot-standard-squad.png'
              }
            >
              Download PNG
            </a>
          </div>
        </>
      ) : (
        <div className="squad-share-preview">
          <span role="status">{failed ? 'Could not create the PNG.' : 'Preparing image…'}</span>
        </div>
      )}
      {failed && (
        <div className="squad-share-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setFailed(false)
              setAttempt((current) => current + 1)
            }}
          >
            Try Again
          </button>
        </div>
      )}
      {!preview && (
        <div className="squad-share-capture" aria-hidden="true">
          <article ref={image} className="squad-share-image">
            <header className="squad-share-image-header">
              <h2>{squadShareTitle}</h2>
              <div>
                <strong>{result.mode}</strong>
                <span>{generatedLabel}</span>
              </div>
            </header>
            <div className="squad-grid squad-share-grid">
              {squadShareImageSlots(result).map(({ operator, isOverflow }, index) => (
                <div
                  key={index}
                  className={`squad-slot${isOverflow ? ' squad-share-slot--overflow' : ''}`}
                >
                  {operator ? (
                    <>
                      <OperatorCard
                        operator={operator}
                        replayOnRandomize={false}
                        showPersonalProgression={false}
                      />
                      {isOverflow && <span className="squad-share-overflow">Overflow</span>}
                    </>
                  ) : (
                    <div className="squad-share-empty" />
                  )}
                </div>
              ))}
            </div>
          </article>
        </div>
      )}
    </>
  )
}

export default function SquadShareButton({
  result,
}: {
  result: SquadShareResult
}): React.JSX.Element {
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const [snapshot, setSnapshot] = useState<SquadShareResult | null>(null)
  const [format, setFormat] = useState<'text' | 'image'>('text')

  useLayoutEffect(() => {
    if (snapshot && !dialog.current?.open) dialog.current?.showModal()
  }, [snapshot])

  return (
    <>
      <button
        type="button"
        className="secondary-button"
        aria-haspopup="dialog"
        onClick={() => {
          setFormat('text')
          setSnapshot(result)
        }}
      >
        Share
      </button>
      {createPortal(
        <dialog
          ref={dialog}
          className={`squad-share-dialog squad-share-dialog--${format}`}
          aria-labelledby={titleId}
          onClose={() => setSnapshot(null)}
        >
          {snapshot && (
            <>
              <div className="squad-share-heading">
                <h2 id={titleId}>Share Squad</h2>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => dialog.current?.close()}
                >
                  Close
                </button>
              </div>
              <div className="squad-share-formats" role="group" aria-label="Share format">
                <button
                  className="secondary-button"
                  type="button"
                  aria-pressed={format === 'text'}
                  onClick={() => setFormat('text')}
                >
                  Text
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  aria-pressed={format === 'image'}
                  onClick={() => setFormat('image')}
                >
                  Image
                </button>
              </div>
              {format === 'text' ? (
                <ShareText result={snapshot} />
              ) : (
                <ShareImage result={snapshot} />
              )}
            </>
          )}
        </dialog>,
        document.body,
      )}
    </>
  )
}
