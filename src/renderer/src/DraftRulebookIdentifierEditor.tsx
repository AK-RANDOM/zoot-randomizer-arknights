import type { DraftRulebook } from '../../shared/draftRulebook'

export default function DraftRulebookIdentifierEditor({
  rulebook,
  disabled,
  onChange,
}: {
  rulebook: DraftRulebook
  disabled: boolean
  onChange: (mutate: (draft: DraftRulebook) => void) => void
}): React.JSX.Element {
  return (
    <fieldset className="constraint-group rulebook-editor-section">
      <legend>Identifier</legend>
      <label className="field">
        <span>Name</span>
        <input disabled={disabled} value={rulebook.identifier.name} onChange={(event) => onChange((draft) => { draft.identifier.name = event.target.value })} />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea disabled={disabled} rows={3} value={rulebook.identifier.description} onChange={(event) => onChange((draft) => { draft.identifier.description = event.target.value })} />
      </label>
      <div className="rulebook-inline-fields">
        <label className="field">
          <span>Revision</span>
          <input disabled={disabled} value={rulebook.identifier.revision} onChange={(event) => onChange((draft) => { draft.identifier.revision = event.target.value })} />
        </label>
        <label className="field">
          <span>Created</span>
          <input readOnly value={rulebook.identifier.createdAt} />
        </label>
      </div>
      <small className="filter-note">Schema version and author-facing revision are separate. Built-ins are read-only but can be duplicated.</small>
    </fieldset>
  )
}
