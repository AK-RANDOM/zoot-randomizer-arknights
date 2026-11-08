import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'

const minimumWidth = 960
const supportedViewport = window.matchMedia(`(min-width: ${minimumWidth}px)`)

function subscribe(onChange: () => void): () => void {
  supportedViewport.addEventListener('change', onChange)
  return () => supportedViewport.removeEventListener('change', onChange)
}

function viewportSupported(): boolean {
  return supportedViewport.matches
}

export default function WebWidthGate({ children }: { children: ReactNode }): React.JSX.Element {
  const blocked = !useSyncExternalStore(subscribe, viewportSupported)
  const notice = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const dialog = notice.current
    if (!dialog) return
    if (blocked && !dialog.open) dialog.showModal()
    if (!blocked && dialog.open) dialog.close()
  }, [blocked])

  return (
    <>
      <div hidden={blocked}>{children}</div>
      <dialog
        ref={notice}
        className="web-width-notice"
        aria-labelledby="web-width-title"
        aria-describedby="web-width-description"
        onCancel={(event) => event.preventDefault()}
      >
        <h1 id="web-width-title">This screen is too narrow</h1>
        <p id="web-width-description">
          Arknights Randomizer needs at least {minimumWidth} pixels of browser width. Rotate your
          device or open the app on a wider screen.
        </p>
      </dialog>
    </>
  )
}
