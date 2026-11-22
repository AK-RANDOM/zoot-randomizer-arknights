import { useCallback, useEffect, useMemo, useState } from 'react'
import DraftPanel from './DraftPanel'
import DraftConfirmationDialog from './DraftConfirmationDialog'
import GarrisonSquadFeature from './GarrisonSquadFeature'
import {
  garrisonDispatchPool,
  type GarrisonDispatchRequest,
  type GarrisonDispatchControls,
} from './garrisonDispatch'
import ISOpeningFeature from './ISOpeningFeature'
import GlobalPoolFeature from './GlobalPoolFeature'
import useCuratePresentation from './useCuratePresentation'
import OptionsPanel from './OptionsPanel'
import StandardSquadFeature from './StandardSquadFeature'
import useOperatorDataset from './useOperatorDataset'
import { DRAFT_SESSION_RESET_EVENT } from './useDraftSession'
import { createDefaultConstraints, type RandomizerConstraints } from '../../shared/constraints'
import type { GameLocale, Operator, ReleaseServer } from '../../shared/operator'
import {
  accountProgressionRank,
  buildFinalOperatorPool,
  reconcileOperatorPreferences,
  type OperatorAppearanceChoice,
  type OperatorPreferences,
} from '../../shared/operatorPool'
import { releaseRangeIsValid, remapReleaseConstraintServer } from '../../shared/releaseBounds'
import { loadOperatorPreferences, saveOperatorPreferences } from './operatorPreferencesStorage'
import {
  dismissWarning,
  loadGenderExclusions,
  loadRaceExclusions,
  loadRendererPersistence,
  saveOperatorArtwork,
  updateRendererPersistence,
  warningIsDismissed,
  type AppTheme,
} from './rendererPersistence'
import { notifyOperatorAppearanceChanged, changeAppearanceRegion } from './operatorAppearance'
import { useImportedArknightsAccount } from './arknightsAccountState'
import { importedAccountOwnedOperatorIds } from '../../shared/arknightsAccountReconciliation'

const INVALID_RELEASE_RANGE_MESSAGE =
  'Invalid operator release range\n\nThe maximum release bound cannot be earlier than the minimum release bound.\nPlease adjust one of the release bounds.'
const DEFAULT_DRAFT_TARGET_SIZE = 12
const WINDOWS_DOWNLOAD_NOTICE = 'web-windows-download-banner'

type AppTab = 'squads' | 'setup' | 'options'
type SquadMode = 'standard' | 'garrison' | 'draft' | 'is-opening'
type PendingNavigation = { tab: AppTab } | { mode: SquadMode }

interface GarrisonDispatchSession {
  request: GarrisonDispatchRequest
  constraints: RandomizerConstraints
  pool: Operator[]
}

function displayDate(value: string | null | undefined): string {
  if (!value) return 'unknown'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'unknown' : date.toLocaleDateString()
}

export default function App(): React.JSX.Element {
  const curatePresentation = useCuratePresentation()
  const [theme, setTheme] = useState(() => loadRendererPersistence().theme)
  const [operatorPreferences, setOperatorPreferences] = useState<OperatorPreferences>(() =>
    loadOperatorPreferences(),
  )
  const [constraints, setConstraints] = useState<RandomizerConstraints>(() => {
    const next = createDefaultConstraints()
    next.release.server = operatorPreferences.metadataRegion
    next.race = { excludedIds: loadRaceExclusions() }
    next.gender = { excludedIds: loadGenderExclusions() }
    return next
  })
  const [message, setMessage] = useState('Loading operator data…')
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<AppTab>('squads')
  const [squadMode, setSquadMode] = useState<SquadMode>('standard')
  const [poolRevision, setPoolRevision] = useState(0)
  const [draftActive, setDraftActive] = useState(false)
  const [garrisonDispatch, setGarrisonDispatch] = useState<GarrisonDispatchSession | null>(null)
  const [retainGarrison, setRetainGarrison] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null)
  const [showWindowsDownloadNotice, setShowWindowsDownloadNotice] = useState(
    () => window.desktop.platform === 'browser' && !warningIsDismissed(WINDOWS_DOWNLOAD_NOTICE),
  )
  const markPoolChanged = useCallback(() => setPoolRevision((current) => current + 1), [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const changeTheme = (next: AppTheme): void => {
    setTheme(next)
    updateRendererPersistence((current) => ({ ...current, theme: next }))
  }

  useEffect(() => {
    saveOperatorPreferences(operatorPreferences)
  }, [operatorPreferences])

  const onOperatorsLoaded = useCallback((operators: readonly Operator[]) => {
    setOperatorPreferences((current) => reconcileOperatorPreferences(current, operators))
  }, [])

  const data = useOperatorDataset({
    gameLocale: operatorPreferences.gameLocale,
    onOperatorsLoaded,
    onMessage: setMessage,
    onError: setError,
  })

  const importedAccount = useImportedArknightsAccount()
  useEffect(() => {
    if (importedAccount !== null || operatorPreferences.accountFilterMode === 'ignore') return
    setOperatorPreferences((current) => ({ ...current, accountFilterMode: 'ignore' }))
    markPoolChanged()
    setMessage('Account filtering was disabled because imported account data was cleared.')
  }, [importedAccount, operatorPreferences.accountFilterMode, markPoolChanged])

  const finalOperatorPool = useMemo(
    () =>
      data.dataset
        ? buildFinalOperatorPool(
            data.dataset.operators,
            constraints,
            operatorPreferences.excludedOperatorIds,
            {
              snapshot: importedAccount,
              mode: operatorPreferences.accountFilterMode,
              minimum: operatorPreferences.accountProgressionMin,
              maximum: operatorPreferences.accountProgressionMax,
              includeCappedLowRarity: operatorPreferences.accountIncludeCappedLowRarity,
            },
          )
        : [],
    [
      constraints,
      data.dataset,
      operatorPreferences.excludedOperatorIds,
      operatorPreferences.accountFilterMode,
      operatorPreferences.accountProgressionMin,
      operatorPreferences.accountProgressionMax,
      operatorPreferences.accountIncludeCappedLowRarity,
      importedAccount,
    ],
  )

  const updateConstraints = useCallback(
    (update: (current: RandomizerConstraints) => RandomizerConstraints): void =>
      setConstraints(update),
    [],
  )
  const updateDispatchConstraints = useCallback(
    (update: (current: RandomizerConstraints) => RandomizerConstraints): void => {
      setGarrisonDispatch((current) =>
        current ? { ...current, constraints: update(current.constraints) } : null,
      )
    },
    [],
  )
  const dispatchAllowedIds = useMemo(
    () =>
      garrisonDispatch ? new Set(garrisonDispatch.pool.map((operator) => operator.id)) : undefined,
    [garrisonDispatch?.pool],
  )
  const startGarrisonDispatch = (request: GarrisonDispatchRequest): void => {
    setRetainGarrison(true)
    setGarrisonDispatch({
      request,
      constraints: structuredClone(constraints),
      pool: garrisonDispatchPool(finalOperatorPool, request.excludedOperatorIds),
    })
    setError(null)
    setSquadMode(request.mode)
  }
  const cancelGarrisonDispatch = (): void => {
    selectSquadMode('garrison')
  }
  const dispatchControls: GarrisonDispatchControls | undefined = garrisonDispatch
    ? {
        stageName: garrisonDispatch.request.stageName,
        onCancel: cancelGarrisonDispatch,
        onConfirm: (operatorIds) => {
          if (!garrisonDispatch.request.onConfirm(operatorIds)) return
          setGarrisonDispatch(null)
          setSquadMode('garrison')
          setError(null)
        },
      }
    : undefined
  const setMetadataRegion = (server: ReleaseServer): void => {
    if (!data.dataset || server === constraints.release.server) return
    const nextRelease = remapReleaseConstraintServer(
      constraints.release,
      server,
      data.dataset.operators,
    )
    if (!releaseRangeIsValid(nextRelease)) {
      window.alert(INVALID_RELEASE_RANGE_MESSAGE)
      return
    }
    const nextPreferences = changeAppearanceRegion(
      operatorPreferences,
      data.dataset.operators,
      server,
      importedAccount,
    )
    saveOperatorPreferences(nextPreferences)
    setOperatorPreferences(nextPreferences)
    notifyOperatorAppearanceChanged()
    setConstraints((current) => ({ ...current, release: nextRelease }))
    markPoolChanged()
    setMessage(`Metadata region changed to ${server === 'global' ? 'EN / Global' : 'CN'}.`)
  }
  const setGameLocale = (gameLocale: GameLocale): void =>
    setOperatorPreferences((current) => ({ ...current, gameLocale }))
  const setCurateNames = (showCurateNames: boolean): void =>
    setOperatorPreferences((current) => ({ ...current, showCurateNames }))
  const setBulkAppearance = (choice: 'e1' | 'e2' | 'random' | 'account'): void => {
    if (!data.dataset) return
    if (choice === 'account' && !importedAccount) {
      setMessage('Import an Arknights account before syncing equipped outfits.')
      return
    }
    const ownedForAppearance = importedAccount
      ? new Set(importedAccountOwnedOperatorIds(importedAccount))
      : null
    const operatorAppearances =
      choice === 'account'
        ? {
            ...operatorPreferences.operatorAppearances,
            ...Object.fromEntries(
              data.dataset.operators
                .filter((operator) => ownedForAppearance?.has(operator.id))
                .map((operator) => [operator.id, 'account' as OperatorAppearanceChoice]),
            ),
          }
        : Object.fromEntries(
            data.dataset.operators.map((operator) => [
              operator.id,
              choice as OperatorAppearanceChoice,
            ]),
          )
    const nextPreferences: OperatorPreferences = {
      ...operatorPreferences,
      operatorAppearances,
      defaultAppearance: choice,
      appearanceRandomSeed:
        choice === 'random' ? Date.now() : operatorPreferences.appearanceRandomSeed,
    }
    saveOperatorPreferences(nextPreferences)
    setOperatorPreferences(nextPreferences)
    if (choice === 'e1' || choice === 'e2') saveOperatorArtwork(choice)
    notifyOperatorAppearanceChanged()
    setMessage(
      choice === 'random'
        ? 'Random appearances applied to all operators.'
        : choice === 'account'
          ? `${ownedForAppearance?.size ?? 0} imported operators now follow their equipped account outfits.`
          : `${choice.toUpperCase()} artwork applied to all operators.`,
    )
  }

  const confirmDraftExit = (): boolean => {
    if (!draftActive) return true
    if (
      !window.confirm(
        'A Draft round is currently in progress. Leaving this page will abandon the Draft. Continue?',
      )
    )
      return false
    window.dispatchEvent(new Event(DRAFT_SESSION_RESET_EVENT))
    setDraftActive(false)
    return true
  }
  const selectMainTab = (tab: AppTab): void => {
    if (tab === activeTab) return
    if (garrisonDispatch) {
      setPendingNavigation({ tab })
      return
    }
    if (!garrisonDispatch && activeTab === 'squads' && squadMode === 'draft' && !confirmDraftExit())
      return
    setGarrisonDispatch(null)
    setError(null)
    setActiveTab(tab)
  }
  const selectSquadMode = (mode: SquadMode): void => {
    if (mode === squadMode) return
    if (garrisonDispatch) {
      setPendingNavigation({ mode })
      return
    }
    if (!garrisonDispatch && squadMode === 'draft' && !confirmDraftExit()) return
    if (mode === 'garrison') setRetainGarrison(true)
    setGarrisonDispatch(null)
    setError(null)
    setSquadMode(mode)
  }
  const confirmDispatchNavigation = (): void => {
    if (!pendingNavigation) return
    setGarrisonDispatch(null)
    setError(null)
    setMessage('Squad generation discarded; the Garrison stage was not changed.')
    if ('tab' in pendingNavigation) setActiveTab(pendingNavigation.tab)
    else setSquadMode(pendingNavigation.mode)
    setPendingNavigation(null)
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Arknights</p>
          <h1>ZOOT Squad Dispatcher</h1>
        </div>
        <div className="data-summary">
          <span>App v{__APP_VERSION__}</span>
          <span>{data.dataInfo?.operatorCount ?? '—'} operators</span>
          <span>Data {displayDate(data.dataInfo?.generatedAt)}</span>
          <span>{data.dataInfo?.origin === 'downloaded' ? 'Updated data' : 'Bundled data'}</span>
        </div>
      </header>

      {showWindowsDownloadNotice && (
        <aside className="windows-download-notice" aria-label="Windows app available">
          <p>
            <strong>Windows app available.</strong> Download it from Options to sync your Arknights
            account.
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              dismissWarning(WINDOWS_DOWNLOAD_NOTICE)
              setShowWindowsDownloadNotice(false)
            }}
          >
            Dismiss
          </button>
        </aside>
      )}

      <nav className="main-tabs" aria-label="Randomizer configuration">
        {(
          [
            ['squads', 'Dispatch'],
            ['setup', 'Setup'],
            ['options', 'Options'],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? 'is-active' : ''}
            aria-selected={activeTab === tab}
            onClick={() => selectMainTab(tab)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'squads' && (
        <nav className="squad-mode-tabs" aria-label="Squad construction mode">
          {(
            [
              ['standard', 'Standard'],
              ['draft', 'Draft'],
              ['garrison', 'Garrison'],
              ['is-opening', 'IS Opening'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={squadMode === mode ? 'is-active' : ''}
              aria-selected={squadMode === mode}
              onClick={() => selectSquadMode(mode)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}

      {activeTab === 'squads' && squadMode === 'standard' && (
        <StandardSquadFeature
          key={garrisonDispatch ? 'garrison' : 'standard'}
          dataset={data.dataset}
          constraints={garrisonDispatch?.constraints ?? constraints}
          finalOperatorPool={garrisonDispatch?.pool ?? finalOperatorPool}
          resetRevision={poolRevision + data.updateRevision}
          onConstraintsChange={garrisonDispatch ? updateDispatchConstraints : updateConstraints}
          garrisonDispatch={dispatchControls}
          onMessage={setMessage}
          onError={setError}
        />
      )}

      {(retainGarrison || (activeTab === 'squads' && squadMode === 'garrison')) && (
        <div hidden={activeTab !== 'squads' || squadMode !== 'garrison'}>
          <GarrisonSquadFeature
            operators={data.dataset?.operators ?? []}
            eligibleOperators={finalOperatorPool}
            alterExclusivity={constraints.alterExclusivity}
            metadataRegion={operatorPreferences.metadataRegion}
            gameLocale={operatorPreferences.gameLocale}
            onMessage={setMessage}
            onDispatch={startGarrisonDispatch}
          />
        </div>
      )}

      {activeTab === 'squads' && squadMode === 'is-opening' && (
        <ISOpeningFeature
          key={operatorPreferences.metadataRegion}
          operators={finalOperatorPool}
          metadataRegion={operatorPreferences.metadataRegion}
          alterExclusivity={constraints.alterExclusivity}
          ready={data.dataset !== null}
          onMessage={setMessage}
          onError={setError}
        />
      )}

      {activeTab === 'squads' && squadMode === 'draft' && (
        <DraftPanel
          key={garrisonDispatch ? 'garrison' : 'draft'}
          dataset={data.dataset}
          operators={garrisonDispatch?.pool ?? finalOperatorPool}
          allowedOperatorIds={dispatchAllowedIds}
          garrisonDispatch={dispatchControls}
          targetSize={DEFAULT_DRAFT_TARGET_SIZE}
          ready={data.dataset !== null}
          onActiveDraftChange={setDraftActive}
        />
      )}

      {activeTab === 'setup' && (
        <>
          <GlobalPoolFeature
            curatePresentation={curatePresentation}
            dataset={data.dataset}
            constraints={constraints}
            finalOperatorPool={finalOperatorPool}
            preferences={operatorPreferences}
            onConstraintsChange={updateConstraints}
            onPreferencesChange={(next) => {
              if (
                accountProgressionRank(next.accountProgressionMax) <
                accountProgressionRank(next.accountProgressionMin)
              ) {
                window.alert(
                  'Invalid account progression range\n\nEnd progression cannot be lower than Start progression.',
                )
                return
              }
              saveOperatorPreferences(next)
              setOperatorPreferences(next)
              notifyOperatorAppearanceChanged()
            }}
            onPoolChanged={markPoolChanged}
            onMessage={setMessage}
            onError={setError}
          />
        </>
      )}

      {activeTab === 'options' && (
        <OptionsPanel
          operatorData={data}
          preferences={operatorPreferences}
          theme={theme}
          onThemeChange={changeTheme}
          onMetadataRegionChange={setMetadataRegion}
          onGameLocaleChange={setGameLocale}
          onCurateNamesChange={setCurateNames}
          onBulkAppearanceChange={setBulkAppearance}
        />
      )}

      {pendingNavigation && garrisonDispatch && (
        <DraftConfirmationDialog
          copy={{
            title: 'Discard this Garrison squad attempt?',
            body: `Leaving squad generation for “${garrisonDispatch.request.stageName}” will discard the unconfirmed squad. The Garrison stage will stay unchanged.`,
            confirmLabel: 'Discard & Leave',
            suppressionLabel: '',
          }}
          allowSuppression={false}
          suppressSession={false}
          onSuppressSessionChange={() => {}}
          onCancel={() => setPendingNavigation(null)}
          onConfirm={confirmDispatchNavigation}
        />
      )}

      <footer className="status-line">
        <span>{message}</span>
        {error && <span className="status-error">{error}</span>}
      </footer>
    </main>
  )
}
