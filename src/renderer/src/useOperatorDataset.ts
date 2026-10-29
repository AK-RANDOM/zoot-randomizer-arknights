import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameLocale, Operator, OperatorDataset } from '../../shared/operator'
import type { OperatorDataInfo, OperatorUpdateCheck } from '../../shared/desktop'
import { localizeOperatorDataset } from '../../shared/gameLocalization'
import { operatorDatasetNeedsSkinMetadataRefresh } from '../../shared/skinMetadata'

export interface OperatorDatasetController {
  dataset: OperatorDataset | null
  dataInfo: OperatorDataInfo | null
  updateCheck: OperatorUpdateCheck | null
  busy: boolean
  updateRevision: number
  checkUpdates: () => Promise<void>
  installUpdate: () => Promise<void>
}

export default function useOperatorDataset({
  gameLocale,
  onOperatorsLoaded,
  onMessage,
  onError,
}: {
  gameLocale: GameLocale
  onOperatorsLoaded: (operators: readonly Operator[]) => void
  onMessage: (message: string) => void
  onError: (message: string | null) => void
}): OperatorDatasetController {
  const [dataset, setDataset] = useState<OperatorDataset | null>(null)
  const [dataInfo, setDataInfo] = useState<OperatorDataInfo | null>(null)
  const [updateCheck, setUpdateCheck] = useState<OperatorUpdateCheck | null>(null)
  const [busy, setBusy] = useState(false)
  const [updateRevision, setUpdateRevision] = useState(0)
  const skinMetadataRefreshAttempted = useRef(false)

  const loadData = useCallback(async (): Promise<OperatorDataset> => {
    const [nextDataset, nextInfo] = await Promise.all([
      window.desktop.getOperatorDataset(),
      window.desktop.getOperatorDataInfo(),
    ])
    const localized = localizeOperatorDataset(nextDataset, gameLocale)
    setDataset(localized)
    setDataInfo(nextInfo)
    onOperatorsLoaded(localized.operators)
    onMessage(`${localized.operators.length} operators ready.`)
    return localized
  }, [gameLocale, onMessage, onOperatorsLoaded])

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const loaded = await loadData()
        if (!operatorDatasetNeedsSkinMetadataRefresh(loaded) || skinMetadataRefreshAttempted.current) return

        skinMetadataRefreshAttempted.current = true
        setBusy(true)
        try {
          const result = await window.desktop.updateOperatorData()
          if (!active) return
          if (result.updated) {
            await loadData()
            if (!active) return
            setUpdateRevision((current) => current + 1)
            onMessage('Operator skin metadata is ready.')
          }
        } catch {
          if (active) {
            onMessage('Operator data loaded. Skin metadata will become available when the update source is reachable.')
          }
        } finally {
          if (active) setBusy(false)
        }
      } catch (reason: unknown) {
        if (!active) return
        onError(reason instanceof Error ? reason.message : String(reason))
        onMessage('Operator data could not be loaded.')
      }
    })()

    return () => {
      active = false
    }
  }, [loadData, onError, onMessage])

  const checkUpdates = useCallback(async (): Promise<void> => {
    setBusy(true)
    onError(null)
    try {
      const result = await window.desktop.checkOperatorUpdates()
      setUpdateCheck(result)
      onMessage(result.message)
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }, [onError, onMessage])

  const installUpdate = useCallback(async (): Promise<void> => {
    setBusy(true)
    onError(null)
    try {
      const result = await window.desktop.updateOperatorData()
      await loadData()
      setUpdateCheck(null)
      setUpdateRevision((current) => current + 1)
      onMessage(result.updated
        ? `Operator data updated. ${result.warnings.length ? `${result.warnings.length} metadata/image warning(s).` : ''}`
        : 'Operator data was already current.')
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }, [loadData, onError, onMessage])

  return { dataset, dataInfo, updateCheck, busy, updateRevision, checkUpdates, installUpdate }
}
