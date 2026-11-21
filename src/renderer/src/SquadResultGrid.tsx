import OperatorCard from './OperatorCard'
import { squadShareImageSlots, type SquadShareResult } from './squadShare'
import './SquadResultGrid.css'

export default function SquadResultGrid({
  result,
  forImage = false,
}: {
  result: SquadShareResult
  forImage?: boolean
}): React.JSX.Element {
  return (
    <div
      className={`squad-grid squad-result-grid${forImage ? ' squad-share-grid' : ''}`}
      aria-label="Finalized squad slots"
    >
      {squadShareImageSlots(result).map(({ operator, isOverflow }, index) => (
        <div
          key={index}
          className={`squad-slot${isOverflow ? ' squad-result-slot--overflow' : ''}`}
          aria-label={`Squad slot ${index + 1}: ${operator?.name ?? 'empty'}${isOverflow ? ' (Overflow)' : ''}`}
        >
          {operator ? (
            <>
              <OperatorCard
                operator={operator}
                replayOnRandomize={false}
                showPersonalProgression={!forImage}
                scrollName={!forImage}
              />
              {isOverflow && <span className="squad-result-overflow">Overflow</span>}
            </>
          ) : (
            <div className="squad-result-empty" />
          )}
        </div>
      ))}
    </div>
  )
}
