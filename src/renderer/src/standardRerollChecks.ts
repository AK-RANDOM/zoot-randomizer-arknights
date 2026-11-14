import type { RandomizerConstraints } from '../../shared/constraints'
import { rarityGroupDefinitions, rarityGroupKeys } from '../../shared/constraints'
import { operatorClasses, operatorRarities, type Operator, type OperatorClass, type OperatorRarity } from '../../shared/operator'
import { createSquadRerollPlanner } from '../../shared/randomizer'
import { rarityShortageMessage, slotsWithReplacementShortages } from './chainRerollShortages'
import { singleRerollReason } from './chainRerollReason'

export function checkStandardRerolls({ current, squad, pool, exhausted, keptSlots, chainMode }: {
  current: RandomizerConstraints
  squad: Operator[]
  pool: Operator[]
  exhausted: Operator[]
  keptSlots: number[]
  chainMode: boolean
}) {
  const deadline = performance.now() + 100
  const planner = createSquadRerollPlanner(
    current,
    squad,
    pool,
    exhausted,
    deadline,
  )
  const { available, candidatesBySlot } = planner
  const protectedSlots = squad.map(
    (_, index) => keptSlots.includes(index) || Boolean(current.slots[index]?.operatorId),
  )
  const rerollableSlots = squad.flatMap((_, index) => (protectedSlots[index] ? [] : [index]))

  const bySlot = squad.map((_, index) => protectedSlots[index] ? null : planner.plan([index]))
  const batch = chainMode || keptSlots.length > 0 ? planner.plan(rerollableSlots) : null
  const batchLimited = planner.wasLimited(rerollableSlots)
  const singleWarnings = new Map<number, string>()
  const batchWarnings = new Map<number, string>()
  if (chainMode) {
    for (const index of rerollableSlots) {
      if (bySlot[index]) continue
      singleWarnings.set(
        index,
        planner.wasLimited([index]) ? 'Reroll check took too long' : singleRerollReason(
          candidatesBySlot[index],
          squad.filter((_, slot) => slot !== index),
          current,
          current.slots[index].rarities,
        ),
      )
    }

    if (!batch) {
      const retainedMembers = squad.filter((_, index) => protectedSlots[index])
      const batchCandidates = [...new Set(rerollableSlots.flatMap((index) => candidatesBySlot[index]))]
      const classWarnings = new Map<OperatorClass, string>()
      for (const operatorClass of operatorClasses) {
        const minimum = current.class[operatorClass]?.min ?? 0
        const retained = retainedMembers.filter((operator) => operator.class === operatorClass).length
        const needed = minimum - retained
        if (needed <= 0) continue
        const left = batchCandidates.filter((operator) => operator.class === operatorClass).length
        if (left < needed) classWarnings.set(operatorClass, `${operatorClass}: ${needed} needed, ${left} left`)
      }
      const retained = retainedMembers.map(({ rarity }) => rarity)
      const openSlots = rerollableSlots.map((index) => current.slots[index].rarities)
      const availableRarities = available.map(({ rarity }) => rarity)
      const rarityWarnings = new Map<OperatorRarity, string>()
      for (const rarity of operatorRarities) {
        const message = rarityShortageMessage(
          [rarity],
          current.rarity[rarity]?.min ?? 0,
          retained,
          openSlots,
          availableRarities,
          `${rarity}★`,
        )
        if (message) rarityWarnings.set(rarity, message)
      }
      for (const group of rarityGroupKeys) {
        const { label, rarities }: { label: string; rarities: readonly OperatorRarity[] } =
          rarityGroupDefinitions[group]
        const range = `${label.slice(1)} or ${label.startsWith('≤') ? 'lower' : 'higher'}`
        const message = rarityShortageMessage(
          rarities,
          current.rarityGroups[group]?.min ?? 0,
          retained,
          openSlots,
          availableRarities,
          range,
        )
        if (!message) continue
        for (const rarity of rarities) {
          if (!rarityWarnings.has(rarity)) rarityWarnings.set(rarity, message)
        }
      }
      const shortages = slotsWithReplacementShortages(
        new Map(
          rerollableSlots.map((index) => [
            index,
            candidatesBySlot[index].map(({ id }) => id),
          ]),
        ),
      )
      for (const index of rerollableSlots) {
        const operator = squad[index]
        const warning = classWarnings.get(operator.class) ?? rarityWarnings.get(operator.rarity)
        if (warning) {
          batchWarnings.set(index, warning)
        } else if (shortages.has(index)) {
          batchWarnings.set(index, 'Not enough operators fit these slots')
        }
      }
      if (batchWarnings.size === 0 && !batchLimited) {
        for (const index of rerollableSlots) {
          if (performance.now() >= deadline) break
          if (planner.plan(rerollableSlots.filter((target) => target !== index))) {
            batchWarnings.set(index, 'Batch conflicts with squad rules')
          }
        }
      }
      if (batchWarnings.size === 0) {
        for (const index of rerollableSlots) {
          batchWarnings.set(index, batchLimited ? 'Batch check took too long' : 'No valid batch reroll')
        }
      }
    }
  }
  return { available, batch, bySlot, batchWarnings, singleWarnings, rerollableSlots, batchLimited }
}
