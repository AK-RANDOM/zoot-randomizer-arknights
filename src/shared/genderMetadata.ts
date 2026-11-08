import type { Operator, OperatorGender } from './operator.ts'
import type { LocalizedHandbookInfoTables, RawHandbookInfoRecord } from './raceMetadata.ts'
import { bundledOperatorGenders } from './bundledOperatorGenders.ts'

const genderFields = {
  cn: /^【(?:性别|设定性别)】[^\S\r\n]*(.+)$/m,
  en: /^\[(?:Gender|Gender Assignment)\][^\S\r\n]*(.+)$/im,
}

function handbookGender(record: RawHandbookInfoRecord | undefined, locale: 'cn' | 'en') {
  for (const section of record?.storyTextAudio ?? []) {
    for (const story of section.stories ?? []) {
      if (typeof story.storyText !== 'string') continue
      const value = genderFields[locale].exec(story.storyText)?.[1].trim().toLowerCase()
      if (!value) continue
      if (value === '男' || value === 'male') return 'male'
      if (['女', '女士', '自称雌性', 'female', 'lady', 'self-identified female'].includes(value)) {
        return 'female'
      }
      return 'other'
    }
  }
  return undefined
}

export function genderFromHandbooks(
  id: string,
  handbooks: LocalizedHandbookInfoTables,
): OperatorGender {
  const handbookId = id === 'char_1001_amiya2' || id === 'char_1037_amiya3' ? 'char_002_amiya' : id
  return (
    handbookGender(handbooks.cn?.handbookDict?.[handbookId], 'cn') ??
    handbookGender(handbooks.en?.handbookDict?.[handbookId], 'en') ??
    bundledOperatorGenders[id] ??
    'other'
  )
}

export function operatorGender(operator: Pick<Operator, 'id' | 'gender'>): OperatorGender {
  return operator.gender ?? bundledOperatorGenders[operator.id] ?? 'other'
}
