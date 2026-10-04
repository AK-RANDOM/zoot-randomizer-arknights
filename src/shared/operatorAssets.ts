import type { OperatorClass } from './operator'

export const OPERATOR_UI_ASSET_REPOSITORY = 'PuppiizSunniiz/Arknight-Images' as const
export const OPERATOR_UI_ASSET_REVISION = 'main' as const

export const CLASS_ICON_FILES: Record<OperatorClass, string> = {
  Vanguard: 'class_vanguard.png',
  Guard: 'class_guard.png',
  Defender: 'class_defender.png',
  Sniper: 'class_sniper.png',
  Caster: 'class_caster.png',
  Medic: 'class_medic.png',
  Supporter: 'class_supporter.png',
  Specialist: 'class_specialist.png',
}

export function subclassIconFile(subclassId: string): string | null {
  return /^[a-z0-9_]+$/i.test(subclassId) ? `sub_${subclassId}_icon.png` : null
}

const factionIconSlugByLabel: Readonly<Record<string, string>> = {
  'Rhodes Island': 'rhodes',
  'Rhodes Island-Elite Operator': 'elite',
  'S.W.E.E.P.': 'sweep',
  'Op Team A4': 'action4',
  'Reserve Op Team A1': 'reserve1',
  'Reserve Op Team A4': 'reserve4',
  'Reserve Op Team A6': 'reserve6',
  Yan: 'yan',
  'Yan-Sui': 'sui',
  'Yan-Lungmen': 'lungmen',
  'Lungmen Guard Department': 'lgd',
  'Penguin Logistics': 'penguin',
  "Lee's Detective Agency": 'lee',
  'Lee’s Detective Agency': 'lee',
  'Ægir': 'egir',
  Aegir: 'egir',
  'Abyssal Hunters': 'abyssal',
  Columbia: 'columbia',
  'Blacksteel Worldwide': 'blacksteel',
  'Rhine Lab': 'rhine',
  Siesta: 'siesta',
  Kazimierz: 'kazimierz',
  'Pinus Sylvestris': 'pinus',
  Kjerag: 'kjerag',
  'Karlan Trade CO., LTD': 'karlan',
  Siracusa: 'siracusa',
  'Chiave Gang': 'chiave',
  Ursus: 'ursus',
  'Ursus Student Self-government Group': 'student',
  Victoria: 'victoria',
  Glasgow: 'glasgow',
  Tara: 'tara',
  Bolívar: 'bolivar',
  Bolivar: 'bolivar',
  Higashi: 'higashi',
  Iberia: 'iberia',
  Laterano: 'laterano',
  Leithanien: 'leithanien',
  Minos: 'minos',
  'Rim Billiton': 'rim',
  Sami: 'sami',
  Sargon: 'sargon',
  Babel: 'babel',
  Followers: 'followers',
  'Team Rainbow': 'rainbow',
  "Laios's Party": 'laios',
  'Laios’s Party': 'laios',
  'Ave Mujica': 'mujica',
  'S.E.E.S.': 'sees',
  Dublinn: 'dublinn',
}

export function factionIconFile(label: string | null | undefined): string | null {
  if (!label) return null
  const slug = factionIconSlugByLabel[label]
  return slug ? `logo_${slug}.png` : null
}

export const KNOWN_FACTION_ICON_FILES = [...new Set(
  Object.values(factionIconSlugByLabel).map((slug) => `logo_${slug}.png`),
)]
