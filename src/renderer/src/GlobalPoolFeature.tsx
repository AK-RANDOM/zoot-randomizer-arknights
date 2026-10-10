import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createDefaultConstraints, type RandomizerConstraints } from '../../shared/constraints'
import {
  limitedAcquisitionGroups,
  welfareAcquisitionGroups,
  type LimitedAcquisitionGroup,
  type Operator,
  type OperatorDataset,
  type WelfareAcquisitionGroup,
} from '../../shared/operator'
import type { OperatorPreferences } from '../../shared/operatorPool'
import { validateConstraints } from '../../shared/randomizer'
import { getReleaseBoundPreview, type ReleaseBoundPreview } from '../../shared/releasePreview'
import {
  applyCustomReleaseDate,
  applyReleaseGroupSelection,
  releaseGroupLabel,
  releaseGroupSelectValue,
  releaseRangeIsValid,
} from '../../shared/releaseBounds'
import type { OperatorUpdateCheck } from '../../shared/desktop'
import OperatorFilters from './OperatorFilters'
import PoolPanel from './PoolPanel'
import { saveRaceExclusions } from './rendererPersistence'

const INVALID_RELEASE_RANGE_MESSAGE = 'Invalid operator release range\n\nThe maximum release bound cannot be earlier than the minimum release bound.\nPlease adjust one of the release bounds.'

type GlobalPoolSection = 'filter' | 'curate'

const limitedLabels: Record<LimitedAcquisitionGroup, string> = {
  anniversary: 'Anniversary', halfAnniversary: 'Half-Anniversary', cny: 'CNY', summer: 'Summer', collab: 'Collab',
}
const welfareLabels: Record<WelfareAcquisitionGroup, string> = {
  eventStory: 'Event / Story', redCert: 'Red Cert', cc: 'CC', isRa: 'IS / RA',
}

function allAndSome(values: boolean[]): { all: boolean; some: boolean } {
  return { all: values.length > 0 && values.every(Boolean), some: values.some(Boolean) }
}

function TriStateCheckbox({ label, checked, indeterminate = false, onChange }: {
  label: ReactNode
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (inputRef.current) inputRef.current.indeterminate = indeterminate }, [indeterminate])
  return <label className="source-check"><input ref={inputRef} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>
}

function TreeGroup({ label, checked, indeterminate, onChange, children }: {
  label: string
  checked: boolean
  indeterminate: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <div className="source-tree-group">
      <div className="source-tree-heading">
        <button type="button" className="tree-toggle" aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? '▾' : '▸'}</button>
        <TriStateCheckbox label={<strong>{label}</strong>} checked={checked} indeterminate={indeterminate} onChange={onChange} />
      </div>
      {open && <div className="source-tree-children">{children}</div>}
    </div>
  )
}

function RepresentativePortrait({ operator }: { operator: Operator }): React.JSX.Element {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setImageUrl(null)
    void window.desktop.getOperatorImage(operator.id).then((url) => { if (active) setImageUrl(url) })
    return () => { active = false }
  }, [operator.id])
  return <span className="release-representative" data-rarity={operator.rarity} title={`${operator.name} — ${operator.rarity}★`} aria-label={`${operator.name}, ${operator.rarity} star`}>{imageUrl ? <img src={imageUrl} alt="" draggable={false} /> : <span aria-hidden="true">{operator.name.slice(0, 1)}</span>}</span>
}

function ReleasePreviewStrip({ label, preview }: { label: string; preview: ReleaseBoundPreview | null }): React.JSX.Element {
  if (!preview) return <div className="release-preview release-preview--empty">No matching release event</div>
  const representatives = [...preview.sixStar, ...preview.fiveStar]
  return <div className="release-preview"><div className="release-preview__meta"><span>{label}</span><strong>{preview.date}</strong></div><div className="release-preview__portraits">{representatives.length > 0 ? representatives.map((operator) => <RepresentativePortrait key={operator.id} operator={operator} />) : <span className="release-preview__none">No 6★/5★ on this date</span>}</div></div>
}

function ValidationBox({ errors }: { errors: string[] }): React.JSX.Element {
  return <div className="validation-box" role="alert"><strong>Current configuration cannot generate a squad.</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>
}

export default function GlobalPoolFeature({
  dataset,
  constraints,
  finalOperatorPool,
  preferences,
  busy,
  updateCheck,
  onConstraintsChange,
  onPreferencesChange,
  onPoolChanged,
  onMessage,
  onError,
  onCheckUpdates,
  onInstallUpdate,
}: {
  dataset: OperatorDataset | null
  constraints: RandomizerConstraints
  finalOperatorPool: Operator[]
  preferences: OperatorPreferences
  busy: boolean
  updateCheck: OperatorUpdateCheck | null
  onConstraintsChange: (update: (current: RandomizerConstraints) => RandomizerConstraints) => void
  onPreferencesChange: (preferences: OperatorPreferences) => void
  onPoolChanged: () => void
  onMessage: (message: string) => void
  onError: (message: string | null) => void
  onCheckUpdates: () => Promise<void>
  onInstallUpdate: () => Promise<void>
}): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<GlobalPoolSection>('filter')
  const collaborationSources = useMemo(() => dataset ? [...new Set(dataset.operators.flatMap((operator) => operator.collaboration ?? []))].sort((a, b) => a.localeCompare(b)) : [], [dataset])
  const maxReleaseYear = useMemo(() => dataset ? dataset.operators.reduce((maximum, operator) => Math.max(maximum, operator.release[constraints.release.server].yearGroup ?? 0), 0) : 0, [constraints.release.server, dataset])
  const releaseYearOptions = useMemo(() => Array.from({ length: maxReleaseYear + 1 }, (_, index) => index), [maxReleaseYear])
  const minReleasePreview = useMemo(() => dataset ? getReleaseBoundPreview(dataset.operators, constraints.release, 'min') : null, [constraints.release, dataset])
  const maxReleasePreview = useMemo(() => dataset ? getReleaseBoundPreview(dataset.operators, constraints.release, 'max') : null, [constraints.release, dataset])
  const validation = useMemo(() => dataset ? validateConstraints(constraints, finalOperatorPool) : { valid: false, errors: [] }, [constraints, dataset, finalOperatorPool])
  const limitedState = allAndSome(limitedAcquisitionGroups.map((group) => constraints.acquisition.limited[group]))
  const welfareState = allAndSome(welfareAcquisitionGroups.map((group) => constraints.acquisition.welfare[group]))
  const collaborationState = allAndSome([constraints.collaboration.includeNonCollab, ...collaborationSources.map((source) => constraints.collaboration.sources[source] ?? true)])

  useEffect(() => {
    saveRaceExclusions(constraints.race?.excludedIds ?? [])
  }, [constraints.race?.excludedIds])

  const mutateFilters = (update: (current: RandomizerConstraints) => RandomizerConstraints): void => {
    onConstraintsChange(update)
    onPoolChanged()
    onError(null)
  }
  const commitReleaseChange = (nextRelease: RandomizerConstraints['release']): boolean => {
    if (!releaseRangeIsValid(nextRelease)) { window.alert(INVALID_RELEASE_RANGE_MESSAGE); return false }
    mutateFilters((current) => ({ ...current, release: nextRelease }))
    return true
  }
  const changeReleaseGroup = (side: 'min' | 'max', value: string): void => {
    if (!dataset || value === 'custom') return
    commitReleaseChange(applyReleaseGroupSelection(constraints.release, side, value === '' ? null : Number(value), dataset.operators))
  }
  const resetFilters = (): void => {
    const defaults = createDefaultConstraints()
    mutateFilters((current) => ({ ...current, release: { ...defaults.release, server: current.release.server }, acquisition: defaults.acquisition, collaboration: defaults.collaboration, subclass: defaults.subclass, race: defaults.race, faction: defaults.faction, era: defaults.era, alterExclusivity: defaults.alterExclusivity }))
    onMessage('Operator eligibility filters reset. Individual Pool exclusions were preserved.')
  }
  const updatePoolPreferences = (next: OperatorPreferences): void => {
    const exclusionsChanged = next.excludedOperatorIds.length !== preferences.excludedOperatorIds.length || next.excludedOperatorIds.some((id, index) => id !== preferences.excludedOperatorIds[index])
    onPreferencesChange(next)
    if (exclusionsChanged) {
      onPoolChanged()
      onError(null)
      onMessage('Operator pool updated.')
    }
  }
  const setLimitedAll = (checked: boolean): void => mutateFilters((current) => ({ ...current, acquisition: { ...current.acquisition, limited: Object.fromEntries(limitedAcquisitionGroups.map((group) => [group, checked])) as RandomizerConstraints['acquisition']['limited'] } }))
  const setWelfareAll = (checked: boolean): void => mutateFilters((current) => ({ ...current, acquisition: { ...current.acquisition, welfare: Object.fromEntries(welfareAcquisitionGroups.map((group) => [group, checked])) as RandomizerConstraints['acquisition']['welfare'] } }))
  const setCollaborationAll = (checked: boolean): void => mutateFilters((current) => ({ ...current, collaboration: { includeNonCollab: checked, sources: Object.fromEntries(collaborationSources.map((source) => [source, checked])) } }))

  const sourceFilters = (
    <div className="source-filter-layout">
      <fieldset className="constraint-group detail-group source-filter-group">
        <legend>Acquisition</legend>
        <TreeGroup label="Limited" checked={limitedState.all} indeterminate={!limitedState.all && limitedState.some} onChange={setLimitedAll}>{limitedAcquisitionGroups.map((group) => <TriStateCheckbox key={group} label={limitedLabels[group]} checked={constraints.acquisition.limited[group]} onChange={(checked) => mutateFilters((current) => ({ ...current, acquisition: { ...current.acquisition, limited: { ...current.acquisition.limited, [group]: checked } } }))} />)}</TreeGroup>
        <div className="source-standalone"><TriStateCheckbox label={<strong>Standard</strong>} checked={constraints.acquisition.standard} onChange={(checked) => mutateFilters((current) => ({ ...current, acquisition: { ...current.acquisition, standard: checked } }))} /></div>
        <TreeGroup label="Welfare" checked={welfareState.all} indeterminate={!welfareState.all && welfareState.some} onChange={setWelfareAll}>{welfareAcquisitionGroups.map((group) => <TriStateCheckbox key={group} label={welfareLabels[group]} checked={constraints.acquisition.welfare[group]} onChange={(checked) => mutateFilters((current) => ({ ...current, acquisition: { ...current.acquisition, welfare: { ...current.acquisition.welfare, [group]: checked } } }))} />)}</TreeGroup>
      </fieldset>
      <fieldset className="constraint-group detail-group source-filter-group">
        <legend>Collaboration source</legend>
        <TreeGroup label="Collaboration pool" checked={collaborationState.all} indeterminate={!collaborationState.all && collaborationState.some} onChange={setCollaborationAll}><TriStateCheckbox label="Non-collab" checked={constraints.collaboration.includeNonCollab} onChange={(checked) => mutateFilters((current) => ({ ...current, collaboration: { ...current.collaboration, includeNonCollab: checked } }))} />{collaborationSources.map((source) => <TriStateCheckbox key={source} label={source} checked={constraints.collaboration.sources[source] ?? true} onChange={(checked) => mutateFilters((current) => ({ ...current, collaboration: { ...current.collaboration, sources: { ...current.collaboration.sources, [source]: checked } } }))} />)}</TreeGroup>
        <p className="filter-note">Collab gacha counts as Limited → Collab; collab welfare counts as Welfare → Event / Story. This section independently controls which crossover sources may enter the pool.</p>
      </fieldset>
    </div>
  )

  return (
    <>
      <nav className="squad-mode-tabs" aria-label="Global Pool section">
        {([['filter', 'Global Filter'], ['curate', 'Curate']] as const).map(([section, label]) => (
          <button key={section} type="button" className={activeSection === section ? 'is-active' : ''} aria-selected={activeSection === section} onClick={() => setActiveSection(section)}>{label}</button>
        ))}
      </nav>

      {activeSection === 'filter' && (
        <section className="panel operators-panel" aria-labelledby="operators-heading">
          <div className="section-heading"><div><p className="eyebrow">SETUP • GLOBAL POOL • GLOBAL FILTER</p><h2 id="operators-heading">Global Filter</h2></div><div className="section-actions"><button className="secondary-button" type="button" onClick={resetFilters}>Reset operator filters</button><button className="secondary-button" type="button" disabled={busy || !dataset} onClick={() => void (updateCheck?.updateAvailable ? onInstallUpdate() : onCheckUpdates())}>{busy ? 'Working…' : updateCheck?.updateAvailable ? 'Update data' : 'Check data updates'}</button></div></div>

          <fieldset className="constraint-group detail-group release-group">
            <legend>Release</legend>
            <div className="release-bounds-grid">
              <div className="release-bound-card"><h3>Minimum bound</h3><label className="field"><span>Release group</span><select value={releaseGroupSelectValue(constraints.release.minYear, constraints.release.minDate)} onChange={(event) => changeReleaseGroup('min', event.target.value)}><option value="">Any</option><option value="custom" disabled>Custom</option>{releaseYearOptions.map((year) => <option key={year} value={year}>{releaseGroupLabel(year)}</option>)}</select></label><label className="field"><span>Exact date floor</span><input className="date-input" type="date" value={constraints.release.minDate} onChange={(event) => commitReleaseChange(applyCustomReleaseDate(constraints.release, 'min', event.target.value))} /></label><ReleasePreviewStrip label="Starts at event" preview={minReleasePreview} /></div>
              <div className="release-bound-card"><h3>Maximum bound</h3><label className="field"><span>Release group</span><select value={releaseGroupSelectValue(constraints.release.maxYear, constraints.release.maxDate)} onChange={(event) => changeReleaseGroup('max', event.target.value)}><option value="">Any</option><option value="custom" disabled>Custom</option>{releaseYearOptions.map((year) => <option key={year} value={year}>{releaseGroupLabel(year)}</option>)}</select></label><label className="field"><span>Exact date ceiling</span><input className="date-input" type="date" value={constraints.release.maxDate} onChange={(event) => commitReleaseChange(applyCustomReleaseDate(constraints.release, 'max', event.target.value))} /></label><ReleasePreviewStrip label="Ends at event" preview={maxReleasePreview} /></div>
            </div>
            <p className="filter-note">Portraits come only from the exact operator-release event at each bound. Launch is launch day only; later groups increment at anniversary release boundaries. Named groups prefill their exact regional date bounds; manually editing a date changes that side to Custom. Region comes from Options.</p>
          </fieldset>

          {dataset && <OperatorFilters dataset={dataset} constraints={constraints} onChange={mutateFilters} afterEra={sourceFilters} />}

          {dataset && !validation.valid && validation.errors.length > 0 && <ValidationBox errors={validation.errors} />}
          {updateCheck?.updateAvailable && <div className="update-box"><span>New operator data is available. Use Update data above to install it.</span></div>}
        </section>
      )}

      {activeSection === 'curate' && dataset && (
        <PoolPanel dataset={dataset} constraints={constraints} preferences={preferences} onPreferencesChange={updatePoolPreferences} />
      )}
    </>
  )
}
