import { useRef, type ChangeEvent } from 'react'
import {
  serializeDraftRulebook,
  STANDARD_DRAFT_RULEBOOK,
  STANDARD_DRAFT_RULEBOOK_ID,
} from '../../shared/draftRulebook'
import {
  MAX_DRAFT_RULEBOOK_FILE_BYTES,
  draftRulebookExportFileName,
} from '../../shared/draftRulebookPortability'
import { selectorCount } from './draftRulebookEditorUtils'
import type { DraftRulebookLibraryController } from './useDraftRulebookLibrary'

export default function DraftRulebookLibrary({
  library,
  overrideCount,
}: {
  library: DraftRulebookLibraryController
  overrideCount: number
}): React.JSX.Element {
  const importInputRef = useRef<HTMLInputElement>(null)

  const importRulebook = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    try {
      if (file.size > MAX_DRAFT_RULEBOOK_FILE_BYTES) {
        library.setPortabilityStatus({
          tone: 'error',
          title: 'Draft Rulebook import rejected',
          details: [`The selected file is larger than ${MAX_DRAFT_RULEBOOK_FILE_BYTES / (1024 * 1024)} MiB.`],
        })
        return
      }
      library.importSerialized(await file.text())
    } catch (reason) {
      library.setPortabilityStatus({
        tone: 'error',
        title: 'Draft Rulebook import failed',
        details: [reason instanceof Error ? reason.message : String(reason)],
      })
    } finally {
      input.value = ''
    }
  }

  const exportSelected = (): void => {
    if (!library.validation.valid) return
    try {
      const serialized = serializeDraftRulebook(library.selected)
      const blob = new Blob([serialized], { type: 'application/json' })
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = draftRulebookExportFileName(library.selected)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(href), 0)
      library.setPortabilityStatus({
        tone: 'success',
        title: 'Draft Rulebook exported',
        details: [`Exported ${library.selected.identifier.name} as portable schema v${library.selected.schemaVersion} JSON.`],
      })
    } catch (reason) {
      library.setPortabilityStatus({
        tone: 'error',
        title: 'Draft Rulebook export failed',
        details: [reason instanceof Error ? reason.message : String(reason)],
      })
    }
  }

  const deleteSelected = (): void => {
    if (library.builtIn || !window.confirm(`Delete Draft Rulebook “${library.selected.identifier.name}”?`)) return
    library.deleteSelected()
  }

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">SETUP • DRAFT RULEBOOKS</p>
          <h2 id="rulebook-heading">Draft Rulebooks</h2>
        </div>
        <div className="section-actions">
          <button type="button" className="secondary-button" onClick={library.createNew}>New</button>
          <button type="button" className="secondary-button" onClick={() => importInputRef.current?.click()}>Import</button>
          <button type="button" className="secondary-button" disabled={!library.validation.valid} onClick={exportSelected}>Export</button>
          <button type="button" className="secondary-button" disabled={!library.validation.valid} onClick={library.duplicateSelected}>Duplicate</button>
          <button type="button" className="secondary-button" disabled={library.builtIn} onClick={deleteSelected}>Delete</button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,.draft-rulebook.json,application/json"
            hidden
            onChange={(event) => { void importRulebook(event) }}
          />
        </div>
      </div>

      <div className="rulebook-library-toolbar">
        <label className="field">
          <span>Rulebook</span>
          <select value={library.selectedId} onChange={(event) => library.select(event.target.value)}>
            <optgroup label="Built-in">
              <option value={STANDARD_DRAFT_RULEBOOK_ID}>{STANDARD_DRAFT_RULEBOOK.identifier.name}</option>
            </optgroup>
            {library.importedEntries.length > 0 && (
              <optgroup label="Imported">
                {library.importedEntries.map((entry) => (
                  <option key={entry.document.identifier.id} value={entry.document.identifier.id}>{entry.document.identifier.name}</option>
                ))}
              </optgroup>
            )}
            {library.localEntries.length > 0 && (
              <optgroup label="Local">
                {library.localEntries.map((entry) => (
                  <option key={entry.document.identifier.id} value={entry.document.identifier.id}>{entry.document.identifier.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <div className="rulebook-library-summary">
          <strong>{library.builtIn ? 'Built-in • read-only' : library.imported ? 'Imported Rulebook' : 'Local Rulebook'}</strong>
          <span>Schema v{library.selected.schemaVersion}</span>
          <span>Revision {library.selected.identifier.revision}</span>
          <span>{selectorCount(library.selected)} pool selector{selectorCount(library.selected) === 1 ? '' : 's'}</span>
          <span>{overrideCount} override{overrideCount === 1 ? '' : 's'}</span>
          <span>{library.selected.interactions.length} interaction{library.selected.interactions.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {library.portabilityStatus && (
        library.portabilityStatus.tone === 'error' ? (
          <div className="validation-box" role="alert">
            <strong>{library.portabilityStatus.title}</strong>
            {library.portabilityStatus.details.length > 0 && <ul>{library.portabilityStatus.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
          </div>
        ) : (
          <div className="rulebook-placeholder-box" role="status">
            <strong>{library.portabilityStatus.title}</strong>
            {library.portabilityStatus.details.length > 0 && <ul>{library.portabilityStatus.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
          </div>
        )
      )}

      {!library.validation.valid && (
        <div className="validation-box" role="alert">
          <strong>Rulebook needs attention</strong>
          <ul>{library.validation.errors.map((error) => <li key={error}>{error}</li>)}</ul>
          {!library.builtIn && <small className="filter-note">This draft remains saved while invalid, but execution and export stay blocked until the errors are fixed.</small>}
        </div>
      )}
    </>
  )
}
