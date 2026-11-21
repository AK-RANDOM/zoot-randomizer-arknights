import type { LimitedAcquisitionGroup, ReleaseServer } from './operator.ts'

/** Compatibility dates follow these existing presentation conventions after other overrides. */
export const CN_RELEASE_DATE_ALIASES: Record<string, string> = {
  char_383_snsant: 'char_2014_nian',
}
export const RELEASE_PRESENTATION_DATE_ALIASES: Record<string, string> = {
  char_282_catap: 'char_263_skadi',
  char_284_spot: 'char_010_chen',
}

/** References describe inherited evidence, not a new independent historical-date audit. */
export const DATA_CORRECTION_POLICY = [
  {
    id: 'release-dates',
    reason:
      'Retain confirmed availability and existing presentation conventions where source metadata is missing or ambiguous.',
    precedence: [
      'launch convention / main-story mapping / source event or activity / limited banner fallback',
      'published CN dates except launch operators',
      'Amiya form dates',
      'explicit operator date overrides',
      'CN date aliases',
      'user-defined presentation date aliases',
    ],
    references: [
      'https://github.com/AK-RANDOM/zoot-randomizer-arknights/issues/45#issuecomment-7039408020',
      'https://www.arknights.global/news/5092',
    ],
    evidence:
      'Existing maintained registry retained without changing values; historical entries without individual source links are carried forward, not newly verified.',
  },
  {
    id: 'acquisition-and-kernel',
    reason:
      'Current game snapshots do not preserve all historical limited-series and acquisition membership.',
    precedence: [
      'recruitment / credit-shop overrides',
      'welfare rules',
      'collaboration limited',
      'historical limited-series registry',
      'live limited banner metadata',
      'standard; Kernel membership resolved by selected region',
    ],
    references: [
      'https://www.arknights.global/news/4814',
      'https://ak.hypergryph.com/news/2023033352',
      'https://ak.hypergryph.com/news/2024031084',
      'https://ak.hypergryph.com/news/2841',
      'https://ak.hypergryph.com/news/6252',
    ],
    evidence:
      'Kernel notices were already linked by the maintained registry; other memberships retain the existing application classification.',
  },
  {
    id: 'labels-race-and-collaboration',
    reason:
      'Preserve maintained English subclass names, collaboration identities and the explicit Amiya race presentation.',
    precedence: [
      'maintained subclass label before source label / stable ID',
      'Amiya race override after source handbook extraction',
    ],
    references: [
      'https://github.com/AK-RANDOM/zoot-randomizer-arknights/issues/23',
      'https://github.com/AK-RANDOM/zoot-randomizer-arknights/issues/45#issuecomment-7039408020',
    ],
    evidence:
      'Existing application conventions; untranslated new branches continue to warn and use upstream labels.',
  },
  {
    id: 'garrison-representatives',
    reason:
      'Keep canonical chapter/crossover representatives ahead of approximate event-date inference.',
    precedence: [
      'chapter mapping',
      'explicit original / rerun event mapping',
      'regional headline limited banner',
      'nearby regional debut six-star; limited first',
    ],
    references: ['https://github.com/AK-RANDOM/zoot-randomizer-arknights/issues/90'],
    evidence: 'Preserves the completed Garrison workboard and frozen M1 behavior.',
  },
] as const

// Maintained values moved without alteration; source notes and precedence are in DATA_CORRECTION_POLICY.

// releaseMetadata.ts

// Yostar confirmed this release before the English game tables were updated.
// https://www.arknights.global/news/5092
export const MONSTER_HUNTER_GLOBAL_RELEASE = {
  id: 'act50side',
  date: '2026-11-16',
  name: 'Thunder in the Azure Dream',
  operatorIds: new Set(['char_1048_orchd2', 'char_1049_catap2', 'char_4215_buddy']),
}

export const SERVER_LAUNCH_DATES: Record<ReleaseServer, string> = {
  cn: '2019-05-01',
  global: '2020-01-16',
}

export const ANNIVERSARY_BOUNDARIES: Record<ReleaseServer, readonly string[]> = {
  cn: [
    '2020-05-01',
    '2021-05-01',
    '2022-05-01',
    '2023-05-01',
    '2024-05-01',
    '2025-05-01',
    '2026-05-01',
  ],
  global: ['2020-12-30', '2022-01-14', '2023-01-13', '2024-01-16', '2025-01-16', '2026-01-16'],
}

export const MAIN_STORY_DATE_OVERRIDES: Record<string, { cn: string; global: string }> = {
  dis_main_5: { cn: '2019-07-09', global: '2020-02-26' },
  dis_main_6: { cn: '2019-12-24', global: '2020-06-30' },
  dis_main_7: { cn: '2020-05-01', global: '2020-12-30' },
  dis_main_8: { cn: '2020-11-01', global: '2021-04-30' },
  dis_main_9: { cn: '2021-09-17', global: '2022-03-17' },
  dis_main_10: { cn: '2022-04-14', global: '2022-10-19' },
  dis_main_11: { cn: '2022-10-11', global: '2023-04-27' },
  dis_main_12: { cn: '2023-04-06', global: '2023-10-24' },
  dis_main_13: { cn: '2023-10-08', global: '2024-04-16' },
}

export const AMIYA_FORM_RELEASES: Record<string, { cn: string; global: string }> = {
  char_002_amiya: {
    cn: SERVER_LAUNCH_DATES.cn,
    global: SERVER_LAUNCH_DATES.global,
  },
  char_1001_amiya2: MAIN_STORY_DATE_OVERRIDES.dis_main_8,
  char_1037_amiya3: { cn: '2024-05-01', global: '2024-10-31' },
}

/**
 * Audited exceptions/fallbacks for dates that are missing or ambiguous in the
 * generated upstream metadata. Ordinary dates continue to come from the
 * generated release/event sources; these values follow the wiki.gg release
 * list and, for permanent-mode welfare operators, the launch of their mode.
 */
export const RELEASE_DATE_OVERRIDES: Record<
  string,
  Partial<Record<ReleaseServer, string | null>>
> = {
  // Ancient Forge's banner opens after its activity start; keep the confirmed
  // banner date even when the published CN date service is unavailable.
  char_2014_nian: { cn: '2020-01-16' },
  // Critical Phase Transition / Episode 17 starts on 2026-05-01 CN; upstream candidates can surface the pre-event commit date.
  char_4227_gallus: { cn: '2026-05-01' }, // GALLUS²
  char_4225_tanya: { cn: '2026-05-01' }, // Crackborne
  char_4226_veen: { cn: '2026-05-01' }, // Viy
  char_4228_closur: { cn: '2026-05-01' }, // Closure
  char_1052_kalts2: { cn: '2026-05-01' }, // Kal'tsit·Esperanta
  char_456_ash: { cn: '2021-03-09', global: '2021-08-18' },
  char_222_bpipe: { global: '2020-09-10' },
  char_188_helage: { global: '2020-04-15' },
  char_378_asbest: { global: '2020-11-11' },
  char_274_astesi: { global: '2020-04-15' },
  char_344_beewax: { global: '2020-11-26' },
  char_252_bibeak: { global: '2020-09-10' },
  char_275_breeze: { global: '2020-05-20' },
  char_356_broca: { global: '2020-07-15' },
  char_349_chiave: { global: '2020-11-26' },
  char_4043_erato: { global: '2022-12-08' },
  char_261_sddrag: { global: '2020-07-15' },
  char_336_folivo: { global: '2021-02-04' },
  char_379_sesa: { global: '2020-09-10' },
  char_343_tknogi: { global: '2020-11-11' },
  char_402_tuye: { global: '2021-07-13' },
  char_260_durnar: { global: '2020-05-20' },
  char_355_ethan: { global: '2020-05-20' },
  char_151_myrtle: { global: '2020-04-15' },
  char_337_utage: { global: '2020-09-10' },

  // Permanent-mode welfare operators inherit the mode's first release date.
  char_4025_aprot2: { cn: '2022-01-05', global: '2022-07-14' }, // Shalem — IS2
  char_4066_highmo: { cn: '2022-09-27', global: '2023-05-23' }, // Highmore — IS3
  char_4102_threye: { cn: '2023-07-13', global: '2024-03-05' }, // Valarqvin — IS4
  char_4151_tinman: { cn: '2024-07-16', global: '2025-02-14' }, // Tin Man — IS5
  char_4195_radian: { cn: '2025-07-15', global: '2025-12-18' }, // Raidian — IS6
  char_4230_mcnist: { cn: '2026-07-17', global: null }, // Mechanist — IS7, Global TBA
  char_4023_rfalcn: { cn: '2024-02-03', global: '2024-08-07' }, // Kestrel — RA

  // April Fools operator; explicit release dates by server.
  char_159_peacok: { cn: '2020-04-01', global: '2021-04-01' },
}

export const COLLABORATION_BY_OPERATOR_ID: Record<string, string> = {
  char_456_ash: 'Rainbow Six Siege',
  char_457_blitz: 'Rainbow Six Siege',
  char_458_rfrost: 'Rainbow Six Siege',
  char_459_tachak: 'Rainbow Six Siege',
  char_4123_ela: 'Rainbow Six Siege',
  char_4124_iana: 'Rainbow Six Siege',
  char_4125_rdoc: 'Rainbow Six Siege',
  char_4126_fuze: 'Rainbow Six Siege',
  char_4019_ncdeer: 'A Deer of Nine Colors',
  char_4067_lolxh: 'The Legend of Luo Xiaohei',
  char_4077_palico: 'Monster Hunter',
  char_1029_yato2: 'Monster Hunter',
  char_1030_noirc2: 'Monster Hunter',
  char_4215_buddy: 'Monster Hunter',
  char_1049_catap2: 'Monster Hunter',
  char_1048_orchd2: 'Monster Hunter',
  char_4141_marcil: 'Delicious in Dungeon',
  char_4142_laios: 'Delicious in Dungeon',
  char_4143_sensi: 'Delicious in Dungeon',
  char_4144_chilc: 'Delicious in Dungeon',
  char_4182_oblvns: 'BanG Dream! Ave Mujica',
  char_4183_mortis: 'BanG Dream! Ave Mujica',
  char_4184_dolris: 'BanG Dream! Ave Mujica',
  char_4185_amoris: 'BanG Dream! Ave Mujica',
  char_4186_tmoris: 'BanG Dream! Ave Mujica',
  char_4217_makoto: 'Persona 3 Reload',
  char_4218_aigis: 'Persona 3 Reload',
  char_4219_yukari: 'Persona 3 Reload',
  char_4220_kormr: 'Persona 3 Reload',
}

// operatorMetadata.ts

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
export const SHARED_KERNEL_OPERATOR_IDS: ReadonlySet<string> = new Set([
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

// acquisitionMetadata.ts

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

export const IS_RA_WELFARE_OPERATOR_IDS = new Set([
  'char_4025_aprot2', // Shalem — IS2
  'char_4066_highmo', // Highmore — IS3
  'char_4102_threye', // Valarqvin — IS4
  'char_4151_tinman', // Tin Man — IS5
  'char_4195_radian', // Raidian — IS6
  'char_4230_mcnist', // Mechanist — IS7
  'char_4023_rfalcn', // Kestrel — Reclamation Algorithm
])

export const ALWAYS_WELFARE_OPERATOR_IDS = new Set([
  'char_002_amiya',
  'char_1001_amiya2',
  'char_1037_amiya3',
  'char_159_peacok', // Conviction
])

// Operators available from Recruitment with no Headhunting source.
export const RECRUITMENT_WELFARE_OPERATOR_IDS = new Set([
  'char_155_tiger', // Indra
  'char_163_hpsts', // Vulcan
  'char_127_estell', // Estelle
  'char_385_finlpp', // Purestream
  'char_211_adnach', // Adnachiel
  'char_009_12fce', // 12F
  'char_501_durin', // Durin
  'char_500_noirc', // Noir Corne
  'char_503_rang', // Rangers
  'char_502_nblade', // Yato
  'char_286_cast3', // Castle-3
  'char_4188_confes', // CONFESS-47
  'char_4093_frston', // Friston-3
  'char_4227_gallus', // GALLUS²
  'char_4000_jnight', // Justice Knight
  'char_285_medic2', // Lancet-2
  'char_4136_phonor', // PhonoR-0
  'char_376_therex', // THRM-EX
])

export const CREDIT_SHOP_WELFARE_OPERATOR_IDS = new Set([
  'char_198_blackd', // Courier
  'char_187_ccheal', // Gavial
  'char_260_durnar', // Dur-nar
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

// garrisonEventHelper.ts

/**
 * Main Theme chapters have no reliable activity startTime once their stages
 * move to main_N zones. Tie their representative to the episode instead of
 * trying to infer one from nearby operator releases.
 *
 * Chapters 0–4 predate a featured new 6★ operator; Caster Amiya is the
 * explicitly requested fallback, rather than another Amiya class form.
 */
export const GARRISON_CHAPTER_HELPER_IDS: Readonly<Record<number, string>> = {
  0: 'char_002_amiya',
  1: 'char_002_amiya',
  2: 'char_002_amiya',
  3: 'char_002_amiya',
  4: 'char_002_amiya',
  5: 'char_010_chen',
  6: 'char_017_huang',
  7: 'char_113_cqbw',
  8: 'char_391_rosmon',
  9: 'char_479_sleach',
  10: 'char_4039_horn',
  11: 'char_4072_ironmn',
  12: 'char_4087_ines',
  13: 'char_4088_hodrer',
  14: 'char_1035_wisdel',
  15: 'char_4179_monstr',
  16: 'char_4204_mantra',
  17: 'char_1052_kalts2',
}

/**
 * Crossover collaborations do not always share the event activity start date
 * with the featured operator's regional release metadata. Use the original
 * game's activity ID to identify a confirmed featured 6★ rather than relying
 * exclusively on a date within one day. Keep both the original and rerun ID:
 * depending on zone availability the catalog may retain either one.
 */
export const GARRISON_EXPLICIT_EVENT_HELPER_IDS: Readonly<Record<string, string>> = {
  act17d0: 'char_456_ash', // Operation Originium Dust (original)
  act1r6sre: 'char_456_ash', // Operation Originium Dust (rerun)
}

// raceMetadata.ts

export const AMIYA_RACE_ID = 'race:override:amiya-cautus-chimera' as const

export const AMIYA_RACE_LABEL = 'Chimera' as const

export const AMIYA_FORM_IDS = new Set(['char_002_amiya', 'char_1001_amiya2', 'char_1037_amiya3'])
