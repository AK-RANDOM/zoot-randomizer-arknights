import { useEffect, useState } from 'react'
import { subclassIconFile } from '../../shared/operatorAssets'
import { bundledIconUrl } from './bundledIcons'

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
  const bundledUrl =
    kind === 'subclass'
      ? bundledIconUrl('subclass-icons', subclassIconFile(id))
      : bundledIconUrl('faction-icons', `logo_${id}.png`)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const url = bundledUrl ?? fallbackUrl

  useEffect(() => {
    let active = true
    if (bundledUrl) return
    setFallbackUrl(null)
    const request =
      kind === 'subclass' ? window.desktop.getSubclassIcon(id) : window.desktop.getFactionIcon(id)
    void request.then((next) => {
      if (active) setFallbackUrl(next)
    })
    return () => {
      active = false
    }
  }, [bundledUrl, id, kind])

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
