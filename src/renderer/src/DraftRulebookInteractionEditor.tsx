import { useMemo } from 'react'
import type { OperatorDataset } from '../../shared/operator'
import type {
  DraftRulebook,
  DraftRulebookInteraction,
  DraftRulebookSelector,
} from '../../shared/draftRulebook'
import { getDraftRulebookOperatorCostBreakdown } from '../../shared/draftRulebookCost'
import OperatorCard from './OperatorCard'
import {
  DraftRulebookSelectorEditor,
  createDefaultDraftRulebookSelector,
} from './DraftRulebookSelectorEditor'
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
          {affected.slice(0, 8).map((operator) => {
            const cost = getDraftRulebookOperatorCostBreakdown(
              rulebook,
              operator,
              dataset.operators,
            )
            return (
              <div className="rulebook-interaction-preview-card" key={operator.id}>
                <OperatorCard
                  operator={operator}
                  interactionDetails={buildRulebookOperatorInteractionDetails(
                    rulebook,
                    operator,
                    dataset,
                  )}
                />
                <div>
                  <span>Baseline <strong>{cost.baselineCost}</strong></span>
                  <span>Range <strong>{cost.minimumCost}–{cost.maximumCost}</strong></span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {affected.length > 8 && (
        <small className="filter-note">Showing 8 of {affected.length} currently matching operators.</small>
      )}
    </div>
  )
}

function AnchorEditor({
  interaction,
  dataset,
  disabled,
  onChange,
}: {
  interaction: Extract<DraftRulebookInteraction, { type: 'anchor' }>
  dataset: OperatorDataset
  disabled: boolean
  onChange: (interaction: DraftRulebookInteraction) => void
}): React.JSX.Element {
  return (
    <div className="rulebook-interaction-fields">
      <div>
        <strong>Source</strong>
        <DraftRulebookSelectorEditor
          dataset={dataset}
          selector={interaction.source}
          disabled={disabled}
          onChange={(source) => onChange({ ...interaction, source })}
        />
      </div>
      <div>
        <strong>Target</strong>
        <DraftRulebookSelectorEditor
          dataset={dataset}
          selector={interaction.target}
          disabled={disabled}
          onChange={(target) => onChange({ ...interaction, target })}
        />
      </div>
      <label className="field">
        <span>Modifier per formed connection</span>
        <input
          type="number"
          min={0}
          disabled={disabled}
          value={interaction.modifier}
          onChange={(event) => onChange({ ...interaction, modifier: Number(event.target.value) })}
        />
      </label>
    </div>
  )
}

function ProgressiveEditor({
  interaction,
  dataset,
  disabled,
  onChange,
}: {
  interaction: Extract<DraftRulebookInteraction, { type: 'progressive' }>
  dataset: OperatorDataset
  disabled: boolean
  onChange: (interaction: DraftRulebookInteraction) => void
}): React.JSX.Element {
  const updateStep = (index: number, patch: Partial<(typeof interaction.steps)[number]>): void => {
    onChange({
      ...interaction,
      steps: interaction.steps.map((step, currentIndex) =>
        currentIndex === index ? { ...step, ...patch } : step,
      ),
    })
  }
  const addStep = (): void => {
    const last = interaction.steps.at(-1)
    onChange({
      ...interaction,
      steps: [
        ...interaction.steps,
        { memberCount: (last?.memberCount ?? 1) + 1, modifier: last?.modifier ?? 1 },
      ],
    })
  }

  return (
    <div className="rulebook-interaction-fields">
      <div>
        <strong>Group selector</strong>
        <DraftRulebookSelectorEditor
          dataset={dataset}
          selector={interaction.group}
          disabled={disabled}
          onChange={(group) => onChange({ ...interaction, group })}
        />
      </div>
      <div className="rulebook-progressive-steps">
        <div className="rulebook-editor-subheading">
          <div><strong>Progressive steps</strong><small>The active modifier is the latest step reached by the resulting group size.</small></div>
          <button type="button" className="secondary-button" disabled={disabled} onClick={addStep}>Add step</button>
        </div>
        {interaction.steps.map((step, index) => (
          <div className="rulebook-progressive-step" key={index}>
            <label className="field">
              <span>Member count</span>
              <input
                type="number"
                min={1}
                disabled={disabled}
                value={step.memberCount}
                onChange={(event) => updateStep(index, { memberCount: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              <span>Modifier</span>
              <input
                type="number"
                min={0}
                disabled={disabled}
                value={step.modifier}
                onChange={(event) => updateStep(index, { modifier: Number(event.target.value) })}
              />
            </label>
            <button
              type="button"
              className="secondary-button"
              disabled={disabled || interaction.steps.length === 1}
              onClick={() => onChange({
                ...interaction,
                steps: interaction.steps.filter((_, currentIndex) => currentIndex !== index),
              })}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ThresholdEditor({
  interaction,
  dataset,
  disabled,
  onChange,
}: {
  interaction: Extract<DraftRulebookInteraction, { type: 'threshold' }>
  dataset: OperatorDataset
  disabled: boolean
  onChange: (interaction: DraftRulebookInteraction) => void
}): React.JSX.Element {
  return (
    <div className="rulebook-interaction-fields">
      <div>
        <strong>Group selector</strong>
        <DraftRulebookSelectorEditor
          dataset={dataset}
          selector={interaction.group}
          disabled={disabled}
          onChange={(group) => onChange({ ...interaction, group })}
        />
      </div>
      <div className="rulebook-inline-fields">
        <label className="field">
          <span>Threshold</span>
          <input
            type="number"
            min={1}
            disabled={disabled}
            value={interaction.threshold}
            onChange={(event) => onChange({ ...interaction, threshold: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>Modifier</span>
          <input
            type="number"
            min={0}
            disabled={disabled}
            value={interaction.modifier}
            onChange={(event) => onChange({ ...interaction, modifier: Number(event.target.value) })}
          />
        </label>
      </div>
      <label className="rulebook-toggle">
        <input
          type="checkbox"
          disabled={disabled}
          checked={interaction.anchor !== undefined}
          onChange={(event) => onChange(event.target.checked
            ? { ...interaction, anchor: createDefaultDraftRulebookSelector('operators', dataset) }
            : { id: interaction.id, type: interaction.type, group: interaction.group, threshold: interaction.threshold, modifier: interaction.modifier })}
        />
        <span>Require an anchor selector in addition to the group threshold</span>
      </label>
      {interaction.anchor && (
        <div>
          <strong>Anchor selector</strong>
          <DraftRulebookSelectorEditor
            dataset={dataset}
            selector={interaction.anchor}
            disabled={disabled}
            onChange={(anchor) => onChange({ ...interaction, anchor })}
          />
        </div>
      )}
    </div>
  )
}

export default function DraftRulebookInteractionEditor({
  rulebook,
  dataset,
  disabled = false,
  onChange,
}: DraftRulebookInteractionEditorProps): React.JSX.Element {
  const updateInteraction = (index: number, interaction: DraftRulebookInteraction): void => {
    onChange(rulebook.interactions.map((current, currentIndex) =>
      currentIndex === index ? interaction : current,
    ))
  }
  const addInteraction = (type: DraftRulebookInteraction['type']): void => {
    onChange([...rulebook.interactions, createInteraction(type, rulebook.interactions, dataset)])
  }

  return (
    <div className="rulebook-interactions-editor">
      <div className="rulebook-interaction-toolbar">
        <div>
          <strong>Directional interaction rules</strong>
          <small>Selectors stay portable; current operator matches are resolved from the installed dataset.</small>
        </div>
        <div className="section-actions">
          <button type="button" className="secondary-button" disabled={disabled} onClick={() => addInteraction('anchor')}>Add Anchor</button>
          <button type="button" className="secondary-button" disabled={disabled} onClick={() => addInteraction('progressive')}>Add Progressive</button>
          <button type="button" className="secondary-button" disabled={disabled} onClick={() => addInteraction('threshold')}>Add Threshold</button>
        </div>
      </div>

      {rulebook.interactions.length === 0 ? (
        <p className="filter-note">No interactions. Operator costs remain at their static baselines.</p>
      ) : (
        <div className="rulebook-interaction-list-editor">
          {rulebook.interactions.map((interaction, index) => (
            <article className="rulebook-interaction-card" key={interaction.id}>
              <div className="rulebook-editor-subheading">
                <div>
                  <strong>{interaction.type === 'anchor' ? 'Anchor' : interaction.type === 'progressive' ? 'Progressive' : 'Threshold'}</strong>
                  <small>{interaction.id}</small>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={disabled}
                  onClick={() => onChange(rulebook.interactions.filter((_, currentIndex) => currentIndex !== index))}
                >
                  Remove
                </button>
              </div>

              <label className="field">
                <span>Stable interaction ID</span>
                <input
                  disabled={disabled}
                  value={interaction.id}
                  onChange={(event) => updateInteraction(index, { ...interaction, id: event.target.value })}
                />
              </label>

              {interaction.type === 'anchor' && (
                <AnchorEditor interaction={interaction} dataset={dataset} disabled={disabled} onChange={(next) => updateInteraction(index, next)} />
              )}
              {interaction.type === 'progressive' && (
                <ProgressiveEditor interaction={interaction} dataset={dataset} disabled={disabled} onChange={(next) => updateInteraction(index, next)} />
              )}
              {interaction.type === 'threshold' && (
                <ThresholdEditor interaction={interaction} dataset={dataset} disabled={disabled} onChange={(next) => updateInteraction(index, next)} />
              )}

              <ResolvedInteractionPreview rulebook={rulebook} interaction={interaction} dataset={dataset} />
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
