import type { DraftRulebook } from '../../shared/draftRulebook'

function displayDate(value: string | null): string {
  if (!value) return '—'
  const date = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : value
}

export default function DraftRulebookIdentifierEditor({
  rulebook,
  disabled,
  lastEditedAt,
  onChange,
}: {
  rulebook: DraftRulebook
  disabled: boolean
  lastEditedAt: string | null
  onChange: (mutate: (draft: DraftRulebook) => void) => void
}): React.JSX.Element {
  return (
    <fieldset className="constraint-group rulebook-editor-section rulebook-identifier-editor">
      <legend>Identifier</legend>
      <label className="field">
        <span>Name</span>
        <input disabled={disabled} value={rulebook.identifier.name} onChange={(event) => onChange((draft) => { draft.identifier.name = event.target.value })} />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea disabled={disabled} rows={3} value={rulebook.identifier.description} onChange={(event) => onChange((draft) => { draft.identifier.description = event.target.value })} />
      </label>
      <div className="rulebook-identifier-meta-row">
        <label className="field rulebook-identifier-id">
          <span>Rulebook identifier</span>
          <input readOnly value={rulebook.identifier.id} />
        </label>
        <div className="rulebook-edited-date">
          <span>Edited</span>
          <strong>{displayDate(lastEditedAt ?? rulebook.identifier.createdAt)}</strong>
        </div>
      </div>
      <small className="filter-note">Built-ins are read-only but can be duplicated.</small>
    </fieldset>
  )
}
