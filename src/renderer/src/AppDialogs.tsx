import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import './AppDialogs.css'
import { resolveAppDialogCopy, type AppDialogCopy } from './appDialogCopy'

interface DialogRequest extends AppDialogCopy {
  confirmation: boolean
  resolve: (confirmed: boolean) => void
  alternate?: { label: string; action: () => void }
}

interface AppDialogs {
  confirmAction: (copy: AppDialogCopy | string) => Promise<boolean>
  showNotice: (copy: AppDialogCopy | string) => void
  chooseSaveBeforeClose: (copy: AppDialogCopy | string) => Promise<'save' | 'discard' | 'cancel'>
}

const DialogContext = createContext<AppDialogs | null>(null)

export function useAppDialogs(): AppDialogs {
  const dialogs = useContext(DialogContext)
  if (!dialogs) throw new Error('App dialogs require AppDialogProvider.')
  return dialogs
}

function AppDialog({
  request,
  onFinish,
}: {
  request: DialogRequest
  onFinish: (confirmed: boolean) => void
}): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="confirmation-dialog app-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-dialog-title"
      aria-describedby="app-dialog-message"
      onCancel={(event) => {
        event.preventDefault()
        onFinish(false)
      }}
    >
      <h3 id="app-dialog-title">{request.title}</h3>
      <p id="app-dialog-message">{request.message}</p>
      <div className="confirmation-actions">
        {request.confirmation && (
          <button
            type="button"
            className="secondary-button"
            autoFocus
            onClick={() => onFinish(false)}
          >
            Cancel
          </button>
        )}
        {request.alternate && (
          <button type="button" className="secondary-button" onClick={request.alternate.action}>
            {request.alternate.label}
          </button>
        )}
        <button
          type="button"
          className="randomize-button"
          autoFocus={!request.confirmation}
          onClick={() => onFinish(true)}
        >
          {request.alternate ? 'Save Garrison' : request.confirmation ? 'Continue' : 'OK'}
        </button>
      </div>
    </dialog>
  )
}

export function AppDialogProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const pending = useRef<DialogRequest[]>([])
  const [active, setActive] = useState<DialogRequest | null>(null)

  const enqueue = useCallback(
    (copy: AppDialogCopy | string, confirmation: boolean): Promise<boolean> => {
      return new Promise((resolve) => {
        const request = { ...resolveAppDialogCopy(copy), confirmation, resolve }
        pending.current.push(request)
        setActive(pending.current[0])
      })
    },
    [],
  )
  const confirmAction = useCallback(
    (copy: AppDialogCopy | string) => enqueue(copy, true),
    [enqueue],
  )
  const showNotice = useCallback(
    (copy: AppDialogCopy | string): void => {
      void enqueue(copy, false)
    },
    [enqueue],
  )
  const chooseSaveBeforeClose = useCallback(
    (copy: AppDialogCopy | string): Promise<'save' | 'discard' | 'cancel'> => {
      return new Promise((resolve) => {
        let discard = false
        const request: DialogRequest = {
          ...resolveAppDialogCopy(copy),
          confirmation: true,
          resolve: (confirmed) => resolve(discard ? 'discard' : confirmed ? 'save' : 'cancel'),
          alternate: {
            label: 'Discard Changes',
            action: () => {
              discard = true
              pending.current.shift()
              setActive(pending.current[0] ?? null)
              request.resolve(false)
            },
          },
        }
        pending.current.push(request)
        setActive(pending.current[0])
      })
    },
    [],
  )
  const finish = (confirmed: boolean): void => {
    const request = pending.current.shift()
    setActive(pending.current[0] ?? null)
    request?.resolve(confirmed)
  }

  useEffect(
    () => () => {
      for (const request of pending.current.splice(0)) request.resolve(false)
    },
    [],
  )

  return (
    <DialogContext.Provider value={{ confirmAction, showNotice, chooseSaveBeforeClose }}>
      {children}
      {active && (
        <AppDialog key={active.title + active.message} request={active} onFinish={finish} />
      )}
    </DialogContext.Provider>
  )
}
