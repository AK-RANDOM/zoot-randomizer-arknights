import type { ReleaseServer } from './operator'

/**
 * Stable game-data subProfessionId -> English branch label.
 *
 * The upstream EN uniequip table currently carries untranslated Chinese
 * subProfessionName values, so IDs remain canonical and display labels are
 * maintained explicitly. Unknown IDs are rejected by dataset validation so a
 * newly-added branch cannot silently ship with a raw/internal label.
 */
export const SUBCLASS_LABELS: Readonly<Record<string, string>> = {
  agent: 'Agent',
  bearer: 'Standard Bearer',
  charger: 'Charger',
  counsellor: 'Strategist',
  pioneer: 'Pioneer',
  tactician: 'Tactician',

  artsfghter: 'Arts Fighter',
  centurion: 'Centurion',
  crusher: 'Crusher',
  fearless: 'Dreadnought',
  fighter: 'Fighter',
  hammer: 'Earthshaker',
  instructor: 'Instructor',
  librator: 'Liberator',
  lord: 'Lord',
  mercenary: 'Mercenary',
  musha: 'Soloblade',
  primguard: 'Primal Guard',
  reaper: 'Reaper',
  sword: 'Swordmaster',

  artsprotector: 'Arts Protector',
  duelist: 'Duelist',
  fortress: 'Fortress',
  guardian: 'Guardian',
  primprotector: 'Primal Protector',
  protector: 'Protector',
  shotprotector: 'Sentry Protector',
  unyield: 'Juggernaut',

  aoesniper: 'Artilleryman',
  bombarder: 'Flinger',
  closerange: 'Heavyshooter',
  fastshot: 'Marksman',
  hunter: 'Hunter',
  longrange: 'Deadeye',
  loopshooter: 'Loopshooter',
  reaperrange: 'Spreadshooter',
  siegesniper: 'Besieger',
  skybreaker: 'Skybreaker',

  blastcaster: 'Blast Caster',
  chain: 'Chain Caster',
  corecaster: 'Core Caster',
  funnel: 'Mech-Accord Caster',
  mystic: 'Mystic Caster',
  phalanx: 'Phalanx Caster',
  primcaster: 'Primal Caster',
  soulcaster: 'Shaper Caster',
  splashcaster: 'Splash Caster',

  chainhealer: 'Chain Medic',
  healer: 'Therapist',
  incantationmedic: 'Incantation Medic',
  physician: 'Medic',
  ringhealer: 'Multi-target Medic',
  wandermedic: 'Wandering Medic',
  watchman: 'Watchman',

  bard: 'Bard',
  blessing: 'Abjurer',
  craftsman: 'Artificer',
  ritualist: 'Ritualist',
  slower: 'Decel Binder',
  summoner: 'Summoner',
  supportiveranger: 'Supportive Ranger',
  underminer: 'Hexer',

  alchemist: 'Alchemist',
  dollkeeper: 'Dollkeeper',
  executor: 'Executor',
  geek: 'Geek',
  hookmaster: 'Hookmaster',
  merchant: 'Merchant',
  pusher: 'Push Stroker',
  skywalker: 'Skyranger',
  stalker: 'Ambusher',
  traper: 'Trapmaster',
}

export type OperatorEra = 'kernel' | 'postKernel'

/**
 * Current release-date boundary for the historical era represented by each
 * region's Kernel pool. The classification intentionally applies to every
 * operator (including Limited, collaboration and Welfare), not only operators
 * literally obtainable from Kernel Headhunting.
 *
 * Global: Gnosis is the newest 6-star in the 2026 Celebration - Kernel pool;
 *         Global release 2022-06-30.
 * CN:     Dorothy is in the current migrated Kernel range;
 *         CN release 2022-07-05.
 */
export const KERNEL_CUTOFF_BY_SERVER: Readonly<Record<ReleaseServer, string>> = {
  global: '2022-06-30',
  cn: '2022-07-05',
}

export function operatorEraForRelease(
  releaseDate: string | null,
  server: ReleaseServer,
): OperatorEra | null {
  if (!releaseDate) return null
  return releaseDate <= KERNEL_CUTOFF_BY_SERVER[server] ? 'kernel' : 'postKernel'
}
