export default function PoolSortControls({
  operatorSort,
  groupBy,
  onSortChange,
  onGroupChange,
}: {
  operatorSort: string
  groupBy: string
  onSortChange: (value: string) => void
  onGroupChange: (value: string) => void
}) {
  return (
    <>
      <label className="field">
        <span>Operator sort</span>
        <select value={operatorSort} onChange={(event) => onSortChange(event.target.value)}>
          <option value="default">Default</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="releaseDate">Release Date</option>
        </select>
      </label>
      <label className="field">
        <span>Group by</span>
        <select value={groupBy} onChange={(event) => onGroupChange(event.target.value)}>
          <option value="none">None</option>
          <option value="class">Class</option>
          <option value="rarity">Rarity</option>
          <option value="releaseYear">Release</option>
          <option value="mainFaction">Main Faction</option>
          <option value="acquisition">Acquisition</option>
          <option value="accountState">Account State</option>
        </select>
      </label>
    </>
  )
}
