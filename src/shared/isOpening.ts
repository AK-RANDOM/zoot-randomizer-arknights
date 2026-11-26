import catalog from './isOpeningCatalog.json'
import { operatorClasses, type Operator, type OperatorClass, type ReleaseServer } from './operator'
import { artworkSourceUrl } from './artworkSources'
import {
  isISTemporaryOperator,
  isISReserveOperator,
  isOpeningPool,
  matchesISVoucher,
  matchesISRecruitmentClass,
} from './isOpeningTemporaryOperators'

export interface ISOpeningSquad {
  id: string
  effectId?: string
  name: string
  description: string
  artPath: string
  classes: OperatorClass[]
  subclasses?: string[]
  hopeBonus: number
  costModifiers: {
    rarities: number[]
    classes: OperatorClass[]
    subclasses?: string[]
    delta: number
  }[]
}

export interface ISOpeningTheme {
  id: string
  name: string
  number: number
  representativeId: string
  cnOnly?: boolean
  hopeCosts: number[]
  squads: ISOpeningSquad[]
  voucherSets: { id: string; name: string; temporaryRarity?: number }[]
}

// Normal-mode starting choices from Kengxxiao/ArknightsGameData_YoStar,
// en_US/gamedata/excel/roguelike_topic_table.json, blob 8e7c4860b499deaa9f677375623320ba193e35a5.
// IS6/IS7 opening choices additionally use the EN/CN normal-mode tables.
// Squad upgrade variants share one entry with the highest upgrade's effects.
// Challenge/monthly starts are excluded.
export const IS_OPENING_THEMES = catalog as ISOpeningTheme[]

export function isOpeningThemesForRegion(region: ReleaseServer): ISOpeningTheme[] {
  return IS_OPENING_THEMES.filter((theme) => region === 'cn' || !theme.cnOnly)
}

export const IS_RANDOM_VOUCHER_SET_ID = 'recruit_group_random'

export const IS_OPENING_STRATEGIES = [
  { id: 'true-random', name: 'True Random' },
  { id: 'prioritize-squad', name: 'Prioritize Squad' },
  { id: 'prioritize-six', name: 'Prioritize 6★' },
  { id: 'exhaust-hope', name: 'Exhaust Hope' },
] as const
export type ISOpeningStrategy = (typeof IS_OPENING_STRATEGIES)[number]['id']

interface ISOpeningDifficulty {
  name: string
  maximum: number
  modifiers: { minimum: number; rarities: number[]; delta: number; label: string }[]
}

// Recruitment surcharges that apply during opening recruitment. IS2's level-9
// surcharge starts at Nightmare's Prelude and therefore does not apply here.
// Its selectable levels 4/13 specifically represent Gaul Mantle / Reforged;
// other cursed relics share the Default Cost choice because they do not change Hope.
export const IS_OPENING_DIFFICULTIES: Record<string, ISOpeningDifficulty> = {
  rogue_1: { name: 'Formal Investigation', maximum: 15, modifiers: [] },
  rogue_2: {
    name: 'Surging Waves',
    maximum: 18,
    modifiers: [{ minimum: 4, rarities: [3, 4, 5, 6], delta: 1, label: '3★–6★ +1 Hope' }],
  },
  rogue_3: {
    name: 'Braving Nature',
    maximum: 15,
    modifiers: [{ minimum: 6, rarities: [4, 5, 6], delta: 1, label: '4★–6★ +1 Hope' }],
  },
  rogue_4: {
    name: 'Facing Souls',
    maximum: 18,
    modifiers: [
      { minimum: 13, rarities: [5], delta: 1, label: '5★ +1 Hope' },
      { minimum: 15, rarities: [6], delta: 1, label: '6★ +1 Hope' },
    ],
  },
  rogue_5: {
    name: 'Guided Tour',
    maximum: 18,
    modifiers: [
      { minimum: 8, rarities: [5], delta: 1, label: '5★ +1 Hope' },
      { minimum: 15, rarities: [6], delta: 1, label: '6★ +1 Hope' },
    ],
  },
  // IS7 levels 13/15 explicitly surcharge NON-initial recruits only.
  rogue_6: { name: 'Confidentiality Level', maximum: 16, modifiers: [] },
}

export function isOpeningDifficultyLabel(themeId: string, level: number): string {
  const difficulty = IS_OPENING_DIFFICULTIES[themeId]
  if (themeId === 'rogue_1' && level >= 4) {
    const relic = level >= 13 ? 'Gaul Mantle (Reforged)' : 'Gaul Mantle'
    return `${difficulty.name} ${level}: ${relic}, 4–6★ +${level >= 13 ? 2 : 1} Hope`
  }
  const modifiers = difficulty.modifiers.filter((modifier) => level >= modifier.minimum)
  return `${difficulty.name} ${level}: ${modifiers.length ? modifiers.map((modifier) => modifier.label).join(', ') : 'Default Cost'}`
}

export function isOpeningDifficultyLevels(themeId: string): number[] {
  if (themeId === 'rogue_1') return [0, 4, 13]
  return [
    0,
    ...new Set(IS_OPENING_DIFFICULTIES[themeId].modifiers.map((modifier) => modifier.minimum)),
  ]
}

const ASSET_ROOT =
  'https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets/c0be4e4428f79c7e87c6889067a6906361ae979b/assets/torappu/dynamicassets'
const NEW_ASSET_ROOT =
  'https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets2/727b9742c9f09db96e5365edfda5188752a8ab5e/assets/dyn'

export function isThemeAvatarUrl(theme: ISOpeningTheme): string {
  return artworkSourceUrl('avatar', `${theme.representativeId}.png`)
}

export function isSquadArtUrl(squad: ISOpeningSquad): string {
  const root = /^rogue_[56]_/.test(squad.id) ? NEW_ASSET_ROOT : ASSET_ROOT
  return `${root}/ui/rogueliketopic/${squad.artPath}`
}

export function isVoucherSetArtUrl(voucherSetId: string): string {
  return `${NEW_ASSET_ROOT}/arts/ui/rogueliketopic/recruitgrppic/${voucherSetId}.png`
}

const voucherProfessions: Record<OperatorClass, string> = {
  Vanguard: 'pioneer',
  Guard: 'warrior',
  Defender: 'tank',
  Sniper: 'sniper',
  Caster: 'caster',
  Medic: 'medic',
  Supporter: 'support',
  Specialist: 'special',
}

export function isVoucherArtUrl(themeId: string, operatorClass?: OperatorClass): string {
  const root = ['rogue_5', 'rogue_6'].includes(themeId) ? NEW_ASSET_ROOT : ASSET_ROOT
  return `${root}/arts/ui/rogueliketopic/itempic/${themeId}_recruit_ticket_${operatorClass ? voucherProfessions[operatorClass] : 'all'}.png`
}

// Base recruitment costs: IS2-IS4 4★/5★/6★ = 2/3/6; IS5 onward = 0/2/6.
// https://arknights.wiki.gg/wiki/Integrated_Strategies
// https://arknights.wiki.gg/wiki/Sarkaz%27s_Furnaceside_Fables#Updates
// Squad modifiers/bonuses and temporary recruitment rarities come from the source table above.
export function isOpeningBaseHopeCost(operator: Operator, theme: ISOpeningTheme): number {
  return isISTemporaryOperator(operator) ? 0 : theme.hopeCosts[operator.rarity - 1]
}

export function isOpeningHopeCost(
  operator: Operator,
  theme: ISOpeningTheme,
  squad: ISOpeningSquad,
  difficultyLevel = 0,
): number {
  if (isISTemporaryOperator(operator)) return 0
  return Math.max(
    0,
    isOpeningBaseHopeCost(operator, theme) +
      (theme.id === 'rogue_1' && difficultyLevel >= 4 && operator.rarity >= 4
        ? difficultyLevel >= 13
          ? 2
          : 1
        : 0) +
      IS_OPENING_DIFFICULTIES[theme.id].modifiers.reduce(
        (delta, modifier) =>
          delta +
          (difficultyLevel >= modifier.minimum && modifier.rarities.includes(operator.rarity)
            ? modifier.delta
            : 0),
        0,
      ) +
      squad.costModifiers.reduce(
        (delta, modifier) =>
          delta +
          (modifier.rarities.includes(operator.rarity) &&
          (!modifier.classes.length ||
            modifier.classes.some((operatorClass) =>
              matchesISRecruitmentClass(operator, operatorClass),
            )) &&
          (!modifier.subclasses || modifier.subclasses.includes(operator.subclass.id))
            ? modifier.delta
            : 0),
        0,
      ),
  )
}

export const IS_VOUCHER_CLASSES: Record<string, readonly OperatorClass[]> = {
  recruit_group_1: ['Vanguard', 'Sniper', 'Specialist'],
  recruit_group_2: ['Defender', 'Caster', 'Sniper'],
  recruit_group_3: ['Guard', 'Supporter', 'Medic'],
  recruit_group_4: ['Vanguard', 'Supporter', 'Specialist'],
  recruit_group_5: ['Defender', 'Caster', 'Medic'],
}

export function randomChoice<T>(values: readonly T[], random = Math.random): T {
  if (!values.length) throw new Error('No IS opening choices are available.')
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))]
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export interface ISOpeningResult {
  operators: Operator[]
  classes: OperatorClass[]
  hopeCosts: number[]
  totalHopeCost: number
  availableHope: number
  temporaryOperatorIndex: number | null
  firstPickIndex?: number | null
}

/** Cost partial manual selections using the same single temporary-recruit offer. */
export function isOpeningSelectionCosts(
  operators: readonly (Operator | null)[],
  theme: ISOpeningTheme,
  squad: ISOpeningSquad,
  voucherSetId: string,
  difficultyLevel: number,
): number[] {
  const temporaryIndex = temporaryRecruitIndex(
    operators,
    theme,
    squad,
    voucherSetId,
    difficultyLevel,
  )
  return operators.map((op, index) =>
    !op || index === temporaryIndex ? 0 : isOpeningHopeCost(op, theme, squad, difficultyLevel),
  )
}

function temporaryRecruitIndex(
  operators: readonly (Operator | null)[],
  theme: ISOpeningTheme,
  squad: ISOpeningSquad,
  voucherSetId: string,
  difficultyLevel: number,
): number {
  const temporaryRarity = theme.voucherSets.find((set) => set.id === voucherSetId)?.temporaryRarity
  let temporaryIndex = -1
  let savings = -1
  operators.forEach((op, index) => {
    if (!op || op.rarity !== temporaryRarity || op.collaboration || isISTemporaryOperator(op))
      return
    const cost = isOpeningHopeCost(op, theme, squad, difficultyLevel)
    if (cost > savings) {
      savings = cost
      temporaryIndex = index
    }
  })
  return temporaryIndex
}

type ISOpeningOperator = Operator & { mandatoryExclusivityGroup?: string | null }

export function isOpeningConflicts(
  candidate: ISOpeningOperator,
  picked: ISOpeningOperator[],
  alterExclusivity: boolean,
): boolean {
  return picked.some(
    (other) =>
      (candidate.id === other.id && !isISReserveOperator(candidate)) ||
      (Boolean(candidate.mandatoryExclusivityGroup) &&
        candidate.mandatoryExclusivityGroup === other.mandatoryExclusivityGroup) ||
      (alterExclusivity &&
        Boolean(candidate.alterGroup) &&
        candidate.alterGroup === other.alterGroup),
  )
}

/** Choose one operator per voucher, respecting the current pool and exclusivity. */
function generateOpeningStrategy({
  operators,
  theme,
  squad,
  voucherSetId,
  strategy,
  alterExclusivity,
  classes,
  availableHope,
  difficultyLevel,
  fixedOperatorIds,
  excludedOperatorIdsBySlot,
  upscaleZeroHope,
  random,
}: {
  operators: readonly Operator[]
  theme: ISOpeningTheme
  squad: ISOpeningSquad
  voucherSetId: string
  strategy: ISOpeningStrategy
  alterExclusivity: boolean
  classes: OperatorClass[]
  availableHope: number
  difficultyLevel: number
  fixedOperatorIds: readonly (string | null)[]
  excludedOperatorIdsBySlot: readonly (string | null)[]
  upscaleZeroHope: boolean
  random: () => number
}): ISOpeningResult {
  const pool = shuffled(isOpeningPool(operators), random)
  const prices = pool.map((op) => isOpeningHopeCost(op, theme, squad, difficultyLevel))
  const temporaryRarity = theme.voucherSets.find((set) => set.id === voucherSetId)?.temporaryRarity
  const temporary = pool.map(
    (op) => op.rarity === temporaryRarity && !op.collaboration && !isISTemporaryOperator(op),
  )
  const conflicts = pool.map((op) =>
    Uint8Array.from(pool.map((other) => Number(isOpeningConflicts(op, [other], alterExclusivity)))),
  )
  const groups = classes.map((operatorClass, slot) =>
    pool.flatMap((op, index) =>
      matchesISVoucher(op, operatorClass) && excludedOperatorIdsBySlot[slot] !== op.id
        ? [index]
        : [],
    ),
  )
  const pins = Array.from({ length: 3 }, (_, slot) => fixedOperatorIds[slot] ?? null)
  const preferred = (index: number): boolean =>
    squad.classes.some((operatorClass) => matchesISRecruitmentClass(pool[index], operatorClass)) &&
    (!squad.subclasses || squad.subclasses.includes(pool[index].subclass.id))
  type Pick = [number, number, number]
  type Costs = [number, number, number]
  // Enumerate operator triples once each. A Random Squad free offer is priced
  // canonically, rather than counting the same triple once per possible offer slot.
  const visit = (
    fixed: readonly (string | null)[],
    accept: (pick: Pick, costs: Costs, spent: number) => boolean | void,
    limit = availableHope,
  ): void => {
    const lists = groups.map((indices, slot) =>
      fixed[slot] ? indices.filter((index) => pool[index].id === fixed[slot]) : indices,
    )
    for (const a of lists[0])
      for (const b of lists[1]) {
        if (conflicts[a][b]) continue
        const partial = prices[a] + prices[b]
        if (!temporaryRarity && partial > limit) continue
        for (const c of lists[2]) {
          if (conflicts[a][c] || conflicts[b][c]) continue
          const costs: Costs = [prices[a], prices[b], prices[c]]
          if (temporaryRarity) {
            const indices = [a, b, c]
            let offer = -1
            for (let slot = 0; slot < 3; slot++) {
              if (temporary[indices[slot]] && (offer < 0 || costs[slot] > costs[offer]))
                offer = slot
            }
            if (offer >= 0) costs[offer] = 0
          }
          const spent = costs[0] + costs[1] + costs[2]
          if (spent <= limit && accept([a, b, c], costs, spent)) return
        }
      }
  }
  let selected: Pick | null = null
  let firstPickIndex: number | null = null
  const firstValid = (fixed: readonly (string | null)[]): void => {
    visit(fixed, (pick) => {
      selected = pick
      return true
    })
  }
  if (strategy === 'true-random') {
    let count = 0
    visit(pins, (pick) => {
      count++
      // Reservoir sampling: all complete valid operator triples have equal weight.
      if (random() * count < 1) selected = pick
    })
  } else if (strategy === 'prioritize-squad' || strategy === 'prioritize-six') {
    const feasible = [new Set<number>(), new Set<number>(), new Set<number>()]
    let highestRarity = 0
    visit(pins, (pick) => {
      pick.forEach((index, slot) => {
        const eligible =
          strategy === 'prioritize-squad' ? preferred(index) : pool[index].rarity >= 5
        if (!eligible) return
        const rarity = pool[index].rarity
        if (rarity > highestRarity) {
          highestRarity = rarity
          feasible.forEach((indices) => indices.clear())
        }
        if (rarity === highestRarity) feasible[slot].add(index)
      })
    })
    const slots = feasible.flatMap((indices, slot) => (indices.size ? [slot] : []))
    if (slots.length) {
      firstPickIndex = randomChoice(slots, random)
      pins[firstPickIndex] = pool[randomChoice([...feasible[firstPickIndex]], random)].id
    }
    firstValid(pins)
  } else if (strategy === 'exhaust-hope') {
    let bestSpent = -1
    visit(pins, (pick, _costs, spent) => {
      if (spent > bestSpent) {
        bestSpent = spent
        selected = pick
      }
      return spent === availableHope
    })
  }
  if (selected && upscaleZeroHope) {
    const original: Pick = selected
    const originalCosts = isOpeningSelectionCosts(
      original.map((index) => pool[index]),
      theme,
      squad,
      voucherSetId,
      difficultyLevel,
    )
    const finalPins = pins.map(
      (_, slot) =>
        fixedOperatorIds[slot] ||
        (isOpeningBaseHopeCost(pool[original[slot]], theme) > 0 ? pool[original[slot]].id : null),
    )
    const quality = (pick: Pick): number[] => {
      const free = pick.filter((_, slot) => !finalPins[slot]).map((index) => pool[index])
      return [
        free.filter((op) => !isISReserveOperator(op)).length,
        free.reduce((sum, op) => sum + op.rarity, 0),
        ...free.map((op) => op.rarity).sort((a, b) => b - a),
      ]
    }
    let bestQuality = quality(original)
    visit(finalPins, (pick, costs) => {
      if (
        pick.some((index, slot) =>
          finalPins[slot]
            ? costs[slot] !== originalCosts[slot]
            : isOpeningBaseHopeCost(pool[index], theme) !== 0,
        )
      )
        return
      const score = quality(pick)
      const difference = score.findIndex((value, index) => value !== bestQuality[index])
      if (difference >= 0 && score[difference] > bestQuality[difference]) {
        selected = pick
        bestQuality = score
      }
    })
  }
  if (!selected)
    throw new Error(
      `No opening matches these vouchers within ${availableHope} Hope and your Setup filters. Try another voucher set or increase Hope.`,
    )
  const resultOperators = (selected as Pick).map((index) => pool[index])
  const hopeCosts = isOpeningSelectionCosts(
    resultOperators,
    theme,
    squad,
    voucherSetId,
    difficultyLevel,
  )
  const offer = temporaryRecruitIndex(resultOperators, theme, squad, voucherSetId, difficultyLevel)
  return {
    operators: resultOperators,
    classes: [...classes],
    hopeCosts,
    totalHopeCost: hopeCosts.reduce((sum, cost) => sum + cost, 0),
    availableHope,
    temporaryOperatorIndex: offer < 0 ? null : offer,
    firstPickIndex,
  }
}

export function generateISOpening({
  operators,
  squad,
  voucherSetId,
  prioritizeSixStars = false,
  upscaleZeroHope = false,
  strategy,
  alterExclusivity,
  themeId = squad.id.split('_band_')[0],
  startingHope = 6,
  difficultyLevel = 0,
  voucherClasses,
  fixedOperatorIds = [],
  excludedOperatorIdsBySlot = [],
  random = Math.random,
}: {
  operators: readonly Operator[]
  squad: ISOpeningSquad
  voucherSetId: string
  prioritizeSixStars?: boolean
  strategy?: ISOpeningStrategy
  upscaleZeroHope?: boolean
  alterExclusivity: boolean
  themeId?: string
  startingHope?: number
  difficultyLevel?: number
  voucherClasses?: readonly OperatorClass[]
  fixedOperatorIds?: readonly (string | null)[]
  excludedOperatorIdsBySlot?: readonly (string | null)[]
  random?: () => number
}): ISOpeningResult {
  const theme = IS_OPENING_THEMES.find((value) => value.id === themeId)
  if (!theme || !theme.squads.some((value) => value.id === squad.id))
    throw new Error('Unknown IS theme or squad.')
  if (!Number.isSafeInteger(startingHope) || startingHope < 0 || startingHope > 12)
    throw new Error('Starting Hope must be an integer between 0 and 12.')
  if (
    !Number.isInteger(difficultyLevel) ||
    difficultyLevel < 0 ||
    difficultyLevel > IS_OPENING_DIFFICULTIES[themeId].maximum
  )
    throw new Error('Choose a valid Difficulty Level for this IS theme.')
  const availableHope = startingHope + squad.hopeBonus
  const temporaryRarity = theme.voucherSets.find(
    (value) => value.id === voucherSetId,
  )?.temporaryRarity
  const temporarySlots = temporaryRarity ? [...shuffled([0, 1, 2], random), null] : [null]
  let temporaryOperatorIndex: number | null = null
  const presetClasses = IS_VOUCHER_CLASSES[voucherSetId]
  if (!presetClasses && voucherSetId !== IS_RANDOM_VOUCHER_SET_ID) {
    throw new Error('Unknown IS voucher set.')
  }
  if (
    !presetClasses &&
    (voucherClasses?.length !== 3 || !voucherClasses.every((c) => operatorClasses.includes(c)))
  )
    throw new Error('Choose all three voucher classes before randomizing.')
  const classOptions = (presetClasses ?? voucherClasses!).map((c) => [c])
  if (strategy || upscaleZeroHope) {
    return generateOpeningStrategy({
      operators,
      theme,
      squad,
      voucherSetId,
      strategy: strategy ?? (prioritizeSixStars ? 'prioritize-squad' : 'true-random'),
      upscaleZeroHope,
      alterExclusivity,
      classes: classOptions.map(([operatorClass]) => operatorClass),
      availableHope,
      difficultyLevel,
      fixedOperatorIds,
      excludedOperatorIdsBySlot,
      random,
    })
  }
  const pool = shuffled(isOpeningPool(operators), random)
  const preferred = (op: Operator): boolean =>
    op.rarity === 6 &&
    squad.classes.includes(op.class) &&
    (!squad.subclasses || squad.subclasses.includes(op.subclass.id))
  const chosen: Operator[] = []
  const classes: OperatorClass[] = []
  const costs: number[] = []
  const costFor = (op: Operator, index: number): number =>
    index === temporaryOperatorIndex ? 0 : isOpeningHopeCost(op, theme, squad, difficultyLevel)
  const candidatesFor = (index: number): Operator[] =>
    pool.filter(
      (op) =>
        classOptions[index].some((c) => matchesISVoucher(op, c)) &&
        (!fixedOperatorIds[index] || fixedOperatorIds[index] === op.id) &&
        excludedOperatorIdsBySlot[index] !== op.id &&
        (index !== temporaryOperatorIndex ||
          (op.rarity === temporaryRarity && !op.collaboration && !isISTemporaryOperator(op))),
    )
  let candidatesBySlot: Operator[][] = []

  const search = (index: number, requirePreferred: boolean, spent = 0): boolean => {
    if (index === 3) return !requirePreferred || chosen.some(preferred)
    const cheapestRemaining = candidatesBySlot
      .slice(index)
      .reduce(
        (total, candidates, offset) =>
          total + Math.min(...candidates.map((op) => costFor(op, index + offset))),
        0,
      )
    if (spent + cheapestRemaining > availableHope) return false
    if (
      requirePreferred &&
      !chosen.some(preferred) &&
      !classOptions
        .slice(index)
        .some((options) =>
          pool.some(
            (op) =>
              options.includes(op.class) &&
              preferred(op) &&
              spent + isOpeningHopeCost(op, theme, squad, difficultyLevel) <= availableHope &&
              !isOpeningConflicts(op, chosen, alterExclusivity),
          ),
        )
    )
      return false
    for (const c of classOptions[index]) {
      const candidates = candidatesBySlot[index].filter((op) => matchesISVoucher(op, c))
      if (requirePreferred) candidates.sort((a, b) => Number(preferred(b)) - Number(preferred(a)))
      for (const op of candidates) {
        if (isOpeningConflicts(op, chosen, alterExclusivity)) continue
        const cost = costFor(op, index)
        if (spent + cost > availableHope) continue
        chosen.push(op)
        classes.push(c)
        costs.push(cost)
        if (search(index + 1, requirePreferred, spent + cost)) return true
        chosen.pop()
        classes.pop()
        costs.pop()
      }
    }
    return false
  }
  const findOpening = (): boolean => {
    const priorities = prioritizeSixStars && squad.classes.length ? [true, false] : [false]
    for (const requirePreferred of priorities)
      for (const temporarySlot of temporarySlots) {
        temporaryOperatorIndex = temporarySlot
        candidatesBySlot = classOptions.map((_, index) => candidatesFor(index))
        if (search(0, requirePreferred)) return true
      }
    return false
  }
  if (!findOpening()) {
    throw new Error(
      `No opening matches these vouchers within ${availableHope} Hope and your Setup filters. Try another voucher set or increase Hope.`,
    )
  }
  const finalCosts = isOpeningSelectionCosts(chosen, theme, squad, voucherSetId, difficultyLevel)
  const finalTemporaryIndex = temporaryRecruitIndex(
    chosen,
    theme,
    squad,
    voucherSetId,
    difficultyLevel,
  )
  return {
    operators: chosen,
    classes,
    hopeCosts: finalCosts,
    totalHopeCost: finalCosts.reduce((sum, cost) => sum + cost, 0),
    availableHope,
    temporaryOperatorIndex: finalTemporaryIndex < 0 ? null : finalTemporaryIndex,
  }
}

/** Randomize all automatic choices, trying another combination if filters make one impossible. */
export function randomizeISOpening({
  themeId,
  keptSquadId,
  keptVoucherSetId,
  random = Math.random,
  ...options
}: {
  themeId: string
  operators: readonly Operator[]
  startingHope: number
  difficultyLevel: number
  prioritizeSixStars?: boolean
  strategy?: ISOpeningStrategy
  upscaleZeroHope?: boolean
  alterExclusivity: boolean
  keptSquadId?: string
  keptVoucherSetId?: string
  voucherClasses?: readonly OperatorClass[]
  fixedOperatorIds?: readonly (string | null)[]
  random?: () => number
}): { squadId: string; voucherSetId: string; result: ISOpeningResult } {
  const theme = IS_OPENING_THEMES.find((value) => value.id === themeId)
  if (!theme) throw new Error('Unknown IS theme.')
  const choices = shuffled(
    theme.squads
      .filter((squad) => !keptSquadId || squad.id === keptSquadId)
      .flatMap((squad) =>
        theme.voucherSets
          .filter((set) =>
            keptVoucherSetId ? set.id === keptVoucherSetId : set.id !== IS_RANDOM_VOUCHER_SET_ID,
          )
          .map((set) => ({ squad, set })),
      ),
    random,
  )
  let lastError: unknown
  for (const { squad, set } of choices) {
    try {
      return {
        squadId: squad.id,
        voucherSetId: set.id,
        result: generateISOpening({ ...options, themeId, squad, voucherSetId: set.id, random }),
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error('No IS opening choices are available.')
}
