import {
  LIMITED_SERIES_BY_OPERATOR_ID,
  IS_RA_WELFARE_OPERATOR_IDS,
  ALWAYS_WELFARE_OPERATOR_IDS,
  RECRUITMENT_WELFARE_OPERATOR_IDS,
  CREDIT_SHOP_WELFARE_OPERATOR_IDS,
  MODE_ONLY_OPERATOR_IDS,
} from './dataCorrections.ts'
export { LIMITED_SERIES_BY_OPERATOR_ID, MODE_ONLY_OPERATOR_IDS } from './dataCorrections.ts'
import type { LimitedAcquisitionGroup, OperatorAcquisition } from './operator'
import type { OperatorReleaseCategory } from './releaseMetadata'

export interface RawGachaPoolClientEntry {
  openTime?: unknown
  limitParam?: {
    limitedCharId?: unknown
  } | null
}

export interface RawGachaTable {
  gachaPoolClient?: Record<string, RawGachaPoolClientEntry>
}

export function welfareAcquisitionOverride(id: string): OperatorAcquisition | undefined {
  if (RECRUITMENT_WELFARE_OPERATOR_IDS.has(id)) {
    return { family: 'welfare', group: 'recruitment' }
  }
  if (CREDIT_SHOP_WELFARE_OPERATOR_IDS.has(id)) {
    return { family: 'welfare', group: 'creditShop' }
  }
  return undefined
}

export function isModeOnlyOperator(id: string): boolean {
  if (MODE_ONLY_OPERATOR_IDS.has(id)) return true
  return /^char_6\d{2}_ac[a-z0-9_]*$/i.test(id)
}

export function limitedOperatorIdsInPool(pool: RawGachaPoolClientEntry): string[] {
  const raw = pool.limitParam?.limitedCharId
  const values: unknown[] = Array.isArray(raw) ? raw : [raw]
  return values.filter(
    (value): value is string => typeof value === 'string' && /^char_[a-z0-9_]+$/i.test(value),
  )
}

export function limitedOperatorIds(gacha: RawGachaTable | undefined): Set<string> {
  return new Set(Object.values(gacha?.gachaPoolClient ?? {}).flatMap(limitedOperatorIdsInPool))
}

function limitedGroupFromCnDate(date: string | null): LimitedAcquisitionGroup {
  if (!date) return 'anniversary'
  const month = Number(date.slice(5, 7))
  if (month <= 3) return 'cny'
  if (month <= 6) return 'anniversary'
  if (month <= 9) return 'summer'
  return 'halfAnniversary'
}

function normalizedApproach(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isRedCertApproach(approach: string): boolean {
  return /采购凭证|凭证交易所|Purchase Certificate|Certificate Store/i.test(approach)
}

function isWelfareApproach(approach: string): boolean {
  if (!approach) return false
  return /主题曲剧情|活动(?:获得|奖励)|关卡(?:获得|奖励|掉落)|交易所|商店兑换|采购凭证|周年奖励|签到|赠送|危机合约|集成战略|生息演算|Event (?:Reward|Store)|Main Theme|Story Reward|Purchase Certificate|Crisis Contract|Integrated Strategies|Reclamation Algorithm|Login Reward|Anniversary (?:Reward|Gift)/i.test(
    approach,
  )
}

export function classifyAcquisition(input: {
  id: string
  obtainApproach: unknown
  releaseCategory: OperatorReleaseCategory | null
  cnReleaseDate: string | null
  collaboration: string | null
  limitedIds: ReadonlySet<string>
}): OperatorAcquisition {
  const welfareOverride = welfareAcquisitionOverride(input.id)
  if (welfareOverride) return welfareOverride

  const approach = normalizedApproach(input.obtainApproach)
  const modeWelfare = IS_RA_WELFARE_OPERATOR_IDS.has(input.id)
  const welfare =
    ALWAYS_WELFARE_OPERATOR_IDS.has(input.id) || modeWelfare || isWelfareApproach(approach)

  if (welfare) {
    if (input.collaboration) return { family: 'welfare', group: 'eventStory' }
    if (modeWelfare || input.releaseCategory === 'roguelike') {
      return { family: 'welfare', group: 'isRa' }
    }
    if (input.releaseCategory === 'crisis' || /危机合约|Crisis Contract/i.test(approach)) {
      return { family: 'welfare', group: 'cc' }
    }
    if (isRedCertApproach(approach)) return { family: 'welfare', group: 'redCert' }
    return { family: 'welfare', group: 'eventStory' }
  }

  // All crossover gacha operators are treated as Limited, even when the
  // game's own limited metadata only marks the headline rarity.
  if (input.collaboration) return { family: 'limited', group: 'collab' }

  const historicalGroup = LIMITED_SERIES_BY_OPERATOR_ID[input.id]
  if (historicalGroup) return { family: 'limited', group: historicalGroup }

  // Keep the live metadata fallback for newly-added normal limited operators;
  // the explicit registry above preserves historical rows after banners rotate.
  if (input.limitedIds.has(input.id)) {
    return {
      family: 'limited',
      group: limitedGroupFromCnDate(input.cnReleaseDate),
    }
  }

  return { family: 'standard', group: null }
}
