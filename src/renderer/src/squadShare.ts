import type { Operator } from '../../shared/operator'

export type SquadShareMode = 'Standard Mode' | 'Draft Mode'

export interface SquadShareResult {
  mode: SquadShareMode
  generatedAt: Date
  members: readonly (Operator | null)[]
  overflowStart?: number
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

export function formatSquadShareText({ mode, generatedAt, members }: SquadShareResult): string {
  const memberLines = members
    .filter((operator) => operator !== null)
    .map((operator, index) => `${index + 1}. ${operator.rarity}* ${operator.name}`)

  return [
    squadShareTitle,
    mode,
    squadShareGeneratedLabel(generatedAt),
    '',
    'Members',
    ...memberLines,
  ].join('\n')
}

export function squadShareImageSlots({
  members,
  overflowStart = members.length,
}: SquadShareResult) {
  const permanent = members.slice(0, overflowStart)
  const overflow = members.slice(overflowStart)
  const firstOverflowSlot = slotCount - overflow.length

  return Array.from({ length: slotCount }, (_, index) => {
    const isOverflow = index >= firstOverflowSlot
    return {
      operator: (isOverflow ? overflow[index - firstOverflowSlot] : permanent[index]) ?? null,
      isOverflow,
    }
  })
}
