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
        <button type="button" className="tree-toggle" aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? 'â–¾' : 'â–¸'}</button>
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
  return <span className="release-representative" data-rarity={operator.rarity} title={`${operator.name} â€” ${operator.rarity}â˜…`} aria-label={`${operator.name}, ${operator.rarity} star`}>{imageUrl ? <img src={imageUrl} alt="" draggable={false} /> : <span aria-hidden="true">{operator.name.slice(0, 1)}</span>}</span>
}

function ReleasePreviewStrip({ label, preview }: { label: string; preview: ReleaseBoundPreview | null }): React.JSX.Element {
  if (!preview) return <div className="release-preview release-preview--empty">No matching release event</div>
  const representatives = [...preview.sixStar, ...preview.fiveStar]
  return <div className="release-preview"><div className="release-preview__meta"><span>{label}</span><strong>{preview.date}</strong></div><div className="release-preview__portraits">{representatives.length > 0 ? representatives.map((operator) => <RepresentativePortrait key={operator.id} operator={operator} />) : <span className="release-preview__none">No 6â˜…/5â˜… on this date</span>}</div></div>
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
    if (!releaseRa²È="24€½¹A½½±¡…¹• ¤(€€€€€½¹ÉÉ½È¡¹Õ±°¤(€€€€€½¹5•ÍÍ…”¡½Ý¹•ÉÍ¡¥Á¡…¹•(€€€€€€€€ü¹•áÐ¹½Ý¹•‘=Á•É…Ñ½ÉÍ=¹±ä(€€€€€€€€€€ü€=Ý¹•½Á•É…Ñ½ÉÌ½¹±ä•¹…‰±•¸U¹½Ý¹•½Á•É…Ñ½ÉÌÉ•µ…¥¸Ù¥Í¥‰±”¥¸ÕÉ…Ñ”‰ÕÐ…É”Õ¹…Ù…¥±…‰±”Ñ¼MÑ…¹‘…É…¹É…™Ð¸œ(€€€€€€€€€€è€=Ý¹•½Á•É…Ñ½ÉÌ½¹±ä‘¥Í…‰±•¸œ(€€€€€€€€è€=Á•É…Ñ½ÈÁ½½°ÕÁ‘…Ñ•¸œ¤(€€€ô(€ô(€½¹ÍÐÍ•Ñ1¥µ¥Ñ•‘±°€ô€¡¡•­•è‰½½±•…¸¤èÙ½¥€ôøµÕÑ…Ñ•¥±Ñ•ÉÌ ¡ÕÉÉ•¹Ð¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ð°…ÅÕ¥Í¥Ñ¥½¸èì€¸¸¹ÕÉÉ•¹Ð¹…ÅÕ¥Í¥Ñ¥½¸°±¥µ¥Ñ•è=‰©•Ð¹™É½µ¹ÑÉ¥•Ì¡±¥µ¥Ñ•‘ÅÕ¥Í¥Ñ¥½¹É½ÕÁÌ¹µ…À ¡É½ÕÀ¤€ôømÉ½ÕÀ°¡•­•‘t¤¤…ÌI…¹‘½µ¥é•É½¹ÍÑÉ…¥¹ÑÍl…ÅÕ¥Í¥Ñ¥½¸ul±¥µ¥Ñ•tôô¤¤(€½¹ÍÐÍ•Ñ]•±™…É•±°€ô€¡¡•­•è‰½½±•…¸¤èÙ½¥€ôøµÕÑ…Ñ•¥±Ñ•ÉÌ ¡ÕÉÉ•¹Ð¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ð°…ÅÕ¥Í¥Ñ¥½¸èì€¸¸¹ÕÉÉ•¹Ð¹…ÅÕ¥Í¥Ñ¥½¸°Ý•±™…É”è=‰©•Ð¹™É½µ¹ÑÉ¥•Ì¡Ý•±™…É•ÅÕ¥Í¥Ñ¥½¹É½ÕÁÌ¹µ…À ¡É½ÕÀ¤€ôømÉ½ÕÀ°¡•­•‘t¤¤…ÌI…¹‘½µ¥é•É½¹ÍÑÉ…¥¹ÑÍl…ÅÕ¥Í¥Ñ¥½¸ulÝ•±™…É”tôô¤¤(€½¹ÍÐÍ•Ñ½±±…‰½É…Ñ¥½¹±°€ô€¡¡•­•è‰½½±•…¸¤èÙ½¥€ôøµÕÑ…Ñ•¥±Ñ•ÉÌ ¡ÕÉÉ•¹Ð¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ð°½±±…‰½É…Ñ¥½¸èì¥¹±Õ‘•9½¹½±±…ˆè¡•­•°Í½ÕÉ•Ìè=‰©•Ð¹™É½µ¹ÑÉ¥•Ì¡½±±…‰½É…Ñ¥½¹M½ÕÉ•Ì¹µ…À ¡Í½ÕÉ”¤€ôømÍ½ÕÉ”°¡•­•‘t¤¤ôô¤¤((€½¹ÍÐÍ½ÕÉ•¥±Ñ•ÉÌ€ô€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í½ÕÉ”µ™¥±Ñ•Èµ±…å½ÕÐˆø(€€€€€€ñ™¥•±‘Í•Ð±…ÍÍ9…µ”ô‰½¹ÍÑÉ…¥¹ÐµÉ½ÕÀ‘•Ñ…¥°µÉ½ÕÀÍ½ÕÉ”µ™¥±Ñ•ÈµÉ½ÕÀˆø(€€€€€€€€ñ±••¹ùÅÕ¥Í¥Ñ¥½¸ð½±••¹ø(€€€€€€€€ñQÉ••É½ÕÀ±…‰•°ô‰1¥µ¥Ñ•ˆ¡•­•õí±¥µ¥Ñ•‘MÑ…Ñ”¹…±±ô¥¹‘•Ñ•Éµ¥¹…Ñ”õì…±¥µ¥Ñ•‘MÑ…Ñ”¹…±°€˜˜±¥µ¥Ñ•‘MÑ…Ñ”¹Í½µ•ô½¹¡…¹”õíÍ•Ñ1¥µ¥Ñ•‘±±ôùí±¥µ¥Ñ•‘ÅÕ¥Í¥Ñ¥½¹É½ÕÁÌ¹µ…À ¡É½ÕÀ¤€ôø€ñQÉ¥MÑ…Ñ•¡•­‰½à­•äõíÉ½ÕÁô±…‰•°õí±¥µ¥Ñ•‘1…‰•±ÍmÉ½ÕÁuô¡•­•õí½¹ÍÑÉ…¥¹ÑÌ¹…ÅÕ¥Í¥Ñ¥½¸¹±¥µ¥Ñ•‘mÉ½ÕÁuô½¹¡…¹”õì¡¡•­•¤€ôøµÕÑ…Ñ•¥±Ñ•ÉÌ ¡ÕÉÉ•¹Ð¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ð°…ÅÕ¥Í¥Ñ¥½¸èì€¸¸¹ÕÉÉ•¹Ð¹…ÅÕ¥Í¥Ñ¥½¸°±¥µ¥Ñ•èì€¸¸¹ÕÉÉ•¹Ð¹…ÅÕ¥Í¥Ñ¥½¸¹±¥µ¥Ñ•°mÉ½ÕÁtè¡•­•ôôô¤¥ô€¼ø¥ôð½QÉ••É½ÕÀø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í½ÕÉ”µÍÑ…¹‘…±½¹”ˆøñQÉ¥MÑ…Ñ•¡•­‰½à±…‰•°õìñÍÑÉ½¹œùMÑ…¹‘…Éð½ÍÑÉ½¹œùô¡•­•õí½¹ÍÑÉ…¥¹ÑÌ¹…ÅÕ¥Í¥Ñ¥½¸¹ÍÑ…¹‘…É‘ô½¹¡…¹”õì¡¡•­•¤€ôøµÕÑ…Ñ•¥±Ñ•ÉÌ ¡ÕÉÉ•¹Ð¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ð°…ÅÕ¥Í¥Ñ¥½¸èì€¸¸¹ÕÉÉ•¹Ð¹…ÅÕ¥Í¥Ñ¥½¸°ÍÑ…¹‘…Éè¡•­•ôô¤¥ô€¼øð½‘¥Øø(€€€€€€€€ñQÉ••É½ÕÀ±…‰•°ô‰]•±™…É”ˆ¡•­•õíÝ•±™…É•MÑ…Ñ”¹…±±ô¥¹‘•Ñ•Éµ¥¹…Ñ”õì…Ý•±™…É•MÑ…Ñ”¹…±°€˜˜Ý•±™…É•MÑ…Ñ”¹Í½µ•ô½¹¡…¹”õíÍ•Ñ]•±™…É•±±ôùíÝ•±™…É•ÅÕ¥Í¥Ñ¥½¹É½ÕÁÌ¹µ…À ¡É½ÕÀ¤€ôø€ñQÉ¥MÑ…Ñ•¡•­‰½à­•äõíÉ½ÕÁô±…‰•°õíÝ•±™…É•1…‰•±ÍmÉ½ÕÁuô¡•­•õí½¹ÍÑÉ…¥¹ÑÌ¹…ÅÕ¥Í¥Ñ¥½¸¹Ý•±™…É•mÉ½ÕÁuô½¹¡…¹”õì¡¡•­•¤€ôøµÕÑ…Ñ•¥±Ñ•ÉÌ ¡ÕÉÉ•¹Ð¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ð°…ÅÕ¥Í¥Ñ¥½¸èì€¸¸¹ÕÉÉ•¹Ð¹…ÅÕ¥Í¥Ñ¥½¸°Ý•±™…É”èì€¸¸¹ÕÉÉ•¹Ð¹…ÅÕ¥Í¥Ñ¥½¸¹Ý•±™…É”°mÉ½ÕÁtè¡•­•ôôô¤¥ô€¼ø¥ôð½QÉ••É½ÕÀø(€€€€€€ð½™¥•±‘Í•Ðø(€€€€€€ñ™¥•±‘Í•Ð±…ÍÍ9…µ”ô‰½¹ÍÑÉ…¥¹ÐµÉ½ÕÀ‘•Ñ…¥°µÉ½ÕÀÍ½ÕÉ”µ™¥±Ñ•ÈµÉ½ÕÀˆø(€€€€€€€€ñ±••¹ù½±±…‰½É…Ñ¥½¸Í½ÕÉ”ð½±••¹ø(€€€€€€€€ñQÉ••É½ÕÀ±…‰•°ô‰½±±…‰½É…Ñ¥½¸Á½½°ˆ¡•­•õí½±±…‰½É…Ñ¥½¹MÑ…Ñ”¹…±±ô¥¹‘•Ñ•Éµ¥¹…Ñ”õì…½±±…‰½É…Ñ¥½¹MÑ…Ñ”¹…±°€˜˜½±±…‰½É…Ñ¥½¹MÑ…Ñ”¹Í½µ•ô½¹¡…¹”õíÍ•Ñ½±±…‰½É…Ñ¥½¹±±ôøñQÉ¥MÑ…Ñ•¡•­‰½à±…‰•°ô‰9½¸µ½±±…ˆˆ¡•­•õí½¹ÍÑÉ…¥¹ÑÌ¹½±±…‰½É…Ñ¥½¸¹¥¹±Õ‘•9½¹½±±…‰ô½¹¡…¹”õì¡¡•­•¤€ôøµÕÑ…Ñ•¥±Ñ•ÉÌ ¡ÕÉÉ•¹Ð¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ð°½±±…‰½É…Ñ¥½¸èì€¸¸¹ÕÉÉ•¹Ð¹½±±…‰½É…Ñ¥½¸°¥¹±Õ‘•9½¹½±±…ˆè¡•­•ôô¤¥ô€¼ùí½±±…‰½É…Ñ¥½¹M½ÕÉ•Ì¹µ…À ¡Í½ÕÉ”¤€ôø€ñQÉ¥MÑ…Ñ•¡•­‰½à­•äõíÍ½ÕÉ•ô±…‰•°õíÍ½ÕÉ•ô¡•­•õí½¹ÍÑÉ…¥¹ÑÌ¹½±±…‰½É…Ñ¥½¸¹Í½ÕÉ•ÍmÍ½ÕÉ•t€üüÑÉÕ•ô½¹¡…¹”õì¡¡•­•¤€ôøµÕÑ…Ñ•¥±Ñ•ÉÌ ¡ÕÉÉ•¹Ð¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ð°½±±…‰½É…Ñ¥½¸èì€¸¸¹ÕÉÉ•¹Ð¹½±±…‰½É…Ñ¥½¸°Í½ÕÉ•Ìèì€¸¸¹ÕÉÉ•¹Ð¹½±±…‰½É…Ñ¥½¸¹Í½ÕÉ•Ì°mÍ½ÕÉ•tè¡•­•ôôô¤¥ô€¼ø¥ôð½QÉ••É½ÕÀø(€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰™¥±Ñ•Èµ¹½Ñ”ˆù½±±…ˆ…¡„½Õ¹ÑÌ…Ì1¥µ¥Ñ•ƒŠH½±±…ˆì½±±…ˆÝ•±™…É”½Õ¹ÑÌ…Ì]•±™…É”ƒŠHÙ•¹Ð€¼MÑ½Éä¸Q¡¥ÌÍ•Ñ¥½¸¥¹‘•Á•¹‘•¹Ñ±ä½¹ÑÉ½±ÌÝ¡¥ É½ÍÍ½Ù•ÈÍ½ÕÉ•Ìµ…ä•¹Ñ•ÈÑ¡”Á½½°¸ð½Àø(€€€€€€ð½™¥•±‘Í•Ðø(€€€€ð½‘¥Øø(€€¤((€É•ÑÕÉ¸€ (€€€€ðø(€€€€€€ñ¹…Ø±…ÍÍ9…µ”ô‰ÍÅÕ…µµ½‘”µÑ…‰Ìˆ…É¥„µ±…‰•°ô‰±½‰…°A½½°Í•Ñ¥½¸ˆø(€€€€€€€ì¡ml™¥±Ñ•Èœ°€±½‰…°¥±Ñ•Èt°lÕÉ…Ñ”œ°€ÕÉ…Ñ”ut…Ì½¹ÍÐ¤¹µ…À ¡mÍ•Ñ¥½¸°±…‰•±t¤€ôø€ (€€€€€€€€€€ñ‰ÕÑÑ½¸­•äõíÍ•Ñ¥½¹ôÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õí…Ñ¥Ù•M•Ñ¥½¸€ôôôÍ•Ñ¥½¸€ü€¥Ìµ…Ñ¥Ù”œ€è€œô…É¥„µÍ•±•Ñ•õí…Ñ¥Ù•M•Ñ¥½¸€ôôôÍ•Ñ¥½¹ô½¹±¥¬õì ¤€ôøÍ•ÑÑ¥Ù•M•Ñ¥½¸¡Í•Ñ¥½¸¥ôùí±…‰•±ôð½‰ÕÑÑ½¸ø(€€€€€€€€¤¥ô(€€€€€€ð½¹…Øø((€€€€€í…Ñ¥Ù•M•Ñ¥½¸€ôôô€™¥±Ñ•Èœ€˜˜€ (€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°½Á•É…Ñ½ÉÌµÁ…¹•°ˆ…É¥„µ±…‰•±±•‘‰äô‰½Á•É…Ñ½ÉÌµ¡•…‘¥¹œˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÍ9…µ”ô‰•å•‰É½ÜˆùMQU@ƒŠˆ1=	0A==0ƒŠˆ1=	0%1QHð½Àøñ È¥ô‰½Á•É…Ñ½ÉÌµ¡•…‘¥¹œˆù±½‰…°¥±Ñ•Èð½ Èøð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õíÉ•Í•Ñ¥±Ñ•ÉÍôùI•Í•Ð½Á•É…Ñ½È™¥±Ñ•ÉÌð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘¥Í…‰±•õí‰ÕÍäñð€…‘…Ñ…Í•Ñô½¹±¥¬õì ¤€ôøÙ½¥€¡ÕÁ‘…Ñ•¡•¬ü¹ÕÁ‘…Ñ•Ù…¥±…‰±”€ü½¹%¹ÍÑ…±±UÁ‘…Ñ” ¤€è½¹¡•­UÁ‘…Ñ•Ì ¤¥ôùí‰ÕÍä€ü€]½É­¥¹ŸŠ˜œ€èÕÁ‘…Ñ•¡•¬ü¹ÕÁ‘…Ñ•Ù…¥±…‰±”€ü€UÁ‘…Ñ”‘…Ñ„œ€è€¡•¬‘…Ñ„ÕÁ‘…Ñ•Ìôð½‰ÕÑÑ½¸øð½‘¥Øøð½‘¥Øø((€€€€€€€€€€ñ™¥•±‘Í•Ð±…ÍÍ9…µ”ô‰½¹ÍÑÉ…¥¹ÐµÉ½ÕÀ‘•Ñ…¥°µÉ½ÕÀÉ•±•…Í”µÉ½ÕÀˆø(€€€€€€€€€€€€ñ±••¹ùI•±•…Í”ð½±••¹ø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É•±•…Í”µ‰½Õ¹‘ÌµÉ¥ˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É•±•…Í”µ‰½Õ¹µ…Éˆøñ Ìù5¥¹¥µÕ´‰½Õ¹ð½ Ìøñ±…‰•°±…ÍÍ9…µ”ô‰™¥•±ˆøñÍÁ…¸ùI•±•…Í”É½ÕÀð½ÍÁ…¸øñÍ•±•ÐÙ…±Õ”õíÉ•±•…Í•É½ÕÁM•±•ÑY…±Õ”¡½¹ÍÑÉ…¥¹ÑÌ¹É•±•…Í”¹µ¥¹e•…È°½¹ÍÑÉ…¥¹ÑÌ¹É•±•…Í”¹µ¥¹…Ñ”¥ô½¹¡…¹”õì¡•Ù•¹Ð¤€ôø¡…¹•I•±•…Í•É½ÕÀ µ¥¸œ°•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ôøñ½ÁÑ¥½¸Ù…±Õ”ôˆˆù¹äð½½ÁÑ¥½¸øñ½ÁÑ¥½¸Ù…±Õ”ô‰ÕÍÑ½´ˆ‘¥Í…‰±•ùÕÍÑ½´ð½½ÁÑ¥½¸ùíÉ•±•…Í•e•…É=ÁÑ¥½¹Ì¹µ…À ¡å•…È¤€ôø€ñ½ÁÑ¥½¸­•äõíå•…ÉôÙ…±Õ”õíå•…ÉôùíÉ•±•…Í•É½ÕÁ1…‰•°¡å•…È¥ôð½½ÁÑ¥½¸ø¥ôð½Í•±•Ðøð½±…‰•°øñ±…‰•°±…ÍÍ9…µ”ô‰™¥•±ˆøñÍÁ…¸ùá…Ð‘…Ñ”™±½½Èð½ÍÁ…¸øñ¥¹ÁÕÐ±…ÍÍ9…µ”ô‰‘…Ñ”µ¥¹ÁÕÐˆÑåÁ”ô‰‘…Ñ”ˆÙ…±Õ”õí½¹ÍÑÉ…¥¹ÑÌ¹É•±•…Í”¹µ¥¹…Ñ•ô½¹¡…¹”õì¡•Ù•¹Ð¤€ôø½µµ¥ÑI•±•…Í•¡…¹”¡…ÁÁ±åÕÍÑ½µI•±•…Í•…Ñ”¡½¹ÍÑÉ…¥¹ÑÌ¹É•±•…Í”°€µ¥¸œ°•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¤¥ô€¼øð½±…‰•°øñI•±•…Í•AÉ•Ù¥•ÝMÑÉ¥À±…‰•°ô‰MÑ…ÉÑÌ…Ð•Ù•¹ÐˆÁÉ•Ù¥•Üõíµ¥¹I•±•…Í•AÉ•Ù¥•Ýô€¼øð½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É•±•…Í”µ‰½Õ¹µ…Éˆøñ Ìù5…á¥µÕ´‰½Õ¹ð½ Ìøñ±…‰•°±…ÍÍ9…µ”ô‰™¥•±ˆøñÍÁ…¸ùI•±•…Í”É½ÕÀð½ÍÁ…¸øñÍ•±•ÐÙ…±Õ”õíÉ•±•…Í•É½ÕÁM•±•ÑY…±Õ”¡½¹ÍÑÉ…¥¹ÑÌ¹É•±•…Í”¹µ…áe•…È°½¹ÍÑÉ…¥¹ÑÌ¹É•±•…Í”¹µ…á…Ñ”¥ô½¹¡…¹”õì¡•Ù•¹Ð¤€ôø¡…¹•I•±•…Í•É½ÕÀ µ…àœ°•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ôøñ½ÁÑ¥½¸Ù…±Õ”ôˆˆù¹äð½½ÁÑ¥½¸øñ½ÁÑ¥½¸Ù…±Õ”ô‰ÕÍÑ½´ˆ‘¥Í…‰±•ùÕÍÑ½´ð½½ÁÑ¥½¸ùíÉ•±•…Í•e•…É=ÁÑ¥½¹Ì¹µ…À ¡å•…È¤€ôø€ñ½ÁÑ¥½¸­•äõíå•…ÉôÙ…±Õ”õíå•…ÉôùíÉ•±•…Í•É½ÕÁ1…‰•°¡å•…È¥ôð½½ÁÑ¥½¸ø¥ôð½Í•±•Ðøð½±…‰•°øñ±…‰•°±…ÍÍ9…µ”ô‰™¥•±ˆøñÍÁ…¸ùá…Ð‘…Ñ”•¥±¥¹œð½ÍÁ…¸øñ¥¹ÁÕÐ±…ÍÍ9…µ”ô‰‘…Ñ”µ¥¹ÁÕÐˆÑåÁ”ô‰‘…Ñ”ˆÙ…±Õ”õí½¹ÍÑÉ…¥¹ÑÌ¹É•±•…Í”¹µ…á…Ñ•ô½¹¡…¹”õì¡•Ù•¹Ð¤€ôø½µµ¥ÑI•±•…Í•¡…¹”¡…ÁÁ±åÕÍÑ½µI•±•…Í•…Ñ”¡½¹ÍÑÉ…¥¹ÑÌ¹É•±•…Í”°€µ…àœ°•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¤¥ô€¼øð½±…‰•°øñI•±•…Í•AÉ•Ù¥•ÝMÑÉ¥À±…‰•°ô‰¹‘Ì…Ð•Ù•¹ÐˆÁÉ•Ù¥•Üõíµ…áI•±•…Í•AÉ•Ù¥•Ýô€¼øð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰™¥±Ñ•Èµ¹½Ñ”ˆùA½ÉÑÉ…¥ÑÌ½µ”½¹±ä™É½´Ñ¡”•á…Ð½Á•É…Ñ½ÈµÉ•±•…Í”•Ù•¹Ð…Ð•… ‰½Õ¹¸1…Õ¹ ¥Ì±…Õ¹ ‘…ä½¹±äì±…Ñ•ÈÉ½ÕÁÌ¥¹É•µ•¹Ð…Ð…¹¹¥Ù•ÉÍ…ÉäÉ•±•…Í”‰½Õ¹‘…É¥•Ì¸9…µ•É½ÕÁÌÁÉ•™¥±°Ñ¡•¥È•á…ÐÉ•¥½¹…°‘…Ñ”‰½Õ¹‘Ììµ…¹Õ…±±ä•‘¥Ñ¥¹œ„‘…Ñ”¡…¹•ÌÑ¡…ÐÍ¥‘”Ñ¼ÕÍÑ½´¸I•¥½¸½µ•Ì™É½´=ÁÑ¥½¹Ì¸ð½Àø(€€€€€€€€€€ð½™¥•±‘Í•Ðø((€€€€€€€€€í‘…Ñ…Í•Ð€˜˜€ñ=Á•É…Ñ½É¥±Ñ•ÉÌ‘…Ñ…Í•Ðõí‘…Ñ…Í•Ñô½¹ÍÑÉ…¥¹ÑÌõí½¹ÍÑÉ…¥¹ÑÍô½¹¡…¹”õíµÕÑ…Ñ•¥±Ñ•ÉÍô…™Ñ•ÉÉ„õíÍ½ÕÉ•¥±Ñ•ÉÍô€¼ùô((€€€€€€€€€í‘…Ñ…Í•Ð€˜˜€…Ù…±¥‘…Ñ¥½¸¹Ù…±¥€˜˜Ù…±¥‘…Ñ¥½¸¹•ÉÉ½ÉÌ¹±•¹Ñ €ø€À€˜˜€ñY…±¥‘…Ñ¥½¹	½à•ÉÉ½ÉÌõíÙ…±¥‘…Ñ¥½¸¹•ÉÉ½ÉÍô€¼ùô(€€€€€€€€ð½Í•Ñ¥½¸ø(€€€€€€¥ô((€€€€€í…Ñ¥Ù•M•Ñ¥½¸€ôôô€ÕÉ…Ñ”œ€˜˜‘…Ñ…Í•Ð€˜˜€ (€€€€€€€€ñA½½±A…¹•°‘…Ñ…Í•Ðõí‘…Ñ…Í•Ñô½¹ÍÑÉ…¥¹ÑÌõí½¹ÍÑÉ…¥¹ÑÍôÁÉ•™•É•¹•ÌõíÁÉ•™•É•¹•Íô½¹AÉ•™•É•¹•Í¡…¹”õíÕÁ‘…Ñ•A½½±AÉ•™•É•¹•Íô€¼ø(€€€€€€¥ô(€€€€ð¼ø(€€¤)ô(