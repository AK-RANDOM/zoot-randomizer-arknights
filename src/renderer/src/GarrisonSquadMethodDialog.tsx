import type { GarrisonStage } from '../../shared/garrison'

export default function GarrisonSquadMethodDialog({
  stage,
  onNameChange,
  onSelect,
  onCancel,
  includeManual,
}: {
  stage: GarrisonStage
  onNameChange: (name: string) => void
  onSelect: (method: 'manual' | 'standard' | 'draft') => void
  onCancel: () => void
  includeManual: boolean
}): React.JSX.Element {
  return (
    <div className="confirmation-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="garrison-squad-method-title"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel()
        }}
      >
        <h3 id="garrison-squad-method-title">
          {includeManual ? 'Create Garrison squad' : 'Generate Garrison squad'}
        </h3>
        <label className="garrison-squad-method-name">
          Stage name
          <input
            autoFocus
            value={stage.name}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </label>
        <div className="garrison-squad-methods">
          {includeManual && (
            <button type="button" className="secondary-button" onClick={() => onSelect('manual')}>
              <strong>Manual Selection</strong>
              <span>Choose operators in the stage editor.</span>
            </button>
          )}
          <button type="button" className="secondary-button" onClick={() => onSelect('standard')}>
            <strong>Standard Dispatch</strong>
            <span>Generate a squad in the Standard tab.</span>
          </button>
          <button type="button" className="secondary-button" onClick={() => onSelect('draft')}>
            <strong>Draft</strong>
            <span>Build a squad in the Draft tab.</span>
          </button>
        </div>
        <div className="confirmation-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  )
}
