import { useMemo } from 'react'
import type { ImportedArknightsAccount } from '../../shared/arknightsAccount'
import { importedAccountOwnedOperatorIds } from '../../shared/arknightsAccountReconciliation'
import type { OperatorDataset } from '../../shared/operator'
import type { OperatorPreferences } from '../../shared/operatorPool'

export default function AccountOwnershipConstraint({
  dataset,
  importedAccount,
  preferences,
  onChange,
}: {
  dataset: OperatorDataset | null
  importedAccount: ImportedArknightsAccount | null
  preferences: OperatorPreferences
  onChange: (next: OperatorPreferences) => void
}): React.JSX.Element {
  const recognizedOwnedCount = useMemo(() => {
    if (!dataset || !importedAccount) return 0
    const localIds = new Set(dataset.operators.map((operator) => operator.id))
    return importedAccountOwnedOperatorIds(importedAccount).filter((id) => localIds.has(id)).length
  }, [dataset, importedAccount])

  return (
    <fieldset className="constraint-group detail-group account-ownership-constraint">
      <legend>Account ownership</legend>
      <label className="source-check">
        <input
          type="checkbox"
          checked={preferences.ownedOperatorsOnly}
          disabled={!importedAccount}
          onChange={(event) =>
            onChange({ ...preferences, ownedOperatorsOnly: event.target.checked })
          }
        />
        <span>Owned operators only</span>
      </label>
      {importedAccount ? (
        <p className="filter-note">
          Limits Standard and Draft consumers to operators owned on the imported account. Unowned
          operators stay visible in Curate but are marked unavailable. {recognizedOwnedCount}{' '}
          imported operator identities are recognized by the installed data. Unknown/newer account
          IDs remain diagnostic only.
        </p>
      ) : (
        <p className="filter-note">
          Import an Arknights account from Options → Account to enable this constraint. Without a
          saved account snapshot, the pool remains unchanged.
        </p>
      )}
    </fieldset>
  )
}
