import { useEffect, useMemo, useState } from 'react'
import type { ImportedArknightsAccount } from '../../shared/arknightsAccount'
import { importedAccountEquippedSkinId } from '../../shared/arknightsAccountReconciliation'
import type { Operator } from '../../shared/operator'
import type { OperatorAppearanceChoice, OperatorPreferences } from '../../shared/operatorPool'
import { skinDisplayName } from '../../shared/skinMetadata'
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
): AccountAppearanceResolution {
  if (!snapshot) return { equippedSkinId: null, choice: null, recognized: false }

  const equippedSkinId = importedAccountEquippedSkinId(snapshot, operator.id)
  if (!equippedSkinId) return { equippedSkinId: null, choice: null, recognized: true }

  const defaultChoice = defaultArtAppearance(operator, equippedSkinId)
  if (defaultChoice) return { equippedSkinId, choice: defaultChoice, recognized: true }

  const skin = operator.skins?.find((candidate) => candidate.id === equippedSkinId)
  if (skin) return { equippedSkinId, choice: `skin:${skin.id}`, recognized: true }

  return { equippedSkinId, choice: null, recognized: false }
}

export function resolveRandomAppearance(
  operator: Operator,
  seed: number,
): ResolvedOperatorAppearanceChoice {
  const candidates: ResolvedOperatorAppearanceChoice[] = ['e1', 'e2']
  for (const skin of operator.skins ?? []) candidates.push(`skin:${skin.id}`)
  return candidates[hashString(`${seed}:${operator.id}`) % candidates.length]
}

export function resolveAppearanceChoice(
  operator: Operator,
  choice: OperatorAppearanceChoice,
  randomSeed: number,
  accountAppearance: ResolvedOperatorAppearanceChoice | null = null,
): ResolvedOperatorAppearanceChoice {
  if (choice === 'account') return accountAppearance ?? 'e2'
  if (choice !== 'random') return choice
  return resolveRandomAppearance(operator, randomSeed)
}

export function appearanceLabel(
  operator: Operator,
  choice: OperatorAppearanceChoice,
  locale: OperatorPreferences['gameLocale'],
  randomSeed: number,
  accountResolution?: AccountAppearanceResolution | null,
): string {
  const resolved = resolveAppearanceChoice(
    operator,
    choice,
    randomSeed,
    accountResolution?.choice ?? null,
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

export function useOperatorAppearanceImage(
  operator: Operator,
  override?: { choice: OperatorAppearanceChoice; randomSeed: number },
): { imageUrl: string | null; usingPortrait: boolean; choice: OperatorAppearanceChoice } {
  const revision = useAppearanceRevision()
  const preferences = useMemo(
    () => loadOperatorPreferences(),
    [revision, override?.choice, override?.randomSeed],
  )
  const choice = override?.choice ?? appearanceChoiceForOperator(preferences, operator.id)
  const randomSeed = override?.randomSeed ?? preferences.appearanceRandomSeed
  const accountResolution = resolveAccountAppearance(operator, getCachedImportedArknightsAccount())
  const resolved = resolveAppearanceChoice(operator, choice, randomSeed, accountResolution.choice)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [usingPortrait, setUsingPortrait] = useState(false)

  useEffect(() => {
    let active = true
    setImageUrl(null)
    setUsingPortrait(false)

    const fallback = async (): Promise<void> => {
      const portrait = await window.desktop.getOperatorPortrait(operator.id, 'e2')
      if (!active) return
      if (portrait) {
        setUsingPortrait(true)
        setImageUrl(portrait)
        return
      }
      const avatar = await window.desktop.getOperatorImage(operator.id)
      if (active) {
        setUsingPortrait(false)
        setImageUrl(avatar)
      }
    }

    const load = async (): Promise<void> => {
      if (resolved === 'e1' || resolved === 'e2') {
        const portrait = await window.desktop.getOperatorPortrait(operator.id, resolved)
        if (!active) return
        if (portrait) {
          setUsingPortrait(true)
          setImageUrl(portrait)
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
      const portrait = await window.desktop.getOperatorSkinPortrait(operator.id, skin.id)
      if (!active) return
      if (portrait) {
        setUsingPortrait(true)
        setImageUrl(portrait)
        return
      }
      await fallback()
    }

    void load().catch(() => void fallback())
    return () => {
      active = false
    }
  }, [operator, resolved])

  return { imageUrl, usingPortrait, choice }
}

export function useOperatorAppearanceAvatar(
  operator: Operator,
  override?: { choice: OperatorAppearanceChoice; randomSeed: number },
): { imageUrl: string | null; choice: OperatorAppearanceChoice } {
  const revision = useAppearanceRevision()
  const preferences = useMemo(
    () => loadOperatorPreferences(),
    [revision, override?.choice, override?.randomSeed],
  )
  const choice = override?.choice ?? appearanceChoiceForOperator(preferences, operator.id)
  const randomSeed = override?.randomSeed ?? preferences.appearanceRandomSeed
  const accountResolution = resolveAccountAppearance(operator, getCachedImportedArknightsAccount())
  const resolved = resolveAppearanceChoice(operator, choice, randomSeed, accountResolution.choice)
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
