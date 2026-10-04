import { useEffect, useState } from 'react'

type AssetKind = 'subclass' | 'faction'

function FilterAssetIcon({
  kind,
  id,
  className = '',
}: {
  kind: AssetKind
  id: string
  className?: string
}): React.JSX.Element {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setUrl(null)
    const request =
      kind === 'subclass'
        ? window.desktop.getSubclassIcon(id)
        : window.desktop.getFactionIcon(id)
    void request.then((next) => {
      if (active) setUrl(next)
    })
    return () => {
      active = false
    }
  }, [id, kind])

  return url ? (
    <img className={className} src={url} alt="" aria-hidden="true" draggable={false} />
  ) : (
    <span className={`${className} filter-asset-icon--placeholder`} aria-hidden="true" />
  )
}

export function SubclassIcon(props: { id: string; className?: string }): React.JSX.Element {
  return <FilterAssetIcon kind="subclass" {...props} />
}

export function FactionIcon(props: { id: string; className?: string }): React.JSX.Element {
  return <FilterAssetIcon kind="faction" {...props} />
}
