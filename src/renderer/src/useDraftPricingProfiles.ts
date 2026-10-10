import { useEffect, useMemo, useState } from 'react'
import {
  BUILT_IN_DRAFT_PRICING_PROFILES,
  SHARED_BALANCE_PRICING_PROFILE_ID,
  type DraftPricingProfile,
} from '../../shared/draftPricingProfile'
import {
  createLocalDraftPricingProfile,
  loadCustomDraftPricingProfiles,
  saveCustomDraftPricingProfiles,
} from './draftPricingProfileStorage'

function cloneProfile(profile: DraftPricingProfile): DraftPricingProfile {
  return JSON.parse(JSON.stringify(profile)) as DraftPricingProfile
}

export interface DraftPricingProfileController {
  profiles: DraftPricingProfile[]
  customProfiles: DraftPricingProfile[]
  selected: DraftPricingProfile
  selectedId: string
  builtIn: boolean
  select: (id: string) => void
  createNew: () => void
  duplicateSelected: () => void
  deleteSelected: () => void
  updateSelected: (mutate: (profile: DraftPricingProfile) => void) => void
}

export default function useDraftPricingProfiles(): DraftPricingProfileController {
  const [customProfiles, setCustomProfiles] = useState<DraftPricingProfile[]>(() =>
    loadCustomDraftPricingProfiles(),
  )
  const [selectedId, setSelectedId] = useState<string>(SHARED_BALANCE_PRICING_PROFILE_ID)

  useEffect(() => saveCustomDraftPricingProfiles(customProfiles), [customProfiles])

  const builtIns = useMemo(() => BUILT_IN_DRAFT_PRICING_PROFILES.map(cloneProfile), [])
  const profiles = useMemo(() => [...builtIns, ...customProfiles], [builtIns, customProfiles])
  const selected = profiles.find((profile) => profile.id === selectedId) ?? builtIns[0]
  const builtIn = builtIns.some((profile) => profile.id === selected.id)

  useEffect(() => {
    if (selected.id !== selectedId) setSelectedId(selected.id)
  }, [selected.id, selectedId])

  const createNew = (): void => {
    const profile = createLocalDraftPricingProfile()
    setCustomProfiles((current) => [...current, profile])
    setSelectedId(profile.id)
  }

  const duplicateSelected = (): void => {
    const profile = createLocalDraftPricingProfile(selected)
    setCustomProfiles((current) => [...current, profile])
    setSelectedId(profile.id)
  }

  const deleteSelected = (): void => {
    if (builtIn) return
    setCustomProfiles((current) => current.filter((profile) => profile.id !== selected.id))
    setSelectedId(SHARED_BALANCE_PRICING_PROFILE_ID)
  }

  const updateSelected = (mutate: (profile: DraftPricingProfile) => void): void => {
    if (builtIn) return
    setCustomProfiles((current) =>
      current.map((profile) => {
        if (profile.id !== selected.id) return profile
        const next = cloneProfile(profile)
        mutate(next)
        return next
      }),
    )
  }

  return {
    profiles,
    customProfiles,
    selected,
    selectedId: selected.id,
    builtIn,
    select: setSelectedId,
    createNew,
    duplicateSelected,
    deleteSelected,
    updateSelected,
  }
}
