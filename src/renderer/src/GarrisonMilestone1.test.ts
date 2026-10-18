import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8')

describe('Garrison Squad M1', () => {
  it('adds Garrison as a non-randomized Get Squad mode', () => {
    const app = read('./App.tsx')
    expect(app).toContain("type SquadMode = 'standard' | 'garrison' | 'draft'")
    expect(app).toContain("['garrison', 'Garrison']")
    expect(app).toContain('<GarrisonSquadFeature')
    expect(app).toContain('This Garrison has unsaved changes')
  })

  it('reuses the preset toolbar pattern with Save Garrison as the primary action', () => {
    const feature = read('./GarrisonSquadFeature.tsx')
    expect(feature).toContain('className="preset-toolbar garrison-toolbar"')
    expect(feature).toContain('Save Garrison')
    expect(feature).toContain('New Garrison')
    expect(feature).toContain('Duplicate')
    expect(feature).toContain('Rename')
    expect(feature).toContain('Delete')
    expect(feature).not.toContain('Randomize')
  })

  it('keeps saved and working Garrison state separate', () => {
    const feature = read('./GarrisonSquadFeature.tsx')
    expect(feature).toContain('const [library, setLibrary]')
    expect(feature).toContain('const [working, setWorking]')
    expect(feature).toContain('const [baseline, setBaseline]')
    expect(feature).toContain('Discard unsaved Garrison changes?')
    expect(feature).toContain('Saved Garrison')
  })

  it('provides editable ordered stage CRUD without Draft/randomization behavior', () => {
    const feature = read('./GarrisonSquadFeature.tsx')
    expect(feature).toContain('Add Stage')
    expect(feature).toContain('deleteStage(stage.id)')
    expect(feature).toContain('renameStage(stage.id, event.target.value)')
    expect(feature).toContain('Participating Operators')
    expect(feature).not.toContain('useDraftSession')
    expect(feature).not.toContain('generateSquad')
  })
})
