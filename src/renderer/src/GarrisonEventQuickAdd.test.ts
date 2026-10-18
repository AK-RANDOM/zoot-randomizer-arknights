import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const source = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8')

describe('Garrison event quick-add toolbar', () => {
  it('appears directly after participating operators, before the stage table', () => {
    const code = source('./GarrisonSquadFeature.tsx')
    const overview = code.indexOf('className="garrison-participants"')
    const toolbar = code.indexOf('className="garrison-stage-quickadd"')
    const table = code.indexOf('className="garrison-stage-table"')
    expect(overview).toBeGreaterThan(-1)
    expect(toolbar).toBeGreaterThan(overview)
    expect(table).toBeGreaterThan(toolbar)
  })
  it('uses an event select, category select and Add Event with spacer before a single history toggle', () => {
    const code = source('./GarrisonSquadFeature.tsx')
    expect(code).toContain('aria-label="Event name"')
    expect(code).toContain('aria-label="Stage type"')
    expect(code).toContain('Standard Stage')
    expect(code).toContain('EX Stage')
    expect(code).toContain('S Stage')
    expect(code).toContain('Add Event')
    expect(code).toContain('garrison-stage-quickadd-spacer')
    expect(code).toContain("{canUndo ? 'Undo Edit' : 'Redo Edit'}")
    expect(code).toContain('onClick={canUndo ? undoEdit : redoEdit}')
    expect(code).not.toContain('onClick={undoEdit}')
    expect(code).not.toContain('onClick={redoEdit}')
  })
  it('shows Main Story and Side Story optgroups in the event dropdown', () => {
    const code = source('./GarrisonSquadFeature.tsx')
    expect(code).toContain("label={group === 'main' ? 'Main Story' : 'Side Story'}")
    expect(code).toContain('event.group === group')
    const service = source('../../main/garrisonEventCatalogService.ts')
    expect(service).toContain('cache.version === CATALOG_VERSION')
  })

  it('appends the selected event as one transactional Garrison edit, preserving existing stages', () => {
    const code = source('./GarrisonSquadFeature.tsx')
    expect(code).toContain('appendEventStages(working.stages, selectedEvent, selectedStageType)')
    expect(code).toContain('next.stages.push(...names.map((name) => createGarrisonStage(name)))')
    expect(code).toContain('applyWorkingEdit(next)')
  })
  it('shows story-appropriate stage types only when populated, and resets missing choices', () => {
    const code = source('./GarrisonSquadFeature.tsx')
    expect(code).toContain('availableGarrisonEventStageTypes(selectedEvent)')
    expect(code).toContain('availableStageTypes.includes(stageType)')
    expect(code).toContain('availableStageTypes.map((type) => (')
    expect(code).toContain("? 'H Stage'")
    expect(code).toContain("? 'EX Stage'")
    expect(code).toContain(": 'S Stage'")
    expect(code).toContain('value={selectedStageType}')
  })
  it('loads the catalog through the desktop API and offers cached offline use', () => {
    expect(source('./GarrisonSquadFeature.tsx')).toContain('window.desktop.getGarrisonEvents()')
    expect(source('../../main/garrisonEventCatalogService.ts')).toContain(
      'if (cache) return cache.events',
    )
  })
})
