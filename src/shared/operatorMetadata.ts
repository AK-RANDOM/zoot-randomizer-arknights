import type { Operator, ReleaseServer, StandardAcquisitionGroup } from './operator'

/**
 * Stable game-data subProfessionId -> English branch label.
 *
 * The upstream EN uniequip table currently carries untranslated Chinese
 * subProfessionName values, so IDs remain canonical and display labels are
 * maintained explicitly. New branches use upstream labels (or their stable ID)
 * until an English label is maintained here, without blocking operator updates.
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

// Both servers have migrated the same 5★/6★ operators through the Dorothy batch
// as of 2026-11-07. Use membership because Global released some later batches early.
// Global: https://www.arknights.global/news/4814
// CN: https://ak.hypergryph.com/news/2023033352, https://ak.hypergryph.com/news/2024031084,
//     https://ak.hypergryph.com/news/2841, https://ak.hypergryph.com/news/6252
const SHARED_KERNEL_OPERATOR_IDS: ReadonlySet<string> = new Set([
  // 6-star operators
  'char_225_haak', // Aak
  'char_291_aglina', // Angelina
  'char_332_archet', // Archetto
  'char_222_bpipe', // Bagpipe
  'char_017_huang', // Blaze
  'char_423_blemsh', // Blemishine
  'char_426_billro', // Carnelian
  'char_2013_cerber', // Ceobe
  'char_010_chen', // Ch'en
  'char_4048_doroth', // Dorothy
  'char_4046_ebnhlz', // Ebenholz
  'char_416_zumama', // Eunectes
  'char_103_angel', // Exusiai
  'char_180_amgoat', // Eyjafjalla
  'char_430_fartth', // Fartooth
  'char_300_phenxi', // Fiammetta
  'char_420_flamtl', // Flametail
  'char_206_gnosis', // Gnosis
  'char_377_gdglow', // Goldenglow
  'char_188_helage', // Hellagur
  'char_4039_horn', // Horn
  'char_136_hsguma', // Hoshiguma
  'char_134_ifrit', // Ifrit
  'char_4009_irene', // Irene
  'char_003_kalts', // Kal'tsit
  'char_322_lmlee', // Lee
  'char_248_mgllan', // Magallan
  'char_437_mizuki', // Mizuki
  'char_213_mostma', // Mostima
  'char_264_f12yin', // Mountain
  'char_311_mudrok', // Mudrock
  'char_179_cgbird', // Nightingale
  'char_485_pallas', // Pallas
  'char_472_pasngr', // Passenger
  'char_250_phatom', // Phantom
  'char_197_poca', // Rosa
  'char_362_saga', // Saga
  'char_479_sleach', // Saileach
  'char_202_demkni', // Saria
  'char_340_shwaz', // Schwarz
  'char_147_shining', // Shining
  'char_112_siege', // Siege
  'char_172_svrash', // SilverAsh
  'char_263_skadi', // Skadi
  'char_350_surtr', // Surtr
  'char_358_lisa', // Suzuran
  'char_293_thorns', // Thorns
  'char_400_weedy', // Weedy
  // 5-star operators
  'char_475_akafyu', // Akafuyu
  'char_218_cuttle', // Andreana
  'char_346_aosta', // Aosta
  'char_365_aprl', // April
  'char_378_asbest', // Asbestos
  'char_431_ashlok', // Ashlock
  'char_274_astesi', // Astesia
  'char_422_aurora', // Aurora
  'char_294_ayer', // Ayerscarpe
  'char_344_beewax', // Beeswax
  'char_476_blkngt', // Blacknight
  'char_129_bluep', // Blue Poison
  'char_356_broca', // Broca
  'char_349_chiave', // Chiave
  'char_173_slchan', // Cliffheart
  'char_489_serum', // Corroserum
  'char_201_moeshd', // Croissant
  'char_401_elysm', // Elysium
  'char_279_excu', // Executor
  'char_241_panda', // FEater
  'char_158_milu', // Firewatch
  'char_415_flint', // Flint
  'char_106_franka', // Franka
  'char_326_glacus', // Glaucus
  'char_367_swllow', // GreyThroat
  'char_1027_greyy2', // Greyy the Lightningbearer
  'char_1024_hbisc2', // Hibiscus the Purifier
  'char_226_hmau', // Hung
  'char_338_iris', // Iris
  'char_195_glassb', // Istina
  'char_214_kafka', // Kafka
  'char_4016_kazema', // Kazemaru
  'char_478_kirara', // Kirara
  'char_421_crow', // La Pluma
  'char_140_whitew', // Lappland
  'char_306_leizi', // Leizi
  'char_373_lionhd', // Leonhardt
  'char_107_liskam', // Liskarm
  'char_215_mantic', // Manticore
  'char_242_otter', // Mayer
  'char_219_meteo', // Meteorite
  'char_455_nothin', // Mr. Nothing
  'char_473_mberry', // Mulberry
  'char_148_nearl', // Nearl
  'char_164_nightm', // Nightmare
  'char_204_platnm', // Platinum
  'char_174_slbell', // Pramanix
  'char_144_red', // Projekt Red
  'char_145_prove', // Provence
  'char_128_plosis', // Ptilopsis
  'char_492_quercu', // Quercus
  'char_261_sddrag', // Reed
  'char_4040_rockr', // Rockrock
  'char_379_sesa', // Sesa
  'char_254_vodfox', // Shamare
  'char_108_silent', // Silence
  'char_166_skfire', // Skyfire
  'char_101_sora', // Sora
  'char_143_ghost', // Specter
  'char_308_swire', // Swire
  'char_102_texas', // Texas
  'char_363_toddi', // Toddifons
  'char_343_tknogi', // Tsukinogi
  'char_243_waaifu', // Waai Fu
  'char_171_bldsk', // Warfarin
  'char_436_whispr', // Whisperain
  'char_433_windft', // Windflit
  'char_115_headbr', // Zima
])

const KERNEL_OPERATOR_IDS_BY_SERVER: Record<ReleaseServer, ReadonlySet<string>> = {
  global: SHARED_KERNEL_OPERATOR_IDS,
  cn: SHARED_KERNEL_OPERATOR_IDS,
}

export function standardAcquisitionGroup(
  operator: Pick<Operator, 'id' | 'rarity'>,
  server: ReleaseServer,
): StandardAcquisitionGroup {
  if (operator.rarity <= 4) return 'lowRarity'
  return KERNEL_OPERATOR_IDS_BY_SERVER[server].has(operator.id) ? 'kernel' : 'postKernel'
}
