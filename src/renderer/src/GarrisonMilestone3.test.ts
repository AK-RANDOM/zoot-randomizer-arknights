import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8')

describe('Garrison Squad M3', () => {
  it('derives Participating Operators from the working stage squads instead of persisting a second copy', () => {
    const feature = read('./GarrisonSquadFeature.tsx')
    const model = read('../../shared/garrison.ts')
    const persistence = read('./rendererPersistence.ts')

    expect(feature).toContain('getGarrisonParticipation(working)')
    expect(feature).toContain('const participation = useMemo')
    expect(model).toContain('export function getGarrisonParticipation')
    expect(model).toContain('stageCount')
    expect(persistence).not.toContain('participatingOperators')
  })

  it('shows each unique participating operator once with its number of participating stages', () => {
    const feature = read('./GarrisonSquadFeature.tsx')

    expect(feature).toContain('participation.map(({ operatorId, stageCount }) =>')
    expect(feature).toContain('className="garrison-participant-entry"')
    expect(feature).toContain('className="garrison-participant-count"')
    expect(feature).toContain('×{stageCount}')
  })

  it('keeps stage squads as one horizontal row of Draft History-style operator icons', () => {
    const feature = read('./GarrisonSquadFeature.tsx')
    const css = read('./GarrisonSquadFeature.css')

    expect(feature).toContain('className="garrison-stage-squad-icons"')
    expect(feature).toContain('release-representative draft-history__operator-icon')
    expect(css).toContain('.garrison-stage-squad-icons')
    expect(css).toContain('flex-wrap: nowrap')
  })

  it('uses the latest selected-appearance avatar path for Garrison overview icons', () => {
    const feature = read('./GarrisonSquadFeature.tsx')

    expect(feature).toContain("import { useOperatorAppearanceAvatar } from './operatorAppearance'")
    expect(feature).toContain('const { imageUrl } = useOperatorAppearanceAvatar(operator)')
    expect(feature).not.toContain('.getOperatorImage(operator.id)')
  })
})
