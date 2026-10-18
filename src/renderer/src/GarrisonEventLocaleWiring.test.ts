import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const feature = readFileSync(new URL('./GarrisonSquadFeature.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const options = readFileSync(new URL('./OptionsPanel.tsx', import.meta.url), 'utf8')
const service = readFileSync(new URL('../../main/garrisonEventCatalogService.ts', import.meta.url), 'utf8')
const main = readFileSync(new URL('../../main/index.ts', import.meta.url), 'utf8')

describe('Garrison event region vs App Localization integration', () => {
  it('uses distinct preferences and reloads when either changes', () => {
    expect(app).toContain('metadataRegion={operatorPreferences.metadataRegion}')
    expect(app).toContain('gameLocale={operatorPreferences.gameLocale}')
    expect(feature).toContain('getGarrisonEvents(metadataRegion, gameLocale)')
    expect(feature).toContain('}, [metadataRegion, gameLocale])')
    expect(feature).toContain("setEventId('')")
    expect(feature).toContain('<option value="" disabled hidden>Quick add event</option>')
  })

  it('calls Metadata Region and App Localization by their correct names', () => {
    expect(options).toContain('<span>Metadata region</span>')
    expect(options).toContain('<span>App Localization</span>')
    expect(options).not.toContain('<span>Game localization</span>')
  })

  it('uses CN game data to choose CN events/stages regardless of label language', () => {
    expect(service).toContain("region === 'cn' ? 'cn' : 'en'")
    expect(service).toContain("fetchGameTable(sourceLocale, 'stage_table.json')")
    expect(service).toContain('localizeGarrisonEventNames(sourceEvents, localizedActivities, localizedZones)')
    expect(service).toContain('catalogKey(region, locale)')
    expect(main).toContain('requireMetadataRegion(region), requireGameLocale(locale)')
  })
})
