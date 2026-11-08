import {
  ARKNIGHTS_BUCKET_RATES,
  arknightsBucketForRarity,
  type DraftPullDistribution,
} from '../../shared/draftDistribution'
import { operatorRarities } from '../../shared/operator'

const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })

export default function DraftProbabilitySummary({
  distribution,
}: {
  distribution?: DraftPullDistribution
}): React.JSX.Element {
  const buckets =
    distribution?.type === 'arknights'
      ? Object.entries(ARKNIGHTS_BUCKET_RATES).map(([id, weight]) => ({
          id,
          weight,
          rarities: operatorRarities.filter((rarity) => arknightsBucketForRarity(rarity) === id),
        }))
      : (distribution?.type === 'custom' ? distribution.buckets : []).filter(
          (bucket) => bucket.rarities.length > 0,
        )
  const totalWeight = buckets.reduce((total, bucket) => total + bucket.weight, 0)

  return (
    <section className="draft-probability-summary" aria-labelledby="draft-probability-heading">
      <h2 id="draft-probability-heading">Pull probability</h2>
      {totalWeight > 0 ? (
        <>
          <dl aria-label="Base rates per candidate">
            {buckets.map(({ id, rarities, weight }) => (
              <div key={id}>
                <dt>{rarities.map((rarity) => `${rarity}★`).join(' / ')}</dt>
                <dd>{percent.format(weight / totalWeight)}</dd>
              </div>
            ))}
          </dl>
          <p>
            Base rates per candidate. Odds adjust when a rarity group has no eligible operators.
          </p>
          {distribution?.type === 'arknights' && (
            <p>
              The 6★ rate rises after 50 candidates without a 6★.
              {distribution.firstTenActualFiveStarGuarantee &&
                ' A 5★ is guaranteed in the first 10 candidates if one is eligible.'}
            </p>
          )}
        </>
      ) : (
        <p>Every eligible operator has the same chance to appear in each candidate slot.</p>
      )}
    </section>
  )
}
