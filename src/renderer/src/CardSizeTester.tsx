import { useEffect, useState } from 'react'
import './CardSizeTester.css'

export default function CardSizeTester(): React.JSX.Element {
  const [percentage, setPercentage] = useState('140')

  useEffect(() => {
    const value = Number(percentage)
    if (Number.isFinite(value) && value >= 25 && value <= 500) {
      document.documentElement.style.setProperty('--square-card-faction-scale', String(value / 100))
    }
  }, [percentage])

  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty('--square-card-faction-scale')
    }
  }, [])

  return (
    <aside className="card-size-tester" aria-label="Card size tester">
      <strong>Card size tester</strong>
      <label className="field">
        <span>Faction icon size (%)</span>
        <input
          type="number"
          min={25}
          max={500}
          step={1}
          value={percentage}
          onChange={(event) => setPercentage(event.target.value)}
          aria-describedby="card-size-tester-help"
        />
      </label>
      <button type="button" onClick={() => setPercentage('140')}>
        Reset to 140%
      </button>
      <small id="card-size-tester-help">
        Updates Draft and Garrison square cards live. Range: 25–500%.
      </small>
    </aside>
  )
}
