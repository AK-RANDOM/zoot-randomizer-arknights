import type { OperatorRarity } from '../../shared/operator'

/**
 * Identify slots competing for too few distinct replacements. A slot that can
 * take a replacement on its own can still be part of a shortage.
 */
export function slotsWithReplacementShortages(
  candidatesBySlot: ReadonlyMap<number, readonly string[]>,
): Set<number> {
  const slotByCandidate = new Map<string, number>()

  const assign = (slot: number, seen: Set<string>): boolean => {
    for (const candidate of candidatesBySlot.get(slot) ?? []) {
      if (seen.has(candidate)) continue
      seen.add(candidate)
      const assignedSlot = slotByCandidate.get(candidate)
      if (assignedSlot === undefined || assign(assignedSlot, seen)) {
        slotByCandidate.set(candidate, slot)
        return true
      }
    }
    return false
  }

  const unmatched = [...candidatesBySlot.keys()].filter((slot) => !assign(slot, new Set()))
  const shortages = new Set(unmatched)
  // Walk from each unmatched slot through its candidates to the slots sharing
  // them, so the warning does not depend on which slot was matched first.
  for (const slot of shortages) {
    for (const candidate of candidatesBySlot.get(slot) ?? []) {
      const assignedSlot = slotByCandidate.get(candidate)
      if (assignedSlot !== undefined) shortages.add(assignedSlot)
    }
  }
  return shortages
}

export function rarityShortageMessage(
  rarities: readonly OperatorRarity[],
  minimum: number,
  retained: readonly OperatorRarity[],
  openSlots: readonly (readonly OperatorRarity[])[],
  available: readonly OperatorRarity[],
  label: string,
): string | undefined {
  const requiredSlots = openSlots.filter(
    (allowed) => allowed.length > 0 && allowed.every((rarity) => rarities.includes(rarity)),
  ).length
  const needed = Math.max(
    requiredSlots,
    minimum - retained.filter((rarity) => rarities.includes(rarity)).length,
  )
  const left = available.filter((rarity) => rarities.includes(rarity)).length
  if (left >= needed) return undefined
  return `${label}: ${needed} needed, ${left} left`
}
