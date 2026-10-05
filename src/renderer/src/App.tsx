import { useCallback, useEffect, useMemo, useState } from 'react'
import DraftPanel from './DraftPanel'
import DraftRulebookPanel from './DraftRulebookPanel'
import GlobalPoolFeature from './GlobalPoolFeature'
import OptionsPanel from './OptionsPanel'
import StandardSquadFeature from './StandardSquadFeature'
import useOperatorDataset from './useOperatorDataset'
import { createDefaultConstraints, type RandomizerConstraints } from '../../shared/constraints'
import type { GameLocale, Operator, ReleaseServer } from '../../shared/operator'
import {
  buildFinalOperatorPool,
  reconcileOperatorPreferences,
  type OperatorPreferences,
  type PoolPresentationMode,
} from '../../shared/operatorPool'
import { releaseRangeIsValid, remapReleaseConstraintServer } from '../../shared/releaseBounds'
import { loadOperatorPreferences, saveOperatorPreferences } from './operatorPreferencesStorage'
import { loadRaceExclusions } from './rendererPersistence'

const INVALID_RELEASE_RANGE_MESSAGE = 'Invalid operator release range\n\nThe maximum release bound cannot be earlier than the minimum release bound.\nPlease adjust one of the release bounds.'

type AppTab = 'squads' | 'setup' | 'options'
type SquadMode = 'standard' | 'draft'
type SetupMode = 'global-pool' | 'draft-rulebooks'

function displayDate(value: string | null | undefined): string {
  if (!value) return 'unknown'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'unknown' : date.toLocaleDateString()
}

export default function App(): React.JSX.Element {
  const [operatorPreferences, setOperatorPreferences] = useState<OperatorPreferences>(() => loadOperatorPreferences())
  const [constraints, setConstraints] = useState<RandomizerConstraints>(() => {
    const next = createDefaultConstraints()
    next.release.server = operatorPreferences.metadataRegion
    next.race = { excludedIds: loadRaceExclusions() }
    return next
  })
  const [message, setMessage] = useState('Loading operator data…')
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<AppTab>('squads')
  const [squadMode, setSquadMode] = useState<SquadMode>('standard')
  const [setupMode, setSetupMode] = useState<SetupMode>('global-pool')
  const [poolRevision, setPoolRevision] = useState(0)

  useEffect(() => { saveOperatorPreferences(operatorPreferences) }, [operatorPreferences])

  const onOperatorsLoaded = useCallback((operators: readonly Operator[]) => {
    setOperatorPreferences((current) => reconcileOperatorPreferences(current, operators))
  }, [])

  const data = useOperatorDataset({
    gameLocale: operatorPreferences.gameLocale,
    onOperatorsLoaded,
    onMessage: setMessage,
    onError: setError,
  })

  const finalOperatorPool = useMemo(
    () => data.dataset
      ? buildFinalOperatorPool(data.dataset.operators, constraints, operatorPreferences.excludedOperatorIds)
      : [],
    [constraints, data.dataset, operatorPreferences.excludedOperatorIds],
  )

  const updateConstraints = useCallback(
    (update: (current: RandomizerConstraints) => RandomizerConstraints): void => setConstraints(update),
    [],
  )
  const markPoolChanged = useCallback(() => setPoolRevision((current) => current + 1), [])

  const setMetadataRegion = (server: ReleaseServer): void => {
    if (!data.dataset || server === constraints.release.server) return
    const nextRelease = remapReleaseConstraintServer(constraints.release, server, data.dataset.operators)
    if (!releaseRangeIsValid(nextRelease)) {
      window.alert(INVALID_RELEASE_RANGE_MESSAGE)
      return
    }
    setOperatorPreferences((current) => ({ ...current, metadataRegion: server }))
    setConstraints((current) => ({ ...current, release: nextRelease }))
    markPoolChanged()
    setMessage(`Metadata region changed to ${server === 'global' ? 'EN / Global' : 'CN'}.`)
  }
  const setGameLocale = (gameLocale: GameLocale): void => setOperatorPreferences((current) => ({ ...current, gameLocale }))
  const setPoolPresentation = (poolPresentation: PoolPresentationMode): void => setOperatorPreferences((current) => ({ ...current, poolPresentation }))

  return (
    <main className="app-shell">
      <header className="hero">
        <div><p className="eyebrow">ARKNIGHTS • OFFLINE SQUAD RANDOMIZER</p><h1>Arknights Randomizer</h1></div>
        <div className="data-summary">
          <span>{data.dataInfo?.operatorCount ?? '—'} operators</span>
          <span>Data {displayDate(data.dataInfo?.generatedAt)}</span>
          <span>{data.dataInfo?.origin === 'downloaded' ? 'Updated data' : 'Bundled data'}</span>
        </div>
      </header>

      <nav className="main-tabs" aria-label="Randomizer configuration">
        {([['squads', 'Get Squad'], ['setup', 'Setup'], ['options', 'Options']] as const).map(([tab, label]) => (
          <button key={tab} type="button" className={activeTab === tab ? 'is-active' : ''} aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}>{label}</button>
        ))}
      </nav>

      {activeTab === 'squads' && (
        <nav className="squad-mode-tabs" aria-label="Squad construction mode">
          {([['standard', 'Standard'], ['draft', 'Drafts']] as const).map(([mode, label]) => (
            <button key={mode} type="button" className={squadMode === mode ? 'is-active' : ''} aria-selected={squadMode === mode} onClick={() => setSquadMode(mode)}>{label}</button>
          ))}
        </nav>
      )}

      {activeTab === 'setup' && (
        <nav className="squad-mode-tabs" aria-label="Setup section">
          {([['global-pool', 'Global Pool'], ['draft-rulebooks', 'Draft Rulebooks']] as const).map(([mode, label]) => (
            <button key={mode} type="button" className={setupMode === mode ? 'is-active' : ''} aria-selected={setupMode === mode} onClick={() => setSetupMode(mode)}>{label}</button>
          ))}
        </nav>
      )}

      {activeTab === 'squads' && squadMode === 'standard' && (
        <StandardSquadFeature
          dataset={data.dataset}
          constraints={constraints}
          finalOperatorPool={finalOperatorPool}
          resetRevision={poolRevision + data.updateRevision}
          onConstraintsChange={updateConstraints}
          onMessage={setMessage}
          onError={setError}
        />
      )}

      {activeTab === 'squads' && squadMode === 'draft' && (
        <DraftPanel
          dataset={data.dataset}
          operators={finalOperatorPool}
          targetSize={constraints.squadSize}
          ready={data.dataset !== null}
        />
      )}

      {activeTab === 'setup' && setupMode === 'global-pool' && (
        <GlobalPoolFeature
          dataset={data.dataset}
          constraints={constraints}
          finalOperatorPool={finalOperatorPool}
          preferences={operatorPreferences}
          busy={data.busy}
          updateCheck={data.updateCheck}
          onConstraintsChange={updateConstraints}
          onPreferencesChange={setOperatorPreferences}
          onPoolChanged={markPoolChanged}
          onMessage={setMessage}
          onError={setError}
          onCheckUpdates={data.checkUpdates}
          onInstallUpdate={data.installUpdate}
        />
      )}

      {activeTab === 'setup' && setupMode === 'draft-rulebooks' && data.dataset && (
        <DraftRulebookPanel dataset={data.dataset} />
      )}

      {activeTab === 'options' && (
        <OptionsPanel
          preferences={operatorPreferences}
          onMetadataRegionChange={setMetadataRegion}
          onGameLocaleChange={setGameLocale}
          onPoolPresentationChange={setPoolPresentation}
        />
      )}

      <footer className="status-line"><span>{message}</span>{error && <span className="status-error">{error}</span>}</footer>
    </main>
  )
}
