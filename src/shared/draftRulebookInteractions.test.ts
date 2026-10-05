import { describe, expect, it } from 'vitest'
import type { Operator } from './operator'
import {
  applyDraftAction,
  evaluateDraftAction,
  getDraftInteractionCostContributionsWithConfiguration,
  getDraftOperatorCostForStateWithConfiguration,
  resolveDraftConfiguration,
  startDraft,
} from './draft'
import {
  STANDARD_DRAFT_RULEBOOK,
  deserializeDraftRulebook,
  serializeDraftRulebook,
  type DraftRulebook,
} from './draftRulebook'
import { resolveDraftRulebookExecution } from './draftRulebookExecution'
import { resolveDraftRulebookInteractions } from './draftRulebookInteractions'

function operator(
  id: string,
  overrides: Partial<Operator> & Pick<Operator, 'rarity' | 'class'>,
): Operator {
  return {
    id,
    name: id,
    rarity: overrides.rarity,
    class: overrides.class,
    subclass: overrides.subclass ?? { id: 'sub_default', name: 'Default' },
    faction: overrides.faction ?? {
      nationId: null,
      groupId: null,
      teamId: null,
      primary: [],
      main: null,
      affiliations: [],
    },
    raceIds: overrides.raceIds ?? ['race:cn:default'],
    availableOn: { cn: true, global: true },
    release: {
      cn: { date: null, yearGroup: null },
      global: { date: null, yearGroup: null },
    },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `${id}.png`,
  }
}

function cloneStandard(): DraftRulebook {
  return deserializeDraftRulebook(serializeDraftRulebook(STANDARD_DRAFT_RULEBOOK))
}

const abyssalFaction = {
  nationId: 'nation_aegir',
  groupId: null,
  teamId: 'team_abyssal',
  primary: ['nation_aegir', 'team_abyssal'],
  main: 'team_abyssal',
  affiliations: ['nation_aegir', 'team_abyssal'],
}

const gladiia = operator('char_gladiia', {
  rarity: 6,
  class: 'Specialist',
  faction: abyssalFaction,
})
const ulpianus = operator('char_ulpianus', {
  rarity: 6,
  class: 'Guard',
  faction: abyssalFaction,
})
const specter = operator('char_specter', {
  rarity: 5,
  class: 'Guard',
  faction: abyssalFaction,
})
const shu = operator('char_shu', { rarity: 6, class: 'Defender' })
const nian = operator('char_nian', { rarity: 6, class: 'Defender' })
const ling = operator('char_ling', { rarity: 6, class: 'Supporter' })
const dusk = operator('char_dusk', { rarity: 6, class: 'Caster' })
const chongyue = operator('char_chongyue', { rarity: 6, class: 'Guard' })
const filler = operator('char_filler', { rarity: 4, class: 'Vanguard' })

const dataset = [gladiia, ulpianus, specter, shu, nian, ling, dusk, chongyue, filler]

function interactionRulebook(): DraftRulebook {
  const rulebook = cloneStandard()
  rulebook.identifier.id = 'test:interactions'
  rulebook.generalRules.economyRules = {
    enabled: true,
    startingPoints: 100,
    rarityCosts: { 4: 0, 5: 12, 6: 32 },
  }
  rulebook.overrides.operatorCosts.char_ulpianus = 36
  rulebook.interactions = [
    {
      id: 'abyssal-anchor',
      type: 'anchor',
      source: { type: 'operators', operatorIds: [gladiia.id] },
      target: { type: 'factions', factionIds: ['team_abyssal'] },
      modifier: 6,
    },
    {
      id: 'gladiia-ulpianus-pair',
      type: 'anchor',
      source: { type: 'operators', operatorIds: [gladiia.id] },
      target: { type: 'operators', operatorIds: [ulpianus.id] },
      modifier: 2,
    },
    {
      id: 'abyssal-progressive',
      type: 'progressive',
      group: { type: 'operators', operatorIds: [gladiia.id, ulpianus.id, specter.id] },
      steps: [
        { memberCount: 2, modifier: 3 },
        { memberCount: 3, modifier: 7 },
      ],
    },
    {
      id: 'shu-sui-threshold',
      type: 'threshold',
      group: {
        type: 'operators',
        operatorIds: [shu.id, nian.id, ling.id, dusk.id, chongyue.id],
      },
      threshold: 4,
      modifier: 10,
      anchor: { type: 'operators', operatorIds: [shu.id] },
    },
  ]
  return rulebook
}

describe('Draft Rulebook interaction execution', () => {
  it('resolves selector-based interactions into runtime operator IDs without mutating the Rulebook', () => {
    const rulebook = interactionRulebook()
    const before = serializeDraftRulebook(rulebook)
    const resolved = resolveDraftRulebookInteractions(rulebook.interactions, dataset)

    expect(resolved[0]).toMatchObject({
      id: 'abyssal-anchor',
      type: 'anchor',
      sourceOperatorIds: [gladiia.id],
      targetOperatorIds: [gladiia.id, ulpianus.id, specter.id],
      modifier: 6,
    })
    expect(serializeDraftRulebook(rulebook)).toBe(before)
  })

  it('attaches resolved interactions to the canonical Rulebook execution configuration', () => {
    const execution = resolveDraftRulebookExecution(interactionRulebook(), dataset, dataset)

    expect(execution.valid).toBe(true)
    expect(execution.configuration?.interactions).toHaveLength(4)
    expect(execution.identityKey).toContain('abyssal-anchor')
  })

  it('makes Anchor pricing order-independent and stacks a specific pair modifier', () => {
    const configuration = resolveDraftRulebookExecution(
      interactionRulebook(),
      dataset,
      dataset,
    ).configuration
    expect(configuration).not.toBeNull()
    if (!configuration) return

    const ulpianusSecond = getDraftOperatorCostForStateWithConfiguration(
      ulpianus,
      { draftedOperatorIds: [gladiia.id] },
      configuration,
    )
    const gladiiaSecond = getDraftOperatorCostForStateWithConfiguration(
      gladiia,
      { draftedOperatorIds: [ulpianus.id] },
      configuration,
    )

    expect(ulpianusSecond).toBe(36 + 6 + 2 + 3)
    expect(gladiiaSecond).toBe(32 + 6 + 2 + 3)
    expect(32 + ulpianusSecond).toBe(36 + gladiiaSecond)
    expect(
      getDraftInteractionCostContributionsWithConfiguration(
        { draftedOperatorIds: [gladiia.id] },
        ulpianus.id,
        configuration,
      ),
    ).toEqual([
      { interactionId: 'abyssal-anchor', type: 'anchor', modifier: 6 },
      { interactionId: 'gladiia-ulpianus-pair', type: 'anchor', modifier: 2 },
      { interactionId: 'abyssal-progressive', type: 'progressive', modifier: 3 },
    ])
  })

  it('uses the configured progressive surcharge for the resulting group size', () => {
    const interactions = resolveDraftRulebookInteractions(interactionRulebook().interactions, dataset)
    const configuration = resolveDraftConfiguration({ interactions })

    expect(
      getDraftOperatorCostForStateWithConfiguration(
        ulpianus,
        { draftedOperatorIds: [specter.id] },
        configuration,
      ),
    ).toBe(32 + 3)
    expect(
      getDraftOperatorCostForStateWithConfiguration(
        ulpianus,
        { draftedOperatorIds: [specter.id, gladiia.id] },
        configuration,
      ),
    ).toBe(32 + 6 + 2 + 7)
  })

  it('charges a Threshold exactly when the candidate completes it, including when the anchor arrives last', () => {
    const interactions = resolveDraftRulebookInteractions(interactionRulebook().interactions, dataset)
    const configuration = resolveDraftConfiguration({ interactions })

    expect(
      getDraftOperatorCostForStateWithConfiguration(
        dusk,
        { draftedOperatorIds: [shu.id, nian.id, ling.id] },
        configuration,
      ),
    ).toBe(32 + 10)
    expect(
      getDraftOperatorCostForStateWithConfiguration(
        shu,
        { draftedOperatorIds: [nian.id, ling.id, dusk.id] },
        configuration,
      ),
    ).toBe(32 + 10)
    expect(
      getDraftOperatorCostForStateWithConfiguration(
        chongyue,
        { draftedOperatorIds: [shu.id, nian.id, ling.id, dusk.id] },
        configuration,
      ),
    ).toBe(32)
  })

  it('uses interaction-adjusted pick cost for the canonical affordability preflight', () => {
    const interactions = resolveDraftRulebookInteractions(
      interactionRulebook().interactions.filter((interaction) => interaction.type === 'anchor'),
      dataset,
    )
    const configuration = resolveDraftConfiguration({
      economyRules: {
        enabled: true,
        startingPoints: 39,
        rarityCosts: { 6: 32 },
        operatorCostOverrides: { [ulpianus.id]: 32 },
      },
      interactions,
    })
    const pool = [gladiia, ulpianus, filler, nian, ling]
    const state = startDraft(pool, 4, { configuration, random: () => 0 })
    state.draftedOperatorIds = [gladiia.id]
    state.currentOfferIds = [ulpianus.id, filler.id, nian.id]
    state.points = 39

    expect(
      getDraftOperatorCostForStateWithConfiguration(ulpianus, state, configuration),
    ).toBe(40)
    expect(
      evaluateDraftAction(state, pool, { type: 'pick', operatorId: ulpianus.id }, { configuration }),
    ).toEqual({ available: false, reason: 'insufficient-points' })

    state.points = 40
    expect(
      evaluateDraftAction(state, pool, { type: 'pick', operatorId: ulpianus.id }, { configuration }),
    ).toEqual({ available: true, reason: null })

    const next = applyDraftAction(
      state,
      pool,
      { type: 'pick', operatorId: ulpianus.id },
      { configuration },
    )
    expect(next.points).toBe(0)
    expect(next.draftedOperatorIds).toContain(ulpianus.id)
  })
})
