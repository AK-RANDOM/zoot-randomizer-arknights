import type { Operator } from '../../shared/operator'

export type SquadShareMode = 'Standard Mode' | 'Draft Mode' | 'IS Opening' | 'Garrison'

export interface SquadShareResult {
  mode: SquadShareMode
  generatedAt: Date
  members: readonly (Operator | null)[]
  overflowStart?: number
  garrison?: {
    name: string
    duplicateOperatorsAllowed: boolean
    stages: { name: string; members: { id: string; name: string; rarity?: number }[] }[]
  }
  opening?: {
    theme: string
    squad: string
    squadIconUrl: string
    voucherSet: string
    voucherSetIconUrl: string
    startingHope: number
  }
}

const slotCount = 12
export const squadShareTitle = 'ZOOT Squad Dispatcher'

const generatedDateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function squadShareGeneratedLabel(generatedAt: Date): string {
  return `Generated: ${generatedDateFormat.format(generatedAt)}`
}

export function squadShareDetails({ opening }: SquadShareResult): string[] {
  return opening
    ? [opening.theme, opening.squad, opening.voucherSet, `${opening.startingHope} starting Hope`]
    : []
}

export function formatSquadShareText(result: SquadShareResult): string {
  if (result.garrison) {
    const { name, duplicateOperatorsAllowed, stages } = result.garrison
    return [
      squadShareTitle,
      `Garrison: ${name}`,
      `Cross-stage duplicates: ${duplicateOperatorsAllowed ? 'Allowed' : 'Not allowed'}`,
      ...stages.flatMap((stage, index) => [
        '',
        `${index + 1}. ${stage.name}`,
        ...(stage.members.length
          ? stage.members.map(
              (member, slot) =>
                `  ${slot + 1}. ${member.rarity ? `${member.rarity}* ` : ''}${member.name}`,
            )
          : ['  No operators assigned']),
      ]),
    ].join('\n')
  }
  const { mode, generatedAt, members, opening } = result
  const memberLines = members
    .filter((operator): operator is Operator => operator !== null)
    .map((operator, index) => `${index + 1}. ${operator.rarity}* ${operator.name}`)

  return [
    ...(opening ? [] : [squadShareTitle, mode, squadShareGeneratedLabel(generatedAt)]),
    ...squadShareDetails(result),
    '',
    'Members',
    ...memberLines,
  ].join('\n')
}

export function squadShareImageSlots({
  mode,
  members,
  overflowStart = members.length,
}: SquadShareResult) {
  const permanent = members.slice(0, overflowStart)
  const count = mode === 'IS Opening' ? 3 : slotCount
  const overflow = members.slice(overflowStart)
  const firstOverflowSlot = count - overflow.length

  return Array.from({ length: count }, (_, index) => {
    const isOverflow = index >= firstOverflowSlot
    return {
      operator: (isOverflow ? overflow[index - firstOverflowSlot] : permanent[index]) ?? null,
      isOverflow,
    }
  })
}
