import {
  rarityGroupDefinitions,
  rarityGroupKeys,
  type NumericConstraint,
  type RandomizerConstraints,
} from '../../shared/constraints'
import { operatorClasses, operatorRarities, type Operator, type OperatorRarity } from '../../shared/operator'

type Composition = Pick<Operator, 'class' | 'rarity'>

export function singleRerollReason(
  candidates: readonly Composition[],
  otherMembers: readonly Composition[],
  constraints: RandomizerConstraints,
  slotRarities: readonly OperatorRarity[],
): string {
  const needsReplacement = (
    bound: NumericConstraint | undefined,
    matches: (operator: Composition) => boolean,
  ): boolean => Boolean(bound && otherMembers.filter(matches).length < bound.min)

  const requiredClasses = operatorClasses.filter((operatorClass) =>
    needsReplacement(constraints.class[operatorClass], (op) => op.class === operatorClass),
  )
  const requiredRarities = operatorRarities.filter((rarity) =>
    needsReplacement(constraints.rarity[rarity], (op) => op.rarity === rarity),
  )
  const requiredGroups = rarityGroupKeys
    .filter((group) => {
      const rarities: readonly OperatorRarity[] = rarityGroupDefinitions[group].rarities
      return needsReplacement(constraints.rarityGroups[group], (op) => rarities.includes(op.rarity))
    })
    .map((group) => rarityGroupDefinitions[group])
  const allowedRarities = operatorRarities.filter(
    (rarity) =>
      (slotRarities.length === 0 || slotRarities.includes(rarity)) &&
      requiredRarities.every((required) => required === rarity) &&
      requiredGroups.every(({ rarities }) => (rarities as readonly OperatorRarity[]).includes(rarity)),
  )

  const requiredClass = requiredClasses[0]
  if (
    requiredClasses.length <= 1 &&
    allowedRarities.length > 0 &&
    !candidates.some(
      (op) => (!requiredClass || op.class === requiredClass) && allowedRarities.includes(op.rarity),
    )
  ) {
    const rarityLabel =
      allowedRarities.length === operatorRarities.length
        ? ''
        : (requiredGroups.find(({ rarities }) => rarities.length === allowedRarities.length)?.label ??
          allowedRarities.map((rarity) => `${rarity}★`).join('/'))
    const replacement = [rarityLabel, requiredClass].filter(Boolean).join(' ')
    if (replacement) return `No ${replacement}${requiredClass ? '' : ' replacement'} left`
  }
  return candidates.length === 0 ? 'No slot match left' : 'No replacement fits squad rules'
}
