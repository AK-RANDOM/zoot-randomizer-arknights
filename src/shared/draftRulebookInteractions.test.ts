import { describe, expect, it } from 'vitest'
import {
  evaluateDraftAction,
  startDraft,
  type DraftConfigurationInput,
} from './draft'
import type { Operator } from './operator'
import type { DraftRulebookInteraction } from './draftRulebook'
import {
  createDraftRulebookOperatorCostResolver,
  getDraftInteractionTax,
  getDraftRulebookCandidateInteractionModifier,
  getDraftRulebookInteractionTax,
} from './draftRulebookInteractions'

function operator(id: string): Operator {
  return {
    id,
    name: id,
    rarity: 6,
    class: 'Guard',
    subclass: { id: 'sub_guard', name: 'Guard' },
    faction: { nationId: null, groupId: null, teamId: null, primary: [], main: null, affiliations: [] },
    raceIds: ['race:cn:test'],
    availableOn: { cn: true, global: true },
    release: { cn: { date: null, yearGroup: null }, global: { date: null, yearGroup: null } },
    acquisition: { family: 'standard', group: null },
    collaboration: null,
    alterGroup: null,
    mandatoryExclusivityGroup: null,
    imageFile: `${id}.png`,
  }
}

const gladiia = operator('gladiia')
const ulpianus = operator('ulpianus')
const specter = operator('specter')
const andreana = operator('andreana')
const shu = operator('shu')
const suiA = operator('sui-a')
const suiB = operator('sui-b')
const suiC = operator('sui-c')

const ahGroup = { type: 'operators' as const, operatorIds: ['gladiia', 'ulpianus', 'specter', 'andreana'] }
const gladiiaSelector = { type: 'operators' as const, operatorIds: ['gladiia'] }
const ulpianusSelector = { type: 'operators' as const, operatorIds: ['ulpianus'] }

const ahInteractions: DraftRulebookInteraction[] = [
  { id: 'gladiia-ah', type: 'anchor', source: gladiiaSelector, target: ahGroup, modifier: 6 },
  { id: 'gladiia-ulpianus', type: 'anchor', source: gladiiaSelector, target: ulpianusSelector, modifier: 2 },
]

describe('Draft Rulebook interaction tax', () => {
  it('makes anchor pricing order-independent and stacks separate interactions', () => {
    const rulebook = { interactions: ahInteractions }

    expect(getDraftRulebookCandidateInteractionModifier(rulebook, ulpianus, [gladiia])).toBe(8)
    expect(getDraftRulebookCandidateInteractionModifier(rulebook, gladiia, [ulpianus])).toBe(8)
    expect(getDraftRulebookInteractionTax(rulebook, [gladiia, ulpianus])).toBe(8)
  })

  it('does not multiply one anchor payoff when several interchangeable enablers exist', () => {
    const sourceA = operator('source-a')
    const sourceB = operator('source-b')
    const target = operator('target')
    const interaction: DraftRulebookInteraction = {
      id: 'interchangeable',
      type: 'anchor',
      source: { type: 'operators', operatorIds: ['source-a', 'source-b'] },
      target: { type: 'operators', operatorIds: ['target'] },
      modifier: 5,
    }

    expect(getDraftInteractionTax(interaction, [sourceA, sourceB, target])).toBe(5)
  })

  it('charges progressive steps only as each member-count breakpoint is crossed', () => {
    const interaction: DraftRulebookInteraction = {
      id: 'progressive',
      type: 'progressive',
      group: ahGroup,
      steps: [
        { memberCount: 2, modifier: 3 },
        { memberCount: 3, modifier: 5 },
        { memberCount: 4, modifier: 8 },
      ],
    }
    const rulebook = { interactions: [interaction] }

    expect(getDraftRulebookInteractionTax(rulebook, [gladiia])).toBe(0)
    expect(getDraftRulebookCandidateInteractionModifier(rulebook, ulpianus, [gladiia])).toBe(3)
    expect(getDraftRulebookCandidateInteractionModifier(rulebook, specter, [gladiia, ulpianus])).toBe(5)
    expect(getDraftRulebookInteractionTax(rulebook, [gladiia, ulpianus, specter])).toBe(8)
  })

  it('charges the operator that completes a threshold regardless of whether the anchor or group arrives last', () => {
    const interaction: DraftRulebookInteraction = {
      id: 'shu-sui',
      type: 'threshold',
      group: { type: 'operators', operatorIds: ['shu', 'sui-a', 'sui-b', 'sui-c'] },
      threshold: 4,
      modifier: 12,
      anchor: { type: 'operators', operatorIds: ['shu'] },
    }
    const rulebook = { interactions: [interaction] }

    expect(getDraftRulebookCandidateInteractionModifier(rulebook, suiC, [shu, suiA, suiB])).toBe(12)
    expect(getDraftRulebookCandidateInteractionModifier(rulebook, shu, [suiA, suiB, suiC])).toBe(12)
    expect(getDraftRulebookInteractionTax(rulebook, [shu, suiA, suiB, suiC])).toBe(12)
  })

  it('uses interaction-adjusted pick cost for affordability preflight', () => {
    const fillerA = operator('filler-a')
    const fillerB = operator('filler-b')
    const pool = [gladiia, ulpianus, fillerA, fillerB]
    const rulebook = { interactions: ahInteractions }
    const configuration: DraftConfigurationInput = {
      economyRules: {
        enabled: true,
        startingPoints: 65,
        rarityCosts: { 6: 30 },
      },
    }
    const options = {
      configuration,
      candidateGenerator: (candidates: readonly Operator[], count: number) => candidates.slice(0, count),
      operatorCostResolver: createDraftRulebookOperatorCostResolver(rulebook),
    }

    const started = startDraft(pool, 3, options)
    const afterGladiia = {
      ...started,
      draftedOperatorIds: ['gladiia'],
      currentOfferIds: ['ulpianus', 'filler-a', 'filler-b'],
      points: 35,
      roundNumber: 2,
    }

    expect(evaluateDraftAction(afterGladiia, pool, { type: 'pick', operatorId: 'ulpianus' }, options)).toEqual({
      available: false,
      reason: 'insufficient-points',
    })
    expect(evaluateDraftAction(afterGladiia, pool, { type: 'pick', operatorId: 'filler-a' }, options)).toEqual({
      available: true,
      reason: null,
    })
  })
})
