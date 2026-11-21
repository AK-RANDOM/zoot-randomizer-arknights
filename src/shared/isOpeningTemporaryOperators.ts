import type { Operator, OperatorClass } from './operator'

// IS-only predefined recruits from the EN character/roguelike tables. The unused
// char_512_aprot variant is deliberately excluded; regular Shalem is not an Elite.
const entries: [string, string, OperatorClass, string, string, number][] = [
  ['char_504_rguard', 'Reserve Operator - Melee', 'Vanguard', 'pioneer', 'Pioneer', 3],
  ['char_514_rdfend', 'Reserve Operator - Defender', 'Defender', 'protector', 'Protector', 3],
  ['char_507_rsnipe', 'Reserve Operator - Sniper', 'Sniper', 'fastshot', 'Marksman', 3],
  ['char_505_rcast', 'Reserve Operator - Caster', 'Caster', 'corecaster', 'Core Caster', 3],
  ['char_506_rmedic', 'Reserve Operator - Logistics', 'Medic', 'physician', 'Medic', 3],
  ['char_508_aguard', 'Sharp', 'Guard', 'fearless', 'Dreadnought', 5],
  ['char_511_asnipe', 'Stormeye', 'Sniper', 'fastshot', 'Marksman', 5],
  ['char_509_acast', 'Pith', 'Caster', 'splashcaster', 'Splash Caster', 5],
  ['char_510_amedic', 'Touch', 'Medic', 'physician', 'Medic', 5],
  ['char_513_apionr', 'Tulip', 'Vanguard', 'pioneer', 'Pioneer', 5],
]

// Elite five-star IS recruits do not appear in opening recruitment. Keep their
// IDs in the registry so they are also stripped from any supplied regular pool.
export const IS_TEMPORARY_OPERATORS: Operator[] = entries
  .filter((entry) => entry[5] === 3)
  .map(([id, name, operatorClass, branch, branchName, rarity]) => ({
    id,
    name,
    class: operatorClass,
    rarity: rarity as Operator['rarity'],
    subclass: { id: branch, name: branchName },
    faction: { main: null, affiliations: [] },
    availableOn: { cn: true, global: true },
    release: { cn: { date: null, yearGroup: null }, global: { date: null, yearGroup: null } },
    acquisition: { family: 'welfare', group: 'isRa' },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `${id}.png`,
  }))

export function isISTemporaryOperator(operator: Operator): boolean {
  return entries.some(([id]) => id === operator.id)
}

export function isISReserveOperator(operator: Operator): boolean {
  return isISTemporaryOperator(operator) && operator.rarity === 3
}

export function isOpeningPool(operators: readonly Operator[]): Operator[] {
  return [
    ...operators.filter((operator) => !isISTemporaryOperator(operator)),
    ...IS_TEMPORARY_OPERATORS,
  ]
}

export function matchesISVoucher(operator: Operator, voucher: OperatorClass): boolean {
  if (operator.id === 'char_504_rguard')
    return ['Vanguard', 'Guard', 'Specialist'].includes(voucher)
  if (operator.id === 'char_505_rcast') return ['Caster', 'Supporter'].includes(voucher)
  return operator.class === voucher
}

export function isTemporaryArtwork(operator: Operator, avatar = false): string | null {
  if (!isISTemporaryOperator(operator)) return null
  const root =
    'https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets/c0be4e4428f79c7e87c6889067a6906361ae979b/assets/torappu/dynamicassets/arts'
  return `${root}/${avatar ? 'charavatars' : 'charportraits'}/${operator.id}${avatar ? '' : '_1'}.png`
}
