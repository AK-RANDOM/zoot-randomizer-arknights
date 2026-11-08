import type { ReleaseDateOption } from '../../shared/releasePreview'
import type { ReleaseServer } from '../../shared/operator'
import { releaseGroupLabel } from '../../shared/releaseBounds'
import { releaseYearGroup } from '../../shared/releaseMetadata'
import EventSelectorDropdown from './EventSelectorDropdown'

export default function ReleaseDateDropdown({
  label,
  options,
  value,
  side,
  server,
  onChange,
}: {
  label: string
  options: ReleaseDateOption[]
  value: string
  side: 'min' | 'max'
  server: ReleaseServer
  onChange: (date: string) => boolean
}): React.JSX.Element {
  const selected =
    options.find(
      (option) => option.date === value || (option.startDate <= value && value <= option.endDate),
    ) ??
    (value
      ? side === 'min'
        ? options.find((option) => option.date >= value)
        : [...options].reverse().find((option) => option.date <= value)
      : undefined) ??
    (side === 'min' ? options[0] : options[options.length - 1])
  const groupedOptions = options.map((option) => {
    const year = releaseYearGroup(option.startDate, server)
    return {
      ...option,
      id: option.date,
      group: year === null ? 'Unknown release year' : releaseGroupLabel(year),
    }
  })
  return (
    <EventSelectorDropdown
      label={label}
      options={groupedOptions}
      groups={[...new Set(groupedOptions.map(({ group }) => group))]}
      value={selected?.date ?? ''}
      onChange={onChange}
      disabled={!options.length}
      placeholder="No operator releases in this group"
    />
  )
}
