import { useEffect, useId, useState } from 'react'
import {
  operatorClasses,
  type Operator,
  type OperatorClass,
  type ReleaseServer,
} from '../../shared/operator'
import {
  generateISOpening,
  randomizeISOpening,
  randomChoice,
  isOpeningThemesForRegion,
  isThemeAvatarUrl,
  IS_RANDOM_VOUCHER_SET_ID,
  IS_VOUCHER_CLASSES,
  IS_OPENING_STRATEGIES,
  isOpeningDifficultyLabel,
  isOpeningDifficultyLevels,
  isOpeningSelectionCosts,
  isOpeningConflicts,
  isSquadArtUrl,
  isVoucherArtUrl,
  isVoucherSetArtUrl,
  type ISOpeningResult,
  type ISOpeningStrategy,
} from '../../shared/isOpening'
import {
  isOpeningPool,
  matchesISVoucher,
  isISTemporaryOperator,
} from '../../shared/isOpeningTemporaryOperators'
import OperatorCard from './OperatorCard'
import OperatorSelector, { type OperatorSelectorOption } from './OperatorSelector'
import ClassIcon from './ClassIcon'
import EventSelectorDropdown from './EventSelectorDropdown'
import SquadShareButton from './SquadShareButton'
import './ISOpeningFeature.css'

const lockIcon = new URL('./assets/draft/locked-slot-icon.png', import.meta.url).href
const hopeIcon = new URL('./assets/hope.webp', import.meta.url).href

const strategyDescriptions: Record<ISOpeningStrategy, string> = {
  'true-random': 'Every valid opening has an equal chance, within the available Hope.',
  'squad-six':
    'Tries a squad-associated 6★ first, then fills the other slots randomly within the available Hope.',
  greedy:
    'Locks a random feasible 5★ or 6★ first, then maximizes Hope spending. Free slots favor non-reserve operators and higher rarity.',
  'exhaust-hope':
    'Maximizes total Hope spending without a first pick. Free slots favor non-reserve operators and higher rarity.',
}

function GameArt({ src, alt }: { src: string; alt: string }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  return failed ? (
    <span className="is-opening__art-unavailable">Artwork unavailable</span>
  ) : (
    <img src={src} alt={alt} draggable={false} onError={() => setFailed(true)} />
  )
}

function KeepButton({
  label,
  kept,
  onClick,
}: {
  label: string
  kept: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="draft-operator-action"
      aria-label={`Keep ${label}`}
      aria-pressed={kept}
      onClick={onClick}
    >
      {kept && <img className="is-opening__padlock" src={lockIcon} alt="" />}Keep
    </button>
  )
}

export default function ISOpeningFeature({
  operators,
  metadataRegion,
  alterExclusivity,
  ready,
  onMessage,
  onError,
}: {
  operators: readonly Operator[]
  metadataRegion: ReleaseServer
  alterExclusivity: boolean
  ready: boolean
  onMessage: (message: string) => void
  onError: (message: string | null) => void
}): React.JSX.Element {
  const themes = isOpeningThemesForRegion(metadataRegion)
  const [themeId, setThemeId] = useState(themes[0].id)
  const theme = themes.find((value) => value.id === themeId)!
  const leader = theme.squads.find((value) => value.name === 'Leader Squad') ?? theme.squads[0]
  const [squadId, setSquadId] = useState(leader.id)
  const [voucherSetId, setVoucherSetId] = useState(theme.voucherSets[0].id)
  const [voucherChoices, setVoucherChoices] = useState<(OperatorClass | '')[]>(['', '', ''])
  const [strategy, setStrategy] = useState<ISOpeningStrategy>('true-random')
  const strategyHelpId = useId()
  const selectedStrategy = IS_OPENING_STRATEGIES.find((value) => value.id === strategy)!
  const [startingHope, setStartingHope] = useState(6)
  const [difficultyLevel, setDifficultyLevel] = useState(0)
  const [selected, setSelected] = useState<(Operator | null)[]>([null, null, null])
  const [keptSlots, setKeptSlots] = useState([false, false, false])
  const [keptSquad, setKeptSquad] = useState(false)
  const [keptVouchers, setKeptVouchers] = useState(false)
  const [revision, setRevision] = useState(0)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)
  const [picker, setPicker] = useState<{ kind: 'class' | 'operator'; slot: number } | null>(null)
  const squad = theme.squads.find((value) => value.id === squadId) ?? leader
  const pool = isOpeningPool(operators)
  const current = selected.map((op) =>
    op && pool.some((candidate) => candidate.id === op.id) ? op : null,
  )
  const randomVouchers = voucherSetId === IS_RANDOM_VOUCHER_SET_ID
  const classes = randomVouchers ? voucherChoices : IS_VOUCHER_CLASSES[voucherSetId]
  const canRandomize = ready && classes.every(Boolean)
  const canRandomizeAll = ready && (!randomVouchers || (canRandomize && keptVouchers))
  const costs = isOpeningSelectionCosts(current, theme, squad, voucherSetId, difficultyLevel)
  const spent = costs.reduce((sum, cost) => sum + cost, 0)
  const budget = startingHope + squad.hopeBonus
  const keptOperatorIds = current.map((op, index) => (keptSlots[index] ? (op?.id ?? null) : null))
  const fixedOperatorIds = keptOperatorIds

  useEffect(() => {
    if (!picker) return
    const close = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setPicker(null)
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [picker])

  const clearOpening = (): void => {
    setGeneratedAt(null)
    setSelected([null, null, null])
    setKeptSlots([false, false, false])
    if (randomVouchers) setVoucherChoices(['', '', ''])
    onError(null)
  }
  const changeBudget = (hope: number, difficulty: number): void => {
    const preserved = current.map((op, index) => (fixedOperatorIds[index] ? op : null))
    if (
      isOpeningSelectionCosts(preserved, theme, squad, voucherSetId, difficulty).reduce(
        (sum, cost) => sum + cost,
        0,
      ) >
      hope + squad.hopeBonus
    ) {
      onError('Kept operators exceed the new Hope budget. Release Keep or clear a slot first.')
      return
    }
    setStartingHope(hope)
    setDifficultyLevel(difficulty)
    setSelected(preserved)
    onError(null)
  }
  const reportError = (error: unknown): void =>
    onError(error instanceof Error ? error.message : String(error))
  const showResult = (result: ISOpeningResult): void => {
    setGeneratedAt(new Date())
    setSelected(result.operators)
    setRevision((value) => value + 1)
    onError(null)
    onMessage(`${theme.name}: opening randomized.`)
  }
  const randomizeOperators = (): void => {
    try {
      showResult(
        generateISOpening({
          operators,
          squad,
          voucherSetId,
          strategy,
          alterExclusivity,
          themeId,
          startingHope,
          difficultyLevel,
          voucherClasses: classes.filter((c) => c !== ''),
          fixedOperatorIds,
        }),
      )
    } catch (error) {
      reportError(error)
    }
  }
  const selectionReason = (op: Operator, slot: number): string | undefined => {
    const others = current.filter(
      (value, index): value is Operator => index !== slot && value !== null,
    )
    if (isOpeningConflicts(op, others, alterExclusivity))
      return 'Already selected or conflicts with another operator'
    const next = current.map((value, index) => (index === slot ? op : value))
    if (
      isOpeningSelectionCosts(next, theme, squad, voucherSetId, difficultyLevel).reduce(
        (sum, cost) => sum + cost,
        0,
      ) > budget
    )
      return 'Not enough Hope'
    return undefined
  }
  const selectOperator = (op: Operator, slot: number, keep = false): void => {
    setKeptSlots((slots) => slots.map((value, index) => (index === slot ? keep : value)))
    setGeneratedAt(new Date())
    setSelected(current.map((value, index) => (index === slot ? op : value)))
    setRevision((value) => value + 1)
    onError(null)
  }
  const clearOperator = (slot: number, clearVoucher = false): void => {
    setSelected(current.map((op, index) => (index === slot ? null : op)))
    setKeptSlots((slots) => slots.map((value, index) => (index === slot ? false : value)))
    if (clearVoucher)
      setVoucherChoices((values) => values.map((value, index) => (index === slot ? '' : value)))
    onError(null)
    onMessage(`Slot ${slot + 1} cleared.`)
  }
  const rerollOperator = (slot: number): void => {
    try {
      if (current.every(Boolean)) {
        const result = generateISOpening({
          operators,
          squad,
          voucherSetId,
          strategy,
          alterExclusivity,
          themeId,
          startingHope,
          difficultyLevel,
          voucherClasses: classes.filter((c) => c !== ''),
          fixedOperatorIds: current.map((op, index) => (index === slot ? null : op!.id)),
          excludedOperatorIdsBySlot: current.map((op, index) => (index === slot ? op!.id : null)),
        })
        selectOperator(result.operators[slot], slot)
        return
      }
      const candidates = pool.filter(
        (op) =>
          op.id !== current[slot]?.id &&
          classes[slot] &&
          matchesISVoucher(op, classes[slot] as OperatorClass) &&
          !selectionReason(op, slot),
      )
      const preferred = candidates.filter(
        (op) =>
          op.rarity === 6 &&
          squad.classes.includes(op.class) &&
          (!squad.subclasses || squad.subclasses.includes(op.subclass.id)),
      )
      let choices = candidates
      if (strategy === 'squad-six' && preferred.length) choices = preferred
      if (strategy === 'greedy' || strategy === 'exhaust-hope') {
        const initial = strategy === 'greedy' ? candidates.filter((op) => op.rarity >= 5) : []
        if (initial.length) choices = initial
        else {
          const priced = candidates.map((op) => {
            const prices = isOpeningSelectionCosts(
              current.map((value, index) => (index === slot ? op : value)),
              theme,
              squad,
              voucherSetId,
              difficultyLevel,
            )
            return {
              op,
              spent: prices.reduce((sum, cost) => sum + cost, 0),
              free: prices[slot] === 0,
            }
          })
          const maximum = Math.max(...priced.map((value) => value.spent))
          const optimal = priced.filter((value) => value.spent === maximum)
          choices = optimal.map((value) => value.op)
          if (optimal.every((value) => value.free)) {
            const regular = choices.filter((op) => !isISTemporaryOperator(op))
            if (regular.length) choices = regular
            const rarity = Math.max(...choices.map((op) => op.rarity))
            choices = choices.filter((op) => op.rarity === rarity)
          }
        }
      }
      selectOperator(randomChoice(choices), slot)
    } catch {
      onError('No other operator fits this voucher and the remaining Hope.')
    }
  }
  const chooseSquad = (id: string): boolean => {
    const next = theme.squads.find((s) => s.id === id)!
    const preserved = current
    if (
      isOpeningSelectionCosts(preserved, theme, next, voucherSetId, difficultyLevel).reduce(
        (sum, cost) => sum + cost,
        0,
      ) >
      startingHope + next.hopeBonus
    ) {
      onError('Selected operators exceed this squad’s Hope. Reroll an operator or increase Hope.')
      return false
    }
    setSquadId(id)
    setSelected(preserved)
    onError(null)
    return true
  }
  const chooseVouchers = (id: string): boolean => {
    const nextClasses = id === IS_RANDOM_VOUCHER_SET_ID ? voucherChoices : IS_VOUCHER_CLASSES[id]
    if (
      current.some(
        (op, index) =>
          op &&
          keptSlots[index] &&
          (!nextClasses[index] || !matchesISVoucher(op, nextClasses[index])),
      )
    ) {
      onError('This voucher set does not match the kept operators. Release their Keep first.')
      return false
    }
    const preserved = current.map((op, index) =>
      op && nextClasses[index] && matchesISVoucher(op, nextClasses[index]) ? op : null,
    )
    if (
      isOpeningSelectionCosts(preserved, theme, squad, id, difficultyLevel).reduce(
        (sum, cost) => sum + cost,
        0,
      ) > budget
    ) {
      onError('Selected operators exceed this voucher set’s Hope. Reroll an operator first.')
      return false
    }
    setVoucherSetId(id)
    setSelected(preserved)
    onError(null)
    return true
  }
  const operatorOptions: OperatorSelectorOption[] =
    picker?.kind === 'operator'
      ? pool
          .filter(
            (op) =>
              classes[picker.slot] && matchesISVoucher(op, classes[picker.slot] as OperatorClass),
          )
          .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))
          .map((op) => {
            const disabledReason = selectionReason(op, picker.slot)
            return {
              key: op.id,
              label: op.name,
              operator: op,
              aliases: [
                op.subclass.name,
                ...(isISTemporaryOperator(op)
                  ? ['Temporary', op.rarity === 3 ? 'Reserve' : 'Elite']
                  : []),
              ],
              disabled: Boolean(disabledReason),
              disabledReason,
            }
          })
      : []

  return (
    <section className="panel squad-panel is-opening" aria-label="IS Opening">
      <div className="preset-toolbar is-opening__toolbar">
        <div className="field is-opening__inline-field is-opening__theme">
          <span>THEME</span>
          <EventSelectorDropdown
            label="Theme"
            showLabel={false}
            value={themeId}
            options={themes.map((value) => ({
              id: value.id,
              name: `IS${value.number}: ${value.name}`,
              representative: null,
              imageUrl: isThemeAvatarUrl(value),
              imageKind: 'avatar',
            }))}
            onChange={(id) => {
              const next = themes.find((value) => value.id === id)!
              setThemeId(next.id)
              setSquadId(
                next.squads.find((value) => value.name === 'Leader Squad')?.id ?? next.squads[0].id,
              )
              setVoucherSetId(next.voucherSets[0].id)
              setVoucherChoices(['', '', ''])
              setDifficultyLevel(0)
              setKeptSquad(false)
              setKeptVouchers(false)
              setPicker(null)
              clearOpening()
              return true
            }}
          />
        </div>
        <label className="field is-opening__difficulty">
          <select
            aria-label="Difficulty Level"
            value={difficultyLevel}
            onChange={(event) => {
              changeBudget(startingHope, Number(event.target.value))
            }}
          >
            {isOpeningDifficultyLevels(themeId).map((level) => (
              <option key={level} value={level}>
                {isOpeningDifficultyLabel(themeId, level)}
              </option>
            ))}
          </select>
        </label>
        <div className="is-opening__toolbar-actions">
          <SquadShareButton
            result={
              generatedAt && current.every(Boolean)
                ? {
                    mode: 'IS Opening',
                    generatedAt,
                    members: current,
                    opening: {
                      theme: `IS${theme.number}: ${theme.name}`,
                      squad: squad.name,
                      squadIconUrl: isSquadArtUrl(squad),
                      voucherSet: theme.voucherSets.find((set) => set.id === voucherSetId)!.name,
                      voucherSetIconUrl: isVoucherSetArtUrl(voucherSetId),
                      startingHope,
                    },
                  }
                : null
            }
          />
          <button
            type="button"
            className="randomize-button"
            disabled={!canRandomizeAll}
            onClick={() => {
              try {
                const next = randomizeISOpening({
                  operators,
                  themeId,
                  startingHope,
                  difficultyLevel,
                  strategy,
                  alterExclusivity,
                  keptSquadId: keptSquad ? squad.id : undefined,
                  keptVoucherSetId: keptVouchers ? voucherSetId : undefined,
                  voucherClasses: voucherChoices.filter((c) => c !== ''),
                  fixedOperatorIds: keptOperatorIds,
                })
                setSquadId(next.squadId)
                setVoucherSetId(next.voucherSetId)
                showResult(next.result)
              } catch (error) {
                reportError(error)
              }
            }}
          >
            Randomize All
          </button>
        </div>
      </div>
      <div className="is-opening__columns">
        <div className="is-opening__squad" role="group" aria-label="Squad setup">
          <EventSelectorDropdown
            label="Squad"
            value={squad.id}
            groups={['Class Squads', 'Non-Class Squads']}
            options={[...theme.squads]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((value) => ({
                id: value.id,
                name: value.name,
                representative: null,
                imageUrl: isSquadArtUrl(value),
                group: value.classes.length ? 'Class Squads' : 'Non-Class Squads',
              }))}
            onChange={(id) => {
              return chooseSquad(id)
            }}
          />
          <div className="is-opening__squad-details">
            <div className="is-opening__squad-art">
              <GameArt key={squad.id} src={isSquadArtUrl(squad)} alt={squad.name} />
            </div>
            <p className="is-opening__squad-description">{squad.description}</p>
          </div>
          <div className="draft-operator-actions is-opening__choice-actions is-opening__control-box">
            <button
              className="draft-operator-action draft-operator-action--pick"
              type="button"
              aria-label="Reroll squad"
              disabled={!ready || keptSquad}
              onClick={() => {
                const candidates = theme.squads.filter(
                  (s) =>
                    s.id !== squad.id &&
                    isOpeningSelectionCosts(
                      current,
                      theme,
                      s,
                      voucherSetId,
                      difficultyLevel,
                    ).reduce((sum, cost) => sum + cost, 0) <=
                      startingHope + s.hopeBonus,
                )
                if (candidates.length) chooseSquad(randomChoice(candidates).id)
                else onError('No other squad fits the kept operators and Hope.')
              }}
            >
              Reroll
            </button>
            <KeepButton
              label="squad"
              kept={keptSquad}
              onClick={() => setKeptSquad((value) => !value)}
            />
          </div>
        </div>
        <div className="is-opening__recruitment">
          <div className="is-opening__voucher-toolbar">
            <div className="is-opening__voucher-picker">
              <EventSelectorDropdown
                label="Voucher set"
                value={voucherSetId}
                options={theme.voucherSets.map((set) => ({
                  id: set.id,
                  name: set.name,
                  representative: null,
                  imageUrl: isVoucherSetArtUrl(set.id),
                }))}
                onChange={chooseVouchers}
              />
            </div>
            <div className="draft-operator-actions is-opening__choice-actions">
              <button
                className="draft-operator-action draft-operator-action--pick"
                type="button"
                aria-label="Reroll voucher set"
                disabled={!ready || keptVouchers}
                onClick={() => {
                  const candidates = theme.voucherSets.filter(
                    (set) =>
                      set.id !== voucherSetId &&
                      set.id !== IS_RANDOM_VOUCHER_SET_ID &&
                      current.every(
                        (op, i) =>
                          !op ||
                          !keptSlots[i] ||
                          matchesISVoucher(op, IS_VOUCHER_CLASSES[set.id][i]),
                      ),
                  )
                  if (candidates.length) chooseVouchers(randomChoice(candidates).id)
                  else onError('No other voucher set matches the kept operators.')
                }}
              >
                Reroll
              </button>
              <KeepButton
                label="voucher set"
                kept={keptVouchers}
                onClick={() => setKeptVouchers((value) => !value)}
              />
            </div>
          </div>
          <div className="is-opening__recruitment-details">
            <div className="is-opening__hope-summary" role="group" aria-label="Opening Hope">
              <div className="is-opening__hope-total">
                <img className="is-opening__hope-icon" src={hopeIcon} alt="" />
                <div aria-live="polite">
                  <strong>Hope: {budget - spent}</strong>
                  {squad.hopeBonus > 0 && <small>Includes +{squad.hopeBonus} from squad</small>}
                </div>
              </div>
              <div className="is-opening__hope-control" role="group" aria-label="Starting Hope">
                <span>Starting Hope</span>
                <div className="is-opening__hope-stepper">
                  <button
                    className="secondary-button"
                    type="button"
                    aria-label="Decrease starting Hope"
                    disabled={startingHope <= 4}
                    onClick={() => changeBudget(startingHope - 1, difficultyLevel)}
                  >
                    −
                  </button>
                  <output aria-label="Starting Hope value">{startingHope}</output>
                  <button
                    className="secondary-button"
                    type="button"
                    aria-label="Increase starting Hope"
                    disabled={startingHope >= 8}
                    onClick={() => changeBudget(startingHope + 1, difficultyLevel)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <div
              className="squad-grid is-opening__operators"
              aria-label="Opening operators"
              aria-live="polite"
            >
              {Array.from({ length: 3 }, (_, index) => {
                const op = current[index]
                const operatorClass = classes[index] || undefined
                const actions = (
                  <div className="draft-operator-actions is-opening__card-actions">
                    {op && (
                      <>
                        <button
                          className="draft-operator-action draft-operator-action--pick"
                          type="button"
                          aria-label={`Reroll operator ${index + 1}`}
                          disabled={!ready || keptSlots[index]}
                          onClick={() => rerollOperator(index)}
                        >
                          Reroll
                        </button>
                        <KeepButton
                          label={`operator ${index + 1}`}
                          kept={keptSlots[index]}
                          onClick={() =>
                            setKeptSlots((values) =>
                              values.map((value, i) => (i === index ? !value : value)),
                            )
                          }
                        />
                      </>
                    )}
                    {op ? (
                      <button
                        className="draft-operator-action danger-button"
                        type="button"
                        aria-label={`Clear operator for slot ${index + 1}`}
                        disabled={keptSlots[index]}
                        onClick={() => clearOperator(index)}
                      >
                        Clear
                      </button>
                    ) : (
                      operatorClass && (
                        <button
                          className="draft-operator-action"
                          type="button"
                          aria-label={`Pick operator for slot ${index + 1}`}
                          disabled={!ready || keptSlots[index]}
                          onClick={() => setPicker({ kind: 'operator', slot: index })}
                        >
                          Pick
                        </button>
                      )
                    )}
                    {randomVouchers && !op && (
                      <button
                        className={`draft-operator-action ${operatorClass ? 'danger-button' : 'is-opening__voucher-action'}`}
                        type="button"
                        aria-label={`${operatorClass ? 'Clear voucher' : 'Voucher'} for slot ${index + 1}`}
                        disabled={keptSlots[index]}
                        onClick={() =>
                          operatorClass
                            ? clearOperator(index, true)
                            : setPicker({ kind: 'class', slot: index })
                        }
                      >
                        {operatorClass ? 'Clear' : 'Voucher'}
                      </button>
                    )}
                  </div>
                )
                return (
                  <div className="squad-slot" key={index}>
                    {op ? (
                      <OperatorCard
                        operator={op}
                        showPersonalProgression={!isISTemporaryOperator(op)}
                        animationKey={revision}
                        overlay={actions}
                        topRightAdornment={
                          <span className="draft-operator-economy-cluster is-opening__card-badges">
                            {keptSlots[index] && (
                              <span
                                className="draft-operator-price draft-operator-price--neutral"
                                title="Kept"
                              >
                                <img className="is-opening__padlock" src={lockIcon} alt="Kept" />
                              </span>
                            )}
                            <span
                              className={`draft-operator-price draft-operator-price--${costs[index] ? 'cost' : 'neutral'}`}
                              aria-label={`${costs[index]} Hope`}
                              title={`${costs[index]} Hope`}
                            >
                              {costs[index]}
                            </span>
                          </span>
                        }
                      />
                    ) : (
                      <div
                        className="slot-config-card standard-slot-action-card is-opening__voucher-card"
                        tabIndex={0}
                        aria-label={`Slot ${index + 1}: ${operatorClass ?? 'Choose voucher'}`}
                      >
                        <div className="is-opening__voucher-image">
                          <GameArt
                            key={`${themeId}:${operatorClass}`}
                            src={isVoucherArtUrl(themeId, operatorClass)}
                            alt={`${operatorClass ?? 'Recruitment'} voucher`}
                          />
                        </div>
                        <strong>{operatorClass ?? 'Choose voucher'}</strong>
                        <div className="standard-slot-actions-overlay">{actions}</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="is-opening__squad-actions is-opening__control-box">
            <div className="is-opening__strategy-control">
              <label className="field is-opening__strategy">
                <span>Strategy</span>
                <select
                  value={strategy}
                  onChange={(event) => setStrategy(event.target.value as ISOpeningStrategy)}
                >
                  {IS_OPENING_STRATEGIES.map((value) => (
                    <option key={value.id} value={value.id}>
                      {value.name}
                    </option>
                  ))}
                </select>
              </label>
              <span className="is-opening__strategy-help">
                <button
                  type="button"
                  aria-label={`About ${selectedStrategy.name}`}
                  aria-describedby={strategyHelpId}
                >
                  ?
                </button>
                <span id={strategyHelpId} role="tooltip" className="is-opening__strategy-tooltip">
                  <strong>{selectedStrategy.name}</strong>
                  <span>{strategyDescriptions[strategy]}</span>
                </span>
              </span>
            </div>
            <button
              className="danger-button"
              type="button"
              disabled={!current.some(Boolean) && !(randomVouchers && voucherChoices.some(Boolean))}
              onClick={() => {
                clearOpening()
                onMessage('Opening cleared.')
              }}
            >
              Clear
            </button>
            <button
              className="randomize-button"
              type="button"
              disabled={!canRandomize}
              onClick={randomizeOperators}
            >
              Randomize
            </button>
          </div>
        </div>
      </div>
      {picker && (
        <div
          className="slot-editor-backdrop"
          role="presentation"
          onMouseDown={() => setPicker(null)}
        >
          <div
            className="slot-editor garrison-operator-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="is-opening-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="slot-editor-heading">
              <div>
                <p className="eyebrow">
                  SLOT {picker.slot + 1} · {classes[picker.slot] || 'RECRUITMENT'}
                </p>
                <h3 id="is-opening-picker-title">
                  {picker.kind === 'class' ? 'Select Class Voucher' : 'Add Operator'}
                </h3>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close operator picker"
                onClick={() => setPicker(null)}
              >
                ×
              </button>
            </div>
            {picker.kind === 'class' ? (
              <div className="slot-editor-section is-opening__class-picker">
                {operatorClasses.map((value) => (
                  <button
                    className="secondary-button"
                    key={value}
                    aria-label={value}
                    type="button"
                    onClick={() => {
                      setVoucherChoices((values) =>
                        values.map((c, i) => (i === picker.slot ? value : c)),
                      )
                      setSelected(current.map((op, i) => (i === picker.slot ? null : op)))
                      setKeptSlots((slots) =>
                        slots.map((value, i) => (i === picker.slot ? false : value)),
                      )
                      setPicker(null)
                      onError(null)
                    }}
                  >
                    <ClassIcon operatorClass={value} />
                    {value}
                  </button>
                ))}
              </div>
            ) : (
              <div className="slot-editor-section garrison-operator-picker-search">
                <OperatorSelector
                  allowShowAll
                  options={operatorOptions}
                  valueKey={null}
                  includeInternalId={false}
                  placeholder="Search eligible operators..."
                  onSelect={(option) => {
                    if (!option || option.disabled) return
                    selectOperator(option.operator, picker.slot, true)
                    setPicker(null)
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
