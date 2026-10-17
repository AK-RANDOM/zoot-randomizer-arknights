import { useEffect, useState } from 'react'
import {
  importedAccountOperatorState,
  importedAccountOwnsSkin,
} from '../../shared/arknightsAccountReconciliation'
import { skinDisplayName } from '../../shared/skinMetadata'
import { appearanceChoiceForOperator, resolveAccountAppearance } from './operatorAppearance'

function AppearanceAvatar({ avatarId, fallbackLabel }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setImageUrl(null)
    if (!avatarId) return () => undefined
    void window.desktop.getOperatorAvatarAsset(avatarId).then((next) => {
      if (active) setImageUrl(next)
    })
    return () => {
      active = false
    }
  }, [avatarId])
  return imageUrl ? (
    <img className="pool-appearance-avatar" src={imageUrl} alt="" draggable={false} />
  ) : (
    <span className="pool-appearance-avatar pool-appearance-avatar--fallback" aria-hidden="true">
      {fallbackLabel}
    </span>
  )
}
function OutfitChoiceAvatar({ operatorId, skinId, fallbackLabel }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setImageUrl(null)
    void window.desktop.getOperatorSkinAvatar(operatorId, skinId).then((next) => {
      if (active) setImageUrl(next)
    })
    return () => {
      active = false
    }
  }, [operatorId, skinId])
  return imageUrl ? (
    <img className="pool-appearance-avatar" src={imageUrl} alt="" draggable={false} />
  ) : (
    <span className="pool-appearance-avatar pool-appearance-avatar--fallback" aria-hidden="true">
      {fallbackLabel}
    </span>
  )
}
function PromotionChoiceAvatar({ operatorId, promotionArt }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setImageUrl(null)
    void window.desktop.getOperatorPromotionAvatar(operatorId, promotionArt).then((next) => {
      if (active) setImageUrl(next)
    })
    return () => {
      active = false
    }
  }, [operatorId, promotionArt])
  return imageUrl ? (
    <img className="pool-appearance-avatar" src={imageUrl} alt="" draggable={false} />
  ) : (
    <span className="pool-appearance-avatar pool-appearance-avatar--fallback" aria-hidden="true">
      {promotionArt.toUpperCase()}
    </span>
  )
}
function compareSkinsByRelease(left, right) {
  if (left.releaseTime !== undefined && right.releaseTime !== undefined) {
    if (left.releaseTime !== right.releaseTime) return left.releaseTime - right.releaseTime
  } else if (left.releaseTime !== undefined) return -1
  else if (right.releaseTime !== undefined) return 1
  return left.id.localeCompare(right.id)
}
function defaultArtChoice(defaultArt, index, count) {
  if (count <= 1 || index === 0) return 'e1'
  if (index === count - 1) return 'e2'
  return `skin:${defaultArt.id}`
}
function accountChoiceDescription(operator, accountResolution, preferences) {
  if (!accountResolution.equippedSkinId) return 'No equipped skin ID · uses E2 fallback'
  if (!accountResolution.recognized) {
    return `Unknown locally: ${accountResolution.equippedSkinId} · uses E2 fallback`
  }
  if (accountResolution.choice === 'e1' || accountResolution.choice === 'e2') {
    return `${accountResolution.choice.toUpperCase()} from imported account`
  }
  if (accountResolution.choice?.startsWith('skin:')) {
    const skinId = accountResolution.choice.slice(5)
    const skin = operator.skins?.find((candidate) => candidate.id === skinId)
    if (skin) return `${skinDisplayName(skin, preferences.gameLocale)} · imported equipped skin`
  }
  return 'Uses E2 fallback'
}
function AppearancePicker({ operator, preferences, importedAccount, onChoose, onClose }) {
  const selected = appearanceChoiceForOperator(preferences, operator.id)
  const defaultArts = operator.defaultArts ?? []
  const outfits = (operator.skins ?? [])
    .filter((skin) => !skin.isDefault)
    .sort(compareSkinsByRelease)
  const accountState = importedAccount
    ? importedAccountOperatorState(importedAccount, operator.id)
    : null
  const accountResolution = resolveAccountAppearance(operator, importedAccount)
  const accountChoice = accountState
    ? {
        choice: 'account',
        label: 'Account equipped',
        description: accountChoiceDescription(operator, accountResolution, preferences),
      }
    : null
  return (
    <div className="pool-appearance-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="pool-appearance-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pool-appearance-heading"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="pool-appearance-dialog__heading">
          <div>
            <p className="eyebrow">OPERATOR APPEARANCE</p>
            <h3 id="pool-appearance-heading">{operator.name}</h3>
          </div>
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
        {importedAccount && (
          <p className="pool-appearance-account-note">
            Account data is advisory. Your explicit artwork choice wins unless you select
            <strong> Account equipped</strong>. Skin ownership comes only from the imported
            owned-skin collection and is not inferred from the equipped skin.
          </p>
        )}
        {accountChoice && (
          <section className="pool-appearance-section" aria-labelledby="pool-account-art-heading">
            <h4 id="pool-account-art-heading">Imported account</h4>
            <button
              type="button"
              className={`pool-appearance-account${selected === accountChoice.choice ? ' is-selected' : ''}`}
              onClick={() => onChoose(accountChoice.choice)}
            >
              <strong>{accountChoice.label}</strong>
              <span>{accountChoice.description}</span>
            </button>
          </section>
        )}
        <section className="pool-appearance-section" aria-labelledby="pool-default-art-heading">
          <h4 id="pool-default-art-heading">Default Art</h4>
          <div className="pool-appearance-grid pool-appearance-grid--default">
            {defaultArts.length > 0
              ? defaultArts.map((art, index) => {
                  const choice = defaultArtChoice(art, index, defaultArts.length)
                  return (
                    <button
                      key={art.id}
                      type="button"
                      className={`pool-appearance-tile${selected === choice ? ' is-selected' : ''}`}
                      onClick={() => onChoose(choice)}
                    >
                      <AppearanceAvatar avatarId={art.avatarId} fallbackLabel={art.label} />
                      <span className="pool-appearance-tile__copy">
                        <strong>{art.label}</strong>
                      </span>
                    </button>
                  )
                })
              : ['e1', 'e2'].map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className={`pool-appearance-tile${selected === choice ? ' is-selected' : ''}`}
                    onClick={() => onChoose(choice)}
                  >
                    <PromotionChoiceAvatar operatorId={operator.id} promotionArt={choice} />
                    <span className="pool-appearance-tile__copy">
                      <strong>{choice.toUpperCase()}</strong>
                    </span>
                  </button>
                ))}
          </div>
        </section>
        <section className="pool-appearance-section" aria-labelledby="pool-outfits-heading">
          <h4 id="pool-outfits-heading">Outfits</h4>
          {outfits.length > 0 ? (
            <div className="pool-appearance-grid pool-appearance-grid--skins">
              {outfits.map((skin) => {
                const choice = `skin:${skin.id}`
                return (
                  <button
                    key={skin.id}
                    type="button"
                    className={`pool-appearance-tile${selected === choice ? ' is-selected' : ''}`}
                    onClick={() => onChoose(choice)}
                  >
                    <OutfitChoiceAvatar
                      operatorId={operator.id}
                      skinId={skin.id}
                      fallbackLabel="?"
                    />
                    <span className="pool-appearance-tile__copy">
                      <strong>{skinDisplayName(skin, preferences.gameLocale)}</strong>
                      {importedAccount && (
                        <small
                          className={
                            importedAccountOwnsSkin(importedAccount, skin.id)
                              ? 'pool-appearance-account-state'
                              : 'pool-appearance-account-state is-unowned'
                          }
                        >
                          {importedAccountOwnsSkin(importedAccount, skin.id)
                            ? 'Owned on imported account'
                            : 'Not owned on imported account'}
                        </small>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="pool-appearance-empty">No alternate outfits available.</p>
          )}
        </section>
        <button
          type="button"
          className={`pool-appearance-random${selected === 'random' ? ' is-selected' : ''}`}
          onClick={() => onChoose('random')}
        >
          Random image
        </button>
      </div>
    </div>
  )
}

export { compareSkinsByRelease, defaultArtChoice }
export default AppearancePicker
