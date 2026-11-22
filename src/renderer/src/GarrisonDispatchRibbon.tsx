import type { GarrisonDispatchControls } from './garrisonDispatch'

export default function GarrisonDispatchRibbon({
  controls,
  operatorIds,
  ready,
  hint,
}: {
  controls: GarrisonDispatchControls
  operatorIds: readonly string[]
  ready: boolean
  hint: string
}): React.JSX.Element {
  return (
    <aside className="garrison-dispatch-ribbon" aria-label="Garrison squad confirmation">
      <div>
        <strong>Garrison · {controls.stageName}</strong>
        <p>
          {ready ? `${operatorIds.length} operators ready to assign.` : hint} Leaving this tab
          discards this attempt.
        </p>
      </div>
      <div className="garrison-dispatch-ribbon-actions">
        <button type="button" className="secondary-button" onClick={controls.onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="randomize-button"
          disabled={!ready}
          onClick={() => controls.onConfirm(operatorIds)}
        >
          Confirm Squad & Return
        </button>
      </div>
    </aside>
  )
}
