import { useEffect, useMemo, useState } from 'react'
import type { ImportedArknightsAccount } from '../../shared/arknightsAccount'
import { importedAccountEquippedSkinId } from '../../shared/arknightsAccountReconciliation'
import type { Operator, ReleaseServer } from '../../shared/operator'
import type { OperatorAppearanceChoice, OperatorPreferences } from '../../shared/operatorPool'
import { skinDisplayName, skinAvailableInRegion } from '../../shared/skinMetadata'
import { loadOperatorArtwork } from './rendererPersistence'
import { loadOperatorPreferences } from './operatorPreferencesStorage'
import {
  getCachedImportedArknightsAccount,
  subscribeImportedArknightsAccount,
} from './arknightsAccountState'

export const OPERATOR_APPEARANCE_EVENT = 'arknights-randomizer:operator-appearance-changed'

const AMIYA_E2_DEFAULT_FORM_IDS = new Set(['char_1001_amiya2', 'char_1037_amiya3'])

export type ResolvedOperatorAppearanceChoice = Exclude<
  OperatorAppearanceChoice,
  'random' | 'account'
>

export interface AccountAppearanceResolution {
  equippedSkinId: string | null
  choice: ResolvedOperatorAppearanceChoice | null
  recognized: boolean
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function appearanceChoiceForOperator(
  preferences: OperatorPreferences,
  operatorId: string,
): OperatorAppearanceChoice {
  return preferences.operatorAppearances[operatorId] ?? loadOperatorArtwork()
}

function defaultArtAppearance(
  operator: Operator,
  skinId: string,
): ResolvedOperatorAppearanceChoice | null {
  const arts = operator.defaultArts ?? []
  const index = arts.findIndex((art) => art.id === skinId)
  if (index < 0) return null
  if (arts.length <= 1) return AMIYA_E2_DEFAULT_FORM_IDS.has(operator.id) ? 'e2' : 'e1'
  if (index === 0) return 'e1'
  if (index === arts.length - 1) return 'e2'
  return `skin:${skinId}`
}

export function resolveAccountAppearance(
  operator: Operator,
  snapshot: ImportedArknightsAccount | null | undefined,
  region: ReleaseServer = 'cn',
): AccountAppearanceResolution {
  if (!snapshot) return { equippedSkinId: null, choice: null, recognized: false }

  const equippedSkinId = importedAccountEquippedSkinId(snapshot, operator.id)
  if (!equippedSkinId) return { equippedSkinId: null, choice: null, recognized: true }

  const defaultChoice = defaultArtAppearance(operator, equippedSkinId)
  if (defaultChoice) return { equippedSkinId, choice: defaultChoice, recognized: true }

  const skin = operator.skins?.find((candidate) => candidate.id === equippedSkinId)
  if (skin)
    return {
      equippedSkinId,
      choice: skinAvailableInRegion(skin, region) ? `skin:${skin.id}` : null,
      recognized: true,
    }

  return { equippedSkinId, choice: null, recognized: false }
}

export function resolveRandomAppearance(
  operator: Operator,
  seed: number,
  region: ReleaseServer = 'cn',
): ResolvedOperatorAppearanceChoice {
  const candidates: ResolvedOperatorAppearanceChoice[] = ['e1', 'e2']
  for (const skin of operator.skins ?? []) {
    if (skinAvailableInRegion(skin, region)) candidates.push(`skin:${skin.id}`)
  }
  return candidates[hashString(`${seed}:${operator.id}`) % candidates.length]
}

export function resolveAppearanceChoice(
  operator: Operator,
  choice: OperatorAppearanceChoice,
  randomSeed: number,
  accountAppearance: ResolvedOperatorAppearanceChoice | null = null,
  region: ReleaseServer = 'cn',
): ResolvedOperatorAppearanceChoice {
  if (choice === 'random') return resolveRandomAppearance(operator, randomSeed, region)
  const resolved = choice === 'account' ? (accountAppearance ?? 'e2') : choice
  return appearanceAvailableInRegion(operator, resolved, region) ? resolved : 'e2'
}

export function appearanceAvailableInRegion(
  operator: Operator,
  choice: ResolvedOperatorAppearanceChoice,
  region: ReleaseServer,
): boolean {
  if (!choice.startsWith('skin:')) return true
  const skin = operator.skins?.find((candidate) => candidate.id === choice.slice(5))
  return Boolean(skin && skinAvailableInRegion(skin, region))
}

export function changeAppearanceRegion(
  preferences: OperatorPreferences,
  operators: Operator[],
  region: ReleaseServer,
  account: ImportedArknightsAccount | null = null,
): OperatorPreferences {
  if (preferences.metadataRegion === region) return preferences
  const operatorAppearances = { ...preferences.operatorAppearances }
  for (const operator of operators) {
    const choice = appearanceChoiceForOperator(preferences, operator.id)
    const accountChoice = resolveAccountAppearance(operator, account).choice
    if (region === 'global') {
      const resolved = resolveAppearanceChoice(
        operator,
        choice,
        preferences.appearanceRandomSeed,
        accountChoice,
      )
      if (!appearanceAvailableInRegion(operator, resolved, region)) {
        const fallback =
          preferences.defaultAppearance === 'account' ? 'e2' : preferences.defaultAppearance
        operatorAppearances[operator.id] = resolveAppearanceChoice(
          operator,
          fallback,
          preferences.appearanceRandomSeed,
          null,
          region,
        )
      } else if (choice === 'random') {
        operatorAppearances[operator.id] = resolved
      }
    } else if (choice === 'random') {
      // Preserve the displayed outfit when expanding the random pool from EN to CN.
      operatorAppearances[operator.id] = resolveRandomAppearance(
        operator,
        preferences.appearanceRandomSeed,
        preferences.metadataRegion,
      )
    } else if (
      choice === 'account' &&
      accountChoice &&
      !appearanceAvailableInRegion(operator, accountChoice, preferences.metadataRegion)
    ) {
      operatorAppearances[operator.id] = 'e2'
    }
  }
  return { ...preferences, metadataRegion: region, operatorAppearances }
}

export function appearanceLabel(
  operator: Operator,
  choice: OperatorAppearanceChoice,
  locale: OperatorPreferences['gameLocale'],
  randomSeed: number,
  accountResolution?: AccountAppearanceResolution | null,
  region: ReleaseServer = 'cn',
): string {
  const resolved = resolveAppearanceChoice(
    operator,
    choice,
    randomSeed,
    accountResolution?.choice ?? null,
    region,
  )
  if (choice === 'account') {
    if (!accountResolution?.equippedSkinId) return 'Account equipped · E2 fallback'
    if (!accountResolution.recognized) return 'Account equipped · unknown skin · E2 fallback'
    if (resolved === 'e1' || resolved === 'e2')
      return `Account equipped · ${resolved.toUpperCase()}`
    const skin = operator.skins?.find((candidate) => `skin:${candidate.id}` === resolved)
    return skin
      ? `Account equipped · ${skinDisplayName(skin, locale)}`
      : 'Account equipped · E2 fallback'
  }
  if (resolved === 'e1') return 'E1'
  if (resolved === 'e2') return 'E2'
  const skin = operator.skins?.find((candidate) => `skin:${candidate.id}` === resolved)
  return skin ? skinDisplayName(skin, locale) : 'E2'
}

export function notifyOperatorAppearanceChanged(): void {
  window.dispatchEvent(new Event(OPERATOR_APPEARANCE_EVENT))
}

function useAppearanceRevision(): number {
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const changed = (): void => setRevision((current) => current + 1)
    window.addEventListener(OPERATOR_APPEARANCE_EVENT, changed)
    const unsubscribeAccount = subscribeImportedArknightsAccount(changed)
    return () => {
      window.removeEventListener(OPERATOR_APPEARANCE_EVENT, changed)
      unsubscribeAccount()
    }
  }, [])
  return revision
}

type AppearanceOverride = { choice: OperatorAppearanceChoice; randomSeed: number }

function useResolvedOperatorAppearance(operator: Operator, override?: AppearanceOverride) {
  const revision = useAppearanceRevision()
  const preferences = useMemo(
    () => loadOperatorPreferences(),
    [revision, override?.choice, override?.randomSeed],
  )
  const choice = override?.choice ?? appearanceChoiceForOperator(preferences, operator.id)
  const randomSeed = override?.randomSeed ?? preferences.appearanceRandomSeed
  const accountResolution = resolveAccountAppearance(
    operator,
    getCachedImportedArknightsAccount(),
    preferences.metadataRegion,
  )
  const resolved = resolveAppearanceChoice(
    operator,
    choice,
    randomSeed,
    accountResolution.choice,
    preferences.metadataRegion,
  )
  return { choice, resolved }
}

export function useOperatorAppearanceImage(operator: Operator, override?: AppearanceOverride) {
  const { choice, resolved } = useResolvedOperatorAppearance(operator, override)
  const [artwork, setArtwork] = useState<{
    operator: Operator
    resolved: ResolvedOperatorAppearanceChoice
    imageUrl: string | null
    usingPortrait: boolean
  } | null>(null)

  useEffect(() => {
    let active = true

    const load = async (): Promise<void> => {
      let portrait: string | null = null
      if (resolved === 'e1' || resolved === 'e2') {
        portrait = await window.desktop.getOperatorPortrait(operator.id, resolved).catch(() => null)
      } else {
        const skinId = resolved.slice(5)
        if (operator.skins?.some((skin) => skin.id === skinId)) {
          portrait = await window.desktop
            .getOperatorSkinPortrait(operator.id, skinId)
            .catch(() => null)
        }
      }

      if (active && !portrait && resolved !== 'e2') {
        portrait = await window.desktop.getOperatorPortrait(operator.id, 'e2').catch(() => null)
      }
      if (!active) return
      if (portrait) {
        setArtwork({ operator, resolved, imageUrl: portrait, usingPortrait: true })
        return
      }
      const avatar = await window.desktop.getOperatorImage(operator.id).catch(() => null)
      if (active) setArtwork({ operator, resolved, imageUrl: avatar, usingPortrait: false })
    }

    void load()
    return () => {
      active = false
    }
  }, [operator, resolved])

  const current = artwork?.operator === operator && artwork.resolved === resolved ? artwork : null
  return {
    imageUrl: current?.imageUrl ?? null,
    usingPortrait: current?.usingPortrait ?? false,
    loading: current === null,
    choice,
  }
}

export function useOperatorAppearanceAvatar(
  operator: Operator,
  override?: AppearanceOverride,
): { imageUrl: string | null; choice: OperatorAppearanceChoice } {
  const { choice, resolved } = useResolvedOperatorAppearance(operator, override)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setImageUrl(null)

    const fallback = async (): Promise<void> => {
      const avatar = await window.desktop.getOperatorImage(operator.id)
      if (active) setImageUrl(avatar)
    }

    const load = async (): Promise<void> => {
      if (resolved === 'e1' || resolved === 'e2') {
        const avatar = await window.desktop.getOperatorPromotionAvatar(operator.id, resolved)
        if (!active) return
        if (avatar) {
          setImageUrl(avatar)
          return
        }
        await fallback()
        return
      }

      const skinId = resolved.slice(5)
      const skin = operator.skins?.find((candidate) => candidate.id === skinId)
      if (!skin) {
        await fallback()
        return
      }
      const avatar = await window.desktop.getOperatorSkinAvatar(operator.id, skin.id)
      if (!active) return
      if (avatar) {
        setImageUrl(avatar)
        return
      }
      await fallback()
    }

    void load().catch(() => void fallback())
    return () => {
      active = false
    }
  }, [operator, resolved])

  return { imageUrl, choice }
}
