import { useMemo } from 'react'
import type { OperatorDataset } from '../../shared/operator'
import {
  createDefaultDraftRulebookSelector,
  type DraftRulebook,
  type DraftRulebookInteraction,
  type DraftRulebookSelector,
} from '../../shared/draftRulebook'
import { getDraftRulebookOperatorCostBreakdown } from '../../shared/draftRulebookCost'
import OperatorCard from './OperatorCard'
import { DraftRulebookSelectorEditor } from './DraftRulebookSelectorEditor'
import {
  buildRulebookOperatorInteractionDetails,
  describeDraftRulebookInteraction,
  draftRulebookInteractionAffectsOperator,
} from './draftInteractionPresentation'

interface DraftRulebookInteractionEditorProps {
  rulebook: DraftRulebook
  dataset: OperatorDataset
  disabled?: boolean
  onChange: (interactions: DraftRulebookInteraction[]) => void
}

function nextInteractionId(
  type: DraftRulebookInteraction['type'],
  interactions: readonly DraftRulebookInteraction[],
): string {
  const ids = new Set(interactions.map((interaction) => interaction.id))
  let index = 1
  while (ids.has(`${type}-${index}`)) index += 1
  return `${type}-${index}`
}

function createInteraction(
  type: DraftRulebookInteraction['type'],
  interactions: readonly DraftRulebookInteraction[],
  dataset: OperatorDataset,
): DraftRulebookInteraction {
  const selector = (): DraftRulebookSelector => createDefaultDraftRulebookSelector('operators', dataset)
  const id = nextInteractionId(type, interactions)
  switch (type) {
    case 'anchor':
      return { id, type, source: selector(), target: selector(), modifier: 1 }
    case 'progressive':
      return { id, type, group: selector(), steps: [{ memberCount: 2, modifier: 1 }] }
    case 'threshold':
      return { id, type, group: selector(), threshold: 2, modifier: 1 }
  }
}

function ResolvedInteractionPreview({
  rulebook,
  interaction,
  dataset,
}: {
  rulebook: DraftRulebook
  interaction: DraftRulebookInteraction
  dataset: OperatorDataset
}): React.JSX.Element {
  const affected = useMemo(
    () => dataset.operators
      .filter((operator) => draftRulebookInteractionAffectsOperator(interaction, operator))
      .sort((left, right) => left.name.localeCompare(right.name)),
    [dataset.operators, interaction],
  )

  return (
    <div className="rulebook-interaction-preview">
      <div className="rulebook-editor-subheading">
        <div>
          <strong>Resolved preview</strong>
          <small>{describeDraftRulebookInteraction(interaction, dataset)}</small>
        </div>
        <span>{affected.length} operator{affected.length === 1 ? '' : 's'}</span>
      </div>
      {affected.length === 0 ? (
        <p className="filter-note">No operators in the installed dataset currently match this interaction.</p>
      ) : (
        <div className="rulebook-interaction-preview-grid">
          {affected.slice(0, 6).map((operator) => (
            <OperatorCard
              key={operator.id}
              operator={operator}
              interactionDetails={buildRulebookOperatorInteractionDetails(
                rulebook,
                operator,
                dataset,
              )}
            />
          ))}
          {affected.length > 6 && (
            <div className="rulebook-interaction-preview-more">
              +{affected.length - 6} more
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InteractionSelectorField({
  label,
  selector,
  dataset,
  disabled,
  onChange,
}: {
  label: string
  selector: DraftRulebookSelector
  dataset: OperatorDataset
  disabled: boolean
  onChange: (selector: DraftRulebookSelector) => void
}): React.JSX.Element {
  return (
    <div className="rulebook-interaction-selector-field">
      <strong>{label}</strong>
      <DraftRulebookSelectorEditor
        dataset={dataset}
        selector={selector}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  )
}

function InteractionEditor({
  rulebook,
  interaction,
  dataset,
  disabled,
  onChange,
  onRemove,
}: {
  rulebook: DraftRulebook
  interaction: DraftRulebookInteraction
  dataset: OperatorDataset
  disabled: boolean
  onChange: (interaction: DraftRulebookInteraction) => void
  onRemove: () => void
}): React.JSX.Element {
  return (
    <article className="rulebook-interaction-card">
      <div className="rulebook-editor-subheading">
        <div>
          <strong>{interaction.id}</strong>
          <small>{interaction.type}</small>
        </div>
        <button type="button" className="secondary-button" disabled={disabled} onClick={onRemove}>Remove</button>
      </div>

      {interaction.type === 'anchor' && (
        <div className="rulebook-interaction-fields">
          <InteractionSelectorField label="Source / anchor" selector={interaction.source} dataset={dataset} disabled={disabled} onChange={(source) => onChange({ ...interaction, source })} />
          <InteractionSelectorField label="Target" selector={interaction.target} dataset={dataset} disabled={disabled} onChange={(target) => onChange({ ...interaction, target })} />
          <label className="field"><span>Cost reduction</span><input type="number" min={0} disabled={disabled} value={interaction.modifier} onChange={(event) => onChange({ ...interaction, modifier: Number(event.target.value) })} /></label>
        </div>
      )}

      {interaction.type === 'progressive' && (
        <div className="rulebook-interaction-fields">
          <InteractionSelectorField label="Group" selector={interaction.group} dataset={dataset} disabled={disabled} onChange={(group) => onChange({ ...interaction, group })} />
          <div className="rulebook-progressive-steps">
            <div className="rulebook-editor-subheading">
              <div><strong>Progressive steps</strong><small>Apply the best reached member-count threshold.</small></div>
              <button type="button" className="secondary-button" disabled={disabled} onClick={() => onChange({
                ...interaction,
                steps: [...interaction.steps, {
                  memberCount: (interaction.steps.at(-1)?.memberCount ?? 0) + 1,
                  modifier: 1,
                }],
              })}>Add step</button>
            </div>
            {interaction.steps.map((step, index) => (
              <div className="rulebook-progressive-step" key={index}>
                <label className="field"><span>Member count</span><input type="number" min={1} disabled={disabled} value={step.memberCount} onChange={(event) => onChange({ ...interaction, steps: interaction.steps.map((current, currentIndex) => currentIndex === index ? { ...current, memberCount: Number(event.target.value) } : current) })} /></label>
                <label className="field"><span>Reduction</span><input type="number" min={0} disabled={disabled} value={step.modifier} onChange={(event) => onChange({ ...interaction, steps: interaction.steps.map((current, currentIndex) => currentIndex === index ? { ...current, modifier: Number(event.target.value) } : current) })} /></label>
                <button type="button" className="secondary-button" disabled={disabled || interaction.steps.length <= 1} onClick={() => onChange({ ...interaction, steps: interaction.steps.filter((_, currentIndex) => currentIndex !== index) })}>Remove step</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {interaction.type === 'threshold' && (
        <div className="rulebook-interaction-fields">
          <InteractionSelectorField label="Group" selector={interaction.group} dataset={dataset} disabled={disabled} onChange={(group) => onChange({ ...interaction, group })} />
          <div className="rulebook-inline-fields">
            <label className="field"><span>Threshold</span><input type="number" min={1} disabled={disabled} value={interaction.threshold} onChange={(event) => onChange({ ...interaction, threshold: Number(event.target.value) })} /></label>
            <label className="field"><span>Cost reduction</span><input type="number" min={0} disabled={disabled} value={interaction.modifier} onChange={(event) => onChange({ ...interaction, modifier: Number(event.target.value) })} /></label>
          </div>
          <label className="rulebook-toggle"><input type="checkbox" disabled={disabled} checked={interaction.anchor !== undefined} onChange={(event) => onChange({ ...interaction, anchor: event.target.checked ? createDefaultDraftRulebookSelector('operators', dataset) : undefined })} /><span>Require an anchor selector to be drafted</span></label>
          {interaction.anchor && <InteractionSelectorField label="Anchor" selector={interaction.anchor} dataset={dataset} disabled={disabled} onChange={(anchor) => onChange({ ...interaction, anchor })} />}
        </div>
      )}

      <ResolvedInteractionPreview rulebook={rulebook} interaction={interaction} dataset={dataset} />
    </article>
  )
}

export default function DraftRulebookInteractionEditor({
  rulebook,
  dataset,
  disabled = false,
  onChange,
}: DraftRulebookInteractionEditorProps): React.JSX.Element {
  const addInteraction = (type: DraftRulebookInteraction['type']): void => {
    onChange([...rulebook.interactions, createInteraction(type, rulebook.interactions, dataset)])
  }

  return (
    <div className="rulebook-interactions-editor">
      <div className="rulebook-editor-subheading">
        <div>
          <strong>Interaction rules</strong>
          <small>Discount operator costs when related operators are already in the drafted squad.</small>
        </div>
        <div className="rulebook-interaction-add-actions">
          <button type="button" className="secondary-button" disabled={disabled} onClick={() => addInteraction('anchor')}>Add Anchor</button>
          <button type="button" className="secondary-button" disabled={disabled} onClick={() => addInteraction('progressive')}>Add Progressive</button>
          <button type="button" className="secondary-button" disabled={disabled} onClick={() => addInteraction('threshold')}>Add Threshold</button>
        </div>
      </div>

      {rulebook.interactions.length === 0 ? (
        <p className="filter-note">No interaction rules. Operator costs use only their baseline and explicit overrides.</p>
      ) : (
        <div className="rulebook-interaction-list">
          {rulebook.interactions.map((interaction, index) => (
            <InteractionEditor
              key={interaction.id}
              rulebook={rulebook}
              interaction={interaction}
              dataset={dataset}
              disabled={disabled}
              onChange={(next) => onChange(rulebook.interactions.map((current, currentIndex) => currentIndex === index ? next : current))}
              onRemove={() => onChange(rulebook.interactions.filter((_, currentIndex) => currentIndex !== index))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
