import { useEffect, useState } from 'react'
import { operatorClasses } from '../../shared/operator'
import { releaseGroupLabel } from '../../shared/releaseBounds'
import type { ImportedArknightsAccount } from '../../shared/arknightsAccount'
import { importedAccountOperatorState } from '../../shared/arknightsAccountReconciliation'
import { resolveAppearanceChoice } from './operatorAppearance'

function PoolAvatar({ operator, choice, randomSeed, accountAppearance }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const resolved = resolveAppearanceChoice(operator, choice, randomSeed, accountAppearance)
  useEffect(() => {
    let active = true
    setImageUrl(null)
    let request
    if (resolved.startsWith('skin:')) {
      const skinId = resolved.slice(5)
      const skin = operator.skins?.find((candidate) => candidate.id === skinId)
      request =
        skin?.isDefault && skin.avatarId
          ? window.desktop.getOperatorAvatarAsset(skin.avatarId)
          : window.desktop.getOperatorSkinAvatar(operator.id, skinId)
    } else {
      const arts = operator.defaultArts ?? []
      const art =
        resolved === 'e2'
          ? (arts.find((candidate) => candidate.phase === 2) ?? arts.at(-1))
          : (arts.find((candidate) => candidate.phase === 0) ?? arts[0])
      const promotionArt = resolved === 'e2' ? 'e2' : 'e1'
      request = art?.avatarId
        ? window.desktop.getOperatorAvatarAsset(art.avatarId)
        : window.desktop.getOperatorPromotionAvatar(operator.id, promotionArt)
    }
    void request.then((next) => {
      if (active) setImageUrl(next)
    })
    return () => {
      active = false
    }
  }, [operator, resolved])
  return imageUrl ? (
    <img className="pool-avatar" src={imageUrl} alt="" draggable={false} />
  ) : (
    <span className="pool-avatar pool-avatar--fallback" aria-hidden="true">
      {operator.name.slice(0, 1)}
    </span>
  )
}
function acquisitionLabel(operator) {
  switch (operator.acquisition.family) {
    case 'limited':
      return 'Limited'
    case 'standard':
      return 'Standard'
    case 'welfare':
      return 'Welfare'
    default:
      return 'Unknown'
  }
}
function mainFactionLabel(operator, dataset) {
  const chain = operator.faction.primary ?? (operator.faction.main ? [operator.faction.main] : [])
  const labels = chain.map((id) => dataset.factionLabels[id] ?? id)
  if (labels.length === 0) return 'Unaffiliated'
  if (labels.length === 1) return labels[0]
  return `${labels[0]} (${labels.at(-1)})`
}
function operatorRaceLabel(operator, raceLabels) {
  const raceIds = operator.raceIds ?? []
  if (raceIds.length === 0) return raceLabels?.['race:unavailable'] ?? 'Unavailable'
  return raceIds.map((id) => raceLabels?.[id] ?? id).join(', ')
}
function accountStateLabel(operator, importedAccount: ImportedArknightsAccount | null | undefined) {
  if (!importedAccount) return 'Not Owned'
  const state = importedAccountOperatorState(importedAccount, operator.id)
  return state ? `E${state.elite}` : 'Not Owned'
}
function groupLabel(
  operator,
  groupBy,
  dataset,
  constraints,
  importedAccount: ImportedArknightsAccount | null | undefined = null,
) {
  switch (groupBy) {
    case 'class':
      return dataset.classLabels?.[operator.class] ?? operator.class
    case 'rarity':
      return `${operator.rarity}★`
    case 'releaseYear': {
      const year = operator.release[constraints.release.server].yearGroup
      return year === null ? 'Unknown release group' : releaseGroupLabel(year)
    }
    case 'mainFaction':
      return mainFactionLabel(operator, dataset)
    case 'acquisition':
      return acquisitionLabel(operator)
    case 'accountState':
      return accountStateLabel(operator, importedAccount)
    case 'none':
      return 'All operators'
  }
}
function compareDefaultOperators(left, right) {
  if (left.rarity !== right.rarity) return right.rarity - left.rarity
  const classDifference = operatorClasses.indexOf(left.class) - operatorClasses.indexOf(right.class)
  if (classDifference !== 0) return classDifference
  return left.name.localeCompare(right.name)
}
function comparePoolOperators(left, right, sort, constraints) {
  if (sort === 'alphabetical') return left.name.localeCompare(right.name)
  if (sort === 'releaseDate') {
    const leftDate = left.release[constraints.release.server].date
    const rightDate = right.release[constraints.release.server].date
    if (leftDate && rightDate && leftDate !== rightDate) return leftDate.localeCompare(rightDate)
    if (leftDate && !rightDate) return -1
    if (!leftDate && rightDate) return 1
  }
  return compareDefaultOperators(left, right)
}
function groupOrderValue(label, operators, groupBy, constraints) {
  if (groupBy === 'class') return operatorClasses.indexOf(operators[0]?.class)
  if (groupBy === 'rarity') return operators[0]?.rarity ?? 0
  if (groupBy === 'releaseYear') {
    return operators[0]?.release[constraints.release.server].yearGroup ?? Number.MAX_SAFE_INTEGER
  }
  if (groupBy === 'accountState') {
    return { E0: 0, E1: 1, E2: 2, 'Not Owned': 3 }[label] ?? Number.MAX_SAFE_INTEGER
  }
  return label.toLocaleLowerCase()
}
function comparePoolGroups(leftEntry, rightEntry, groupBy, constraints, direction) {
  const [leftLabel, leftOperators] = leftEntry
  const [rightLabel, rightOperators] = rightEntry
  const left = groupOrderValue(leftLabel, leftOperators, groupBy, constraints)
  const right = groupOrderValue(rightLabel, rightOperators, groupBy, constraints)
  const comparison =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right), void 0, { numeric: true })
  return direction === 'asc' ? comparison : -comparison
}
function collapseAllPoolGroups(groups) {
  return new Set(groups.map(([label]) => label))
}
function expandAllPoolGroups() {
  return new Set()
}
function OperatorEntry({
  operator,
  factionLabel,
  raceLabel,
  classLabel,
  included,
  presentation,
  appearanceChoice,
  appearanceRandomSeed,
  accountAppearance,
  appearanceName,
  onToggle,
  onAppearance,
}) {
  const stateLabel = included ? 'Included' : 'Excluded'
  const commonProps = {
    type: 'button' as const,
    'aria-pressed': included,
    'aria-label': `${operator.name}, ${stateLabel}`,
    title: `${operator.name} — ${stateLabel}`,
    onClick: onToggle,
    'data-rarity': operator.rarity,
  }
  const avatar = (
    <PoolAvatar
      operator={operator}
      choice={appearanceChoice}
      randomSeed={appearanceRandomSeed}
      accountAppearance={accountAppearance}
    />
  )
  let entry
  if (presentation === 'imageGrid') {
    entry = (
      <button
        {...commonProps}
        className={`pool-entry pool-entry--image${included ? '' : ' is-excluded'}`}
      >
        {avatar}
      </button>
    )
  } else if (presentation === 'compactCard') {
    entry = (
      <button
        {...commonProps}
        className={`pool-entry pool-entry--compact${included ? '' : ' is-excluded'}`}
      >
        {avatar}
        <span className="pool-entry-copy">
          <strong>{operator.name}</strong>
        </span>
        <span className="pool-entry-status">{stateLabel}</span>
      </button>
    )
  } else if (presentation === 'simpleList') {
    entry = (
      <button
        {...commonProps}
        className={`pool-entry pool-entry--list${included ? '' : ' is-excluded'}`}
      >
        {avatar}
        <strong>{operator.name}</strong>
        <span className="pool-entry-status">{stateLabel}</span>
      </button>
    )
  } else {
    entry = (
      <button
        {...commonProps}
        className={`pool-entry pool-entry--detailed${included ? '' : ' is-excluded'}`}
      >
        {avatar}
        <span className="pool-entry-copy">
          <strong>{operator.name}</strong>
          <small>
            {operator.rarity}★ · {classLabel} · {operator.subclass.name}
          </small>
          <small>Main faction: {factionLabel}</small>
          <small>Race: {raceLabel}</small>
        </span>
        <span className="pool-entry-status">{stateLabel}</span>
      </button>
    )
  }
  return (
    <div className={`pool-entry-shell pool-entry-shell--${presentation}`}>
      {entry}
      <button
        type="button"
        className="pool-appearance-button"
        onClick={onAppearance}
        aria-label={`Choose artwork for ${operator.name}`}
        title={`${operator.name} artwork: ${appearanceName}`}
      >
        Art
      </button>
    </div>
  )
}

export {
  accountStateLabel,
  collapseAllPoolGroups,
  comparePoolGroups,
  comparePoolOperators,
  expandAllPoolGroups,
  mainFactionLabel,
  OperatorEntry,
  operatorRaceLabel,
  groupLabel,
}
