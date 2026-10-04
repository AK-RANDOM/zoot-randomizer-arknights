import type {
  LimitedAcquisitionGroup,
  OperatorAcquisition,
} from './operator'
import type { OperatorReleaseCategory } from './releaseMetadata'

export interface RawGachaPoolClientEntry {
  limitParam?: {
    limitedCharId?: unknown
  } | null
}

export interface RawGachaTable {
  gachaPoolClient?: Record<string, RawGachaPoolClientEntry>
}

/**
 * Historical normal Limited operators need an explicit durable registry:
 * current gacha_table snapshots do not preserve every past limitedCharId.
 * Groups follow the operator's original CN limited series, independent of the
 * Global calendar date at which the same content was released.
 */
export const LIMITED_SERIES_BY_OPERATOR_ID: Record<string, LimitedAcquisitionGroup> = {
  // Celebration — CN anniversary (early May / late April)
  char_113_cqbw: 'anniversary', // W
  char_1012_skadi2: 'anniversary', // Skadi the Corrupting Heart
  char_1023_ghost2: 'anniversary', // Specter the Unchained
  char_249_mlyss: 'anniversary', // Muelsyse
  char_1035_wisdel: 'anniversary', // Wiš'adel
  char_1041_angel2: 'anniversary', // Exusiai the New Covenant
  char_1052_kalts2: 'anniversary', // Kal'tsit - Esperanta

  // Celebration — CN half-anniversary (early November)
  char_391_rosmon: 'halfAnniversary', // Rosmontis
  char_1014_nearl2: 'halfAnniversary', // Nearl the Radiant Knight
  char_1028_texas2: 'halfAnniversary', // Texas the Omertosa
  char_245_cello: 'halfAnniversary', // Virtuosa
  char_1038_whitw2: 'halfAnniversary', // Lappland the Decadenza
  char_1045_svash2: 'halfAnniversary', // SilverAsh the Reignfrost

  // Festival — Spring Festival / CNY
  char_2014_nian: 'cny',
  char_2015_dusk: 'cny',
  char_2023_ling: 'cny',
  char_2024_chyue: 'cny',
  char_2025_shu: 'cny',
  char_2026_yu: 'cny',
  char_2027_wang: 'cny',

  // Carnival — CN Summer Carnival
  char_1013_chen2: 'summer', // Ch'en the Holungday
  char_1026_gvial2: 'summer', // Gavial the Invincible
  char_1016_agoat2: 'summer', // Eyjafjalla the Hvit Aska
  char_4058_pepe: 'summer',
  char_1044_hsgma2: 'summer', // Hoshiguma the Breacher
  char_1015_aglna2: 'summer', // Angelina the Mellow Wish
}

const IS_RA_WELFARE_OPERATOR_IDS = new Set([
  'char_4025_aprot2', // Shalem — IS2
  'char_4066_highmo', // Highmore — IS3
  'char_4102_threye', // Valarqvin — IS4
  'char_4151_tinman', // Tin Man — IS5
  'char_4195_radian', // Raidian — IS6
  'char_4230_mcnist', // Mechanist — IS7
  'char_4023_rfalcn', // Kestrel — Reclamation Algorithm
])

const ALWAYS_WELFARE_OPERATOR_IDS = new Set([
  'char_002_amiya',
  'char_1001_amiya2',
  'char_1037_amiya3',
  'char_159_peacok', // Conviction
])

export const MODE_ONLY_OPERATOR_IDS = new Set([
  // Integrated Strategies temporary Elite / Reserve recruitment operators.
  'char_504_rguard',
  'char_514_rdfend',
  'char_507_rsnipe',
  'char_506_rmedic',
  'char_505_rcast',
  'char_513_apionr',
  'char_508_aguard',
  'char_511_asnipe',
  'char_509_acast',
  'char_510_amedic',

  // Stronghold Protocol-only variants. Normal Raidian and Mechanist use
  // different character IDs and intentionally remain in the playable pool.
  'char_608_acpion',
  'char_609_acguad',
  'char_610_acfend',
  'char_611_acnipe',
  'char_612_accast',
  'char_613_acmedc',
  'char_614_acsupo',
  'char_615_acspec',
])

export function isModeOnlyOperator(id: string): boolean {
  if (MODE_ONLY_OPERATOR_IDS.has(id)) return true
  return /^char_6\d{2}_ac[a-z0-9_]*$/i.test(id)
}

export function limitedOperatorIds(gacha: RawGachaTable | undefined): Set<string> {
  const result = new Set<string>()
  for (const pool of Object.values(gacha?.gachaPoolClient ?? {})) {
    const raw = pool.limitParam?.limitedCharId
    if (!Array.isArray(raw)) continue
    for (const value of raw) {
      if (typeof value === 'string' && value.startsWith('char_')) result.add(value)
    }
  }
  return result
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
  const approach = normalizedApproach(input.obtainApproach)
  const modeWelfare = IS_RA_WELFARE_OPERATOR_IDS.has(input.id)
  const welfare =
    ALWAYS_WELFARE_OPERATOR_IDS.has(input.id) ||
    modeWelfare ||
    isWelfareApproach(approach)

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
