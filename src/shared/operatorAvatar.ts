const AVATAR_SOURCE_FILENAME_OVERRIDES: Readonly<Record<string, string>> = {
  // Medic Amiya has no canonical <operatorId>.png avatar upstream; the playable
  // form uses the phase-2 avatar filename instead.
  char_1037_amiya3: 'char_1037_amiya3_2.png',
}

export function operatorAvatarSourceFilename(operatorId: string): string {
  return AVATAR_SOURCE_FILENAME_OVERRIDES[operatorId] ?? `${operatorId}.png`
}
export function legacyOperatorAvatarIds(filename: string): string[] {
  return [
    ...new Set([
      filename.slice(0, -4),
      ...Object.keys(AVATAR_SOURCE_FILENAME_OVERRIDES).filter(
        (id) => AVATAR_SOURCE_FILENAME_OVERRIDES[id] === filename,
      ),
    ]),
  ]
}
