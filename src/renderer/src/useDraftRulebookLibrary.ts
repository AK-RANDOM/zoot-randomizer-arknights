import { useEffect, useMemo, useState } from 'react'
import type { OperatorDataset } from '../../shared/operator'
import {
  STANDARD_DRAFT_RULEBOOK,
  STANDARD_DRAFT_RULEBOOK_ID,
  validateDraftRulebook,
  type DraftRulebook,
} from '../../shared/draftRulebook'
import { analyzeDraftRulebookImport } from '../../shared/draftRulebookPortability'
import {
  createLocalDraftRulebook,
  loadDraftRulebookEntries,
  prepareImportedDraftRulebook,
  saveDraftRulebookEntries,
} from './draftRulebookStorage'
import type { RulebookLibraryEntry } from './rendererPersistence'

export type RulebookPortabilityStatus = {
  tone: 'success' | 'warning' | 'error'
  title: string
  details: string[]
}

function cloneRulebook(rulebook: DraftRulebook): DraftRulebook {
  return JSON.parse(JSON.stringify(rulebook)) as DraftRulebook
}

function builtInEntry(): RulebookLibraryEntry {
  return {
    document: cloneRulebook(STANDARD_DRAFT_RULEBOOK),
    origin: 'built-in',
    editor: { lastEditedAt: null },
  }
}

export interface DraftRulebookLibraryController {
  entries: RulebookLibraryEntry[]
  customEntries: RulebookLibraryEntry[]
  localEntries: RulebookLibraryEntry[]
  importedEntries: RulebookLibraryEntry[]
  selectedEntry: RulebookLibraryEntry
  selected: DraftRulebook
  selectedId: string
  builtIn: boolean
  imported: boolean
  validation: ReturnType<typeof validateDraftRulebook>
  portabilityStatus: RulebookPortabilityStatus | null
  select: (id: string) => void
  updateSelected: (mutate: (draft: DraftRulebook) => void) => void
  createNew: () => void
  duplicateSelected: () => void
  deleteSelected: () => void
  importSerialized: (serialized: string) => void
  setPortabilityStatus: (status: RulebookPortabilityStatus | null) => void
}

export default function useDraftRulebookLibrary(dataset: OperatorDataset): DraftRulebookLibraryController {
  const [customEntries, setCustomEntries] = useState<RulebookLibraryEntry[]>(() => loadDraftRulebookEntries())
  const [selectedId, setSelectedId] = useState<string>(STANDARD_DRAFT_RULEBOOK_ID)
  const [portabilityStatus, setPortabilityStatus] = useState<RulebookPortabilityStatus | null>(null)

  useEffect(() => saveDraftRulebookEntries(customEntries), [customEntries])

  const builtIn = useMemo(() => builtInEntry(), [])
  const entries = useMemo(() => [builtIn, ...customEntries], [builtIn, customEntries])
  const localEntries = useMemo(() => customEntries.filter((entry) => entry.origin === 'local'), [customEntries])
  const importedEntries = useMemo(() => customEntries.filter((entry) => entry.origin === 'imported'), [customEntries])
  const selectedEntry = entries.find((entry) => entry.document.identifier.id === selectedId) ?? builtIn
  const selected = selectedEntry.document
  const selectedIsBuiltIn = selectedEntry.origin === 'built-in'
  const imported = selectedEntry.origin === 'imported'
  const validation = useMemo(() => validateDraftRulebook(selected), [selected])

  useEffect(() => {
    if (selected.identifier.id !== selectedId) setSelectedId(selected.identifier.id)
  }, [selected.identifier.id, selectedId])

  const updateSelected = (mutate: (draft: DraftRulebook) => void): void => {
    if (selectedIsBuiltIn) return
    setCustomEntries((current) => current.map((entry) => {
      if (entry.document.identifier.id !== selected.identifier.id) return entry
      const document = cloneRulebook(entry.document)
      mutate(document)
      return {
        ...entry,
        document,
        editor: { ...entry.editor, lastEditedAt: new Date().toISOString() },
      }
    }))
  }

  const createNew = (): void => {
    const document = createLocalDraftRulebook()
    setCustomEntries((current) => [...current, {
      document,
      origin: 'local',
      editor: { lastEditedAt: new Date().toISOString() },
    }])
    setSelectedId(document.identifier.id)
    setPortabilityStatus(null)
  }

  const duplicateSelected = (): void => {
    if (!validation.valid) return
    const document = createLocalDraftRulebook(selected)
    setCustomEntries((current) => [...current, {
      document,
      origin: 'local',
      editor: { lastEditedAt: new Date().toISOString() },
    }])
    setSelectedId(document.identifier.id)
    setPortabilityStatus(null)
  }

  const deleteSelected = (): void => {
    if (selectedIsBuiltIn) return
    setCustomEntries((current) => current.filter((entry) => entry.document.identifier.id !== selected.identifier.id))
    setSelectedId(STANDARD_DRAFT_RULEBOOK_ID)
    setPortabilityStatus(null)
  }

  const importSerialized = (serialized: string): void => {
    const analysis = analyzeDraftRulebookImport(serialized, dataset)
    if (!analysis.rulebook) {
      setPortabilityStatus({
        tone: 'error',
        title: 'Draft Rulebook import rejected',
        details: analysis.errors.length > 0 ? analysis.errors : ['The file is not compatible with this app.'],
      })
      return
    }

    const prepared = prepareImportedDraftRulebook(
      analysis.rulebook,
      entries.map((entry) => entry.document),
    )
    setCustomEntries((current) => [...current, {
      document: prepared.rulebook,
      origin: 'imported',
      editor: { lastEditedAt: new Date().toISOString() },
    }])
    setSelectedId(prepared.rulebook.identifier.id)

    const details = [...analysis.warnings]
    if (prepared.identityChanged) {
      details.unshift('The imported stable ID already existed locally, so this copy received a new local ID instead of overwriting the existing Rulebook.')
    }
    if (prepared.nameChanged) {
      details.unshift(`The imported Rulebook was renamed to “${prepared.rulebook.identifier.name}” to avoid a library name collision.`)
    }
    setPortabilityStatus({
      tone: details.length > 0 ? 'warning' : 'success',
      title: details.length > 0 ? 'Draft Rulebook imported with compatibility notes' : 'Draft Rulebook imported',
      details,
    })
  }

  return {
    entries,
    customEntries,
    localEntries,
    importedEntries,
    selectedEntry,
    selected,
    selectedId: selected.identifier.id,
    builtIn: selectedIsBuiltIn,
    imported,
    validation,
    portabilityStatus,
    select: setSelectedId,
    updateSelected,
    createNew,
    duplicateSelected,
    deleteSelected,
    importSerialized,
    setPortabilityStatus,
  }
}
