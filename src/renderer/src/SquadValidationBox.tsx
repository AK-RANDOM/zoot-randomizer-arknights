export default function SquadValidationBox({ errors }: { errors: string[] }): React.JSX.Element {
  return (
    <div className="validation-box" role="alert">
      <strong>Current configuration cannot generate a squad.</strong>
      <ul>
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  )
}
