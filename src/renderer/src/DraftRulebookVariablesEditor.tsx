export default function DraftRulebookVariablesEditor(): React.JSX.Element {
  return (
    <fieldset className="constraint-group rulebook-editor-section">
      <legend>Variables</legend>
      <p className="filter-note">
        Reserved for Rulebook constants, state variables, derived values, and custom entity types.
        The current Draft backend does not expose these as authored data yet, so this section is
        read-only until the portable Rulebook runtime is finalized.
      </p>
    </fieldset>
  )
}
