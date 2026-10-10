import { useMemo, useRef, useState } from 'react'
import type { OperatorDataset } from '../../shared/operator'
import type { DraftRulebook } from '../../shared/draftRulebook'
import {
  analyzeDraftPricingCsv,
  applyDraftPricingCsv,
  draftPricingProfileExportFileName,
  serializeDraftPricingCsv,
  type DraftPricingCsvAnalysis,
} from '../../shared/draftPricingProfile'
import type { DraftPricingProfileController } from './useDraftPricingProfiles'

export default function DraftPricingProfileEditor({
  dataset,
  controller,
  rulebook,
  rulebookBuiltIn,
  onRulebookChange,
}: {
  dataset: OperatorDataset
  controller: DraftPricingProfileController
  rulebook: DraftRulebook
  rulebookBuiltIn: boolean
  onRulebookChange: (mutate: (draft: DraftRulebook) => void) => void
}): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [analysis, setAnalysis] = useState<DraftPricingCsvAnalysis | null>(null)
  const [importFileName, setImportFileName] = useState<string | null>(null)
  const selected = controller.selected

  const visibleOperators = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return [...dataset.operators]
      .filter(
        (operator) =>
          !needle ||
          operator.name.toLocaleLowerCase().includes(needle) ||
          operator.id.toLocaleLowerCase().includes(needle),
      )
      .sort((left, right) => right.rarity - left.rarity || left.name.localeCompare(right.name))
  }, [dataset.operators, query])

  const importCsv = async (file: File): Promise<void> => {
    const serialized = await file.text()
    setAnalysis(analyzeDraftPricingCsv(serialized, dataset))
    setImportFileName(file.name)
  }

  const applyImport = (): void => {
    if (!analysis?.valid || controller.builtIn) return
    controller.updateSelected((profile) => {
      profile.operatorCosts = applyDraftPricingCsv(profile.operatorCosts, analysis, importMode)
      profile.revision = `${Number(profile.revision) + 1 || 1}`
    })
    setAnalysis(null)
    setImportFileName(null)
  }

  const exportCsv = (): void => {
    const blob = new Blob([serializeDraftPricingCsv(selected)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = draftPricingProfileExportFileName(selected)
    link.click()
    URL.revokeObjectURL(url)
  }

  const setOperatorCost = (operatorId: string, raw: string): void => {
    if (controller.builtIn) return
    controller.updateSelected((profile) => {
      if (raw.trim() === '') {
        delete profile.operatorCosts[operatorId]
        return
      }
      const cost = Number(raw)
      if (!Number.isFinite(cost) || !Number.isInteger(cost)) return
      profile.operatorCosts[operatorId] = cost
    })
  }

  return (
    <>
      <fieldset className="constraint-group rulebook-editor-section rulebook-wide-section">
        <legend>Operator Pricing Profiles</legend>
        <label className="field pricing-rulebook-profile">
          <span>Profile used by {rulebook.identifier.name}</span>
          <select
            disabled={rulebookBuiltIn}
            value={rulebook.generalRules.pricingProfileId ?? ''}
            onChange={(event) =>
              onRulebookChange((draft) => {
                draft.generalRules.pricingProfileId = event.target.value || null
              })
            }
          >
            <option value="">None — use Rulebook rarity fallback only</option>
            {controller.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
        <div className="pricing-profile-toolbar">
          <label className="field">
            <span>Profile</span>
            <select value={selected.id} onChange={(event) => controller.select(event.target.value)}>
              <optgroup label="Built-in">
                {controller.profiles
                  .filter((profile) => profile.id.startsWith('builtin:'))
                  .map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
              </optgroup>
              {controller.customProfiles.length > 0 && (
                <optgroup label="Custom">
                  {controller.customProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <button type="button" onClick={controller.createNew}>
            New
          </button>
          <button type="button" onClick={controller.duplicateSelected}>
            Duplicate
          </button>
          <button type="button" disabled={controller.builtIn} onClick={controller.deleteSelected}>
            Delete
          </button>
          <button type="button" onClick={exportCsv}>
            Export CSV
          </button>
          <button
            type="button"
            disabled={controller.builtIn}
            onClick={() => fileInputRef.current?.click()}
          >
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importCsv(file)
              event.target.value = ''
            }}
          />
        </div>

        <div className="rulebook-inline-fields rulebook-inline-fields--three">
          <label className="field">
            <span>Name</span>
            <input
              disabled={controller.builtIn}
              value={selected.name}
              onChange={(event) =>
                controller.updateSelected((profile) => {
                  profile.name = event.target.value
                })
              }
            />
          </label>
          <label className="field">
            <span>Revision</span>
            <input
              disabled={controller.builtIn}
              value={selected.revision}
              onChange={(event) =>
                controller.updateSelected((profile) => {
                  profile.revision = event.target.value
                })
              }
            />
          </label>
          <label className="field">
            <span>Internal profile ID</span>
            <input disabled value={selected.id} />
          </label>
        </div>
        <label className="field">
          <span>Description</span>
          <textarea
            disabled={controller.builtIn}
            value={selected.description}
            onChange={(event) =>
              controller.updateSelected((profile) => {
                profile.description = event.target.value
              })
            }
          />
        </label>
        <p className="rulebook-readout">
          <span>{Object.keys(selected.operatorCosts).length} explicit operator prices</span>
          {controller.builtIn && <span>Built-in profile — duplicate it to edit.</span>}
        </p>
      </fieldset>

      {analysis && (
        <fieldset className="constraint-group rulebook-editor-section rulebook-wide-section pricing-import-preview">
          <legend>CSV Import Preview</legend>
          <div className="rulebook-inline-fields rulebook-inline-fields--three">
            <label className="field">
              <span>Import mode</span>
              <select
                value={importMode}
                onChange={(event) => setImportMode(event.target.value as 'merge' | 'replace')}
              >
                <option value="merge">Merge — update only IDs in the CSV</option>
                <option value="replace">Replace — CSV becomes the whole profile</option>
              </select>
            </label>
            <div className="rulebook-readout">
              <strong>{importFileName}</strong>
              <span>{analysis.updatedCount} valid rows</span>
            </div>
            <div className="rulebook-readout">
              <span>
                {analysis.unknownCount} unknown · {analysis.duplicateCount} duplicate ·{' '}
                {analysis.invalidCount} invalid
              </span>
            </div>
          </div>
          {analysis.issues.length > 0 && (
            <ul className="pricing-import-issues">
              {analysis.issues.slice(0, 20).map((issue, index) => (
                <li key={`${issue.row}:${issue.code}:${index}`}>{issue.message}</li>
              ))}
              {analysis.issues.length > 20 && (
                <li>…and {analysis.issues.length - 20} more issues.</li>
              )}
            </ul>
          )}
          <div className="pricing-import-actions">
            <button
              type="button"
              onClick={() => {
                setAnalysis(null)
                setImportFileName(null)
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!analysis.valid || controller.builtIn}
              onClick={applyImport}
            >
              Apply import
            </button>
          </div>
        </fieldset>
      )}

      <fieldset className="constraint-group rulebook-editor-section rulebook-wide-section">
        <legend>Operator Prices</legend>
        <label className="field pricing-profile-search">
          <span>Search operator or internal ID</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. Exusiai or char_103_angel"
          />
        </label>
        <div className="pricing-operator-table" role="table" aria-label="Operator pricing table">
          <div className="pricing-operator-row pricing-operator-row--header" role="row">
            <strong>Operator</strong>
            <strong>Internal ID</strong>
            <strong>Rarity</strong>
            <strong>Profile base cost</strong>
          </div>
          {visibleOperators.map((operator) => (
            <div className="pricing-operator-row" role="row" key={operator.id}>
              <span>{operator.name}</span>
              <code>{operator.id}</code>
              <span>{operator.rarity}★</span>
              <input
                aria-label={`Base cost for ${operator.name}`}
                type="number"
                step={1}
                disabled={controller.builtIn}
                placeholder="Rulebook fallback"
                value={selected.operatorCosts[operator.id] ?? ''}
                onChange={(event) => setOperatorCost(operator.id, event.target.value)}
              />
            </div>
          ))}
        </div>
      </fieldset>
    </>
  )
}
