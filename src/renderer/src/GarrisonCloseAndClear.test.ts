import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const feature = readFileSync(new URL('./GarrisonSquadFeature.tsx', import.meta.url), 'utf8')
const main = readFileSync(new URL('../../main/index.ts', import.meta.url), 'utf8')
const preload = readFileSync(new URL('../../preload/index.ts', import.meta.url), 'utf8')

describe('Garrison close, placeholder and clearing controls', () => {
  it('does not automatically select Chapter 0 when event data arrives', () => {
    expect(feature).toContain('<option value="" disabled hidden>Quick add event</option>')
    expect(feature).toContain("const [eventId, setEventId] = useState('')")
    expect(feature).not.toContain("setEventId((current) => current || catalog[0]?.id || '')")
  })

  it('clears all squads or one squad without removing stage rows', () => {
    expect(feature).toContain('onClick={clearEverySquad}')
    expect(feature).toContain('onClick={() => clearStageSquad(stage.id)}')
    expect(feature).toContain('clearAllGarrisonSquads(working)')
    expect(feature).toContain('clearGarrisonStageSquad(working, stageId)')
    expect(feature).toContain('applyWorkingEdit(')
  })

  it('replaces beforeunload blocking with Save, Discard, Cancel in Electron', () => {
    expect(feature).not.toContain("window.addEventListener('beforeunload'")
    expect(feature).toContain('setGarrisonCloseDirty(hasUnsavedChanges)')
    expect(feature).toContain('onGarrisonCloseSaveRequested')
    expect(feature).toContain('saveSavedGarrisons(nextLibrary)')
    expect(feature).toContain('completeGarrisonCloseSave(true)')
    expect(main).toContain("buttons: ['Save Garrison', 'Discard Changes', 'Cancel']")
    expect(main).toContain('waitingForSave = true')
    expect(main).toContain('if (event.sender !== mainWindow.webContents')
    expect(preload).toContain('onGarrisonCloseSaveRequested')
  })
})
