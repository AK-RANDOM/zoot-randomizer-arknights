import { useState } from 'react'

/** Owned by App so navigating away does not reset Curate's presentation. */
export default function useCuratePresentation() {
  const [groupBy, setGroupBy] = useState('none')
  const [groupDirection, setGroupDirection] = useState('asc')
  const [operatorSort, setOperatorSort] = useState('default')
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set<string>())
  const [reversedGroups, setReversedGroups] = useState(() => new Set<string>())
  return {
    groupBy,
    setGroupBy,
    groupDirection,
    setGroupDirection,
    operatorSort,
    setOperatorSort,
    collapsedGroups,
    setCollapsedGroups,
    reversedGroups,
    setReversedGroups,
  }
}

export type CuratePresentation = ReturnType<typeof useCuratePresentation>
