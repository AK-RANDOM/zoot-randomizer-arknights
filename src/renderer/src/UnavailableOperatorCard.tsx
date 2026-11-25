import { DraftEmptySlotFrame } from './DraftSquadGrid'

export default function UnavailableOperatorCard({ slot }: { slot: number }): React.JSX.Element {
  return (
    <div
      className="disabled-slot disabled-slot--shared-frame"
      aria-label={`Squad slot ${slot} unavailable`}
    >
      <DraftEmptySlotFrame slotNumber={slot} variant="expandable" label="Unavailable" />
    </div>
  )
}
