import {
  ARKNIGHTS_BUCKET_RATES,
  arknightsBucketForRarity,
  type DraftProbabilityBucket,
  type DraftPullDistribution,
  type DraftRateUpRule,
} from '../../shared/draftDistribution'
import { operatorRarities, type OperatorDataset, type OperatorRarity } from '../../shared/operator'
import { OperatorMultiSelector, type OperatorSelectorOption } from './OperatorSelector'

function clampShare(percent: number): number {
  if (!Number.isFinite(percent)) return 0
  return Math.max(0, Math.min(100, percent)) / 100
}

function rateUpOrDefault(rateUp: DraftRateUpRule | undefined): DraftRateUpRule {
  return rateUp ?? { share: 0, featuredOperatorIds: [] }
}

function operatorOptions(
  dataset: OperatorDataset,
  predicate: (rarity: OperatorRarity) => boolean,
): OperatorSelectorOption[] {
  return dataset.operators
    .filter((operator) => predicate(operator.rarity))
    .map((operator) => ({
      key: operator.id,
      label: operator.name,
      operator,
      aliases: [operator.subclass.name],
    }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

function RateUpEditor({
  label,
  rateUp,
  operators,
  disabled,
  onChange,
}: {
  label: string
  rateUp: DraftRateUpRule | undefined
  operators: OperatorSelectorOption[]
  disabled: boolean
  onChange: (rateUp: DraftRateUpRule | undefined) => void
}): React.JSX.Element {
  const current = rateUpOrDefault(rateUp)
  const enabled = rateUp !== undefined

  return (
    <div className="rulebook-rateup-editor">
      <label className="rulebook-toggle">
        <input
          type="checkbox"
          disabled={disabled}
          checked={enabled}
          onChange={(event) => onChange(event.target.checked ? current : undefined)}
        />
        <span>{label} rate-up</span>
      </label>
      {enabled && (
        <div className="rulebook-inline-fields">
          <label className="field">
            <span>Featured share (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              disabled={disabled}
              value={Math.round(current.share * 10000) / 100}
              onChange={(event) =>
                onChange({
                  ...current,
                  share: clampShare(Number(event.target.value)),
                })
              }
            />
          </label>
          <div className="field rulebook-rateup-featured">
            <span>Featured operators</span>
            <OperatorMultiSelector
              options={operators}
              valueKeys={current.featuredOperatorIds}
              disabled={disabled}
              onChange={(featuredOperatorIds) =>
                onChange({
                  ...current,
                  featuredOperatorIds,
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}

function normalizedPercent(
  bucket: DraftProbabilityBucket,
  buckets: readonly DraftProbabilityBucket[],
): string {
  const total = buckets.reduce((sum, current) => sum + Math.max(0, current.weight), 0)
  if (total <= 0) return '0%'
  return `${((Math.max(0, bucket.weight) / total) * 100).toFixed(1)}%`
}

export default function DraftRulebookDistributionEditor({
  dataset,
  distribution,
  disabled = false,
  onChange,
}: {
  dataset: OperatorDataset
  distribution: DraftPullDistribution
  disabled?: boolean
  onChange: (distribution: DraftPullDistribution) => void
}): React.JSX.Element {
  const setType = (type: DraftPullDistribution['type']): void => {
    if (type === 'equal') {
      onChange({ type: 'equal' })
      return
    }
    if (type === 'arknights') {
      onChange({ type: 'arknights' })
      return
    }
    onChange({
      type: 'custom',
      buckets: [
        { id: 'bucket-3', weight: 40, rarities: [3] },
        { id: 'bucket-4', weight: 50, rarities: [2, 4] },
        { id: 'bucket-5', weight: 8, rarities: [1, 5] },
        { id: 'bucket-6', weight: 2, rarities: [6] },
      ],
    })
  }

  const updateArknightsRateUp = (bucketId: string, rateUp: DraftRateUpRule | undefined): void => {
    if (distribution.type !== 'arknights') return
    const next = { ...(distribution.rateUps ?? {}) }
    if (rateUp) next[bucketId] = rateUp
    else delete next[bucketId]
    onChange({ type: 'arknights', rateUps: Object.keys(next).length > 0 ? next : undefined })
  }

  const updateBucket = (
    bucketId: string,
    update: (bucket: DraftProbabilityBucket) => DraftProbabilityBucket,
  ): void => {
    if (distribution.type !== 'custom') return
    onChange({
      type: 'custom',
      buckets: distribution.buckets.map((bucket) =>
        bucket.id === bucketId ? update(bucket) : bucket,
      ),
    })
  }

  const setBucketRarity = (bucketId: string, rarity: OperatorRarity, checked: boolean): void => {
    if (distribution.type !== 'custom') return
    onChange({
      type: 'custom',
      buckets: distribution.buckets.map((bucket) => {
        const withoutRarity = bucket.rarities.filter((current) => current !== rarity)
        if (bucket.id !== bucketId || !checked) return { ...bucket, rarities: withoutRarity }
        return {
          ...bucket,
          rarities: [...withoutRarity, rarity].sort((left, right) => left - right),
        }
      }),
    })
  }

  const addBucket = (): void => {
    if (distribution.type !== 'custom') return
    const id = `bucket-${Date.now().toString(36)}`
    onChange({
      type: 'custom',
      buckets: [...distribution.buckets, { id, weight: 1, rarities: [] }],
    })
  }

  const removeBucket = (bucketId: string): void => {
    if (distribution.type !== 'custom') return
    onChange({
      type: 'custom',
      buckets: distribution.buckets.filter((bucket) => bucket.id !== bucketId),
    })
  }

  return (
    <div className="rulebook-distribution-editor">
      <label className="field">
        <span>Mode</span>
        <select
          disabled={disabled}
          value={distribution.type}
          onChange={(event) => setType(event.target.value as DraftPullDistribution['type'])}
        >
          <option value="equal">Equal Opportunity</option>
          <option value="arknights">Arknights Headhunting</option>
          <option value="custom">Custom Distribution</option>
        </select>
      </label>

      {distribution.type === 'equal' && (
        <p className="filter-note">
          Every currently eligible operator has equal probability for each candidate slot.
        </p>
      )}

      {distribution.type === 'arknights' && (
        <div className="rulebook-distribution-details">
          <p className="filter-note">
            Fixed 40 / 50 / 8 / 2 buckets with Arknights-style 6★ pity. Each generated candidate
            advances pity, including rerolls.
          </p>
          {Object.entries(ARKNIGHTS_BUCKET_RATES).map(([bucketId, rate]) => {
            const options = operatorOptions(
              dataset,
              (rarity) => arknightsBucketForRarity(rarity) === bucketId,
            )
            return (
              <div className="rulebook-bucket-editor" key={bucketId}>
                <div className="rulebook-editor-subheading">
                  <strong>{bucketId}★ bucket</strong>
                  <span>{rate}%</span>
                </div>
                <RateUpEditor
                  label={`${bucketId}★ bucket`}
                  rateUp={distribution.rateUps?.[bucketId]}
                  operators={options}
                  disabled={disabled}
                  onChange={(rateUp) => updateArknightsRateUp(bucketId, rateUp)}
                />
              </div>
            )
          })}
        </div>
      )}

      {distribution.type === 'custom' && (
        <div className="rulebook-distribution-details">
          <div className="rulebook-editor-subheading">
            <div>
              <strong>Probability buckets</strong>
              <small>
                Weights normalize automatically. Each rarity must belong to exactly one bucket.
              </small>
            </div>
            <button
              type="button"
              className="secondary-button"
              disabled={disabled}
              onClick={addBucket}
            >
              Add bucket
            </button>
          </div>
          {distribution.buckets.map((bucket) => {
            const options = operatorOptions(dataset, (rarity) => bucket.rarities.includes(rarity))
            return (
              <div className="rulebook-bucket-editor" key={bucket.id}>
                <div className="rulebook-inline-fields rulebook-inline-fields--three">
                  <label className="field">
                    <span>Bucket ID</span>
                    <input
                      disabled={disabled}
                      value={bucket.id}
                      onChange={(event) =>
                        updateBucket(bucket.id, (current) => ({
                          ...current,
                          id: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Weight</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      disabled={disabled}
                      value={bucket.weight}
                      onChange={(event) =>
                        updateBucket(bucket.id, (current) => ({
                          ...current,
                          weight: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <div className="rulebook-readout">
                    <span>Normalized</span>
                    <strong>{normalizedPercent(bucket, distribution.buckets)}</strong>
                  </div>
                </div>
                <div className="rulebook-rarity-membership">
                  {operatorRarities.map((rarity) => (
                    <label className="rulebook-toggle" key={rarity}>
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={bucket.rarities.includes(rarity)}
                        onChange={(event) =>
                          setBucketRarity(bucket.id, rarity, event.target.checked)
                        }
                      />
                      <span>{rarity}★</span>
                    </label>
                  ))}
                </div>
                <RateUpEditor
                  label={bucket.id || 'Bucket'}
                  rateUp={bucket.rateUp}
                  operators={options}
                  disabled={disabled}
                  onChange={(rateUp) =>
                    updateBucket(bucket.id, (current) => ({ ...current, rateUp }))
                  }
                />
                <button
                  type="button"
                  className="secondary-button"
                  disabled={disabled || distribution.buckets.length <= 1}
                  onClick={() => removeBucket(bucket.id)}
                >
                  Remove bucket
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
