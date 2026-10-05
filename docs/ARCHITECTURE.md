# Architecture

## Goals

- Windows-first Electron desktop application.
- Standard squad generation and Draft gameplay work completely offline once operator data/assets are present.
- Operator data and artwork have bundled fallbacks and can be updated independently from application releases.
- Draft behavior is defined by Rulebooks; Standard Draft is the simplest built-in Rulebook, not a separate execution engine.
- Persistent renderer state has one versioned migration boundary.
- The renderer never receives unrestricted Node.js or filesystem access.

## Process boundaries

### Main process

`src/main` owns native desktop capabilities:

- Electron window lifecycle.
- Filesystem/application-data access.
- Runtime operator-data activation, staging, and rollback.
- Operator avatar/portrait synchronization.
- Network-backed update checks and downloads.
- IPC handlers exposed to the renderer through preload.

Renderer-supplied IPC arguments are validated in the main process before service calls. External window requests are denied inside Electron; only explicit `http:` and `https:` URLs may be handed to `shell.openExternal()`.

### Preload

`src/preload/index.ts` is the only bridge between renderer code and Electron/native APIs. It exposes the narrow `DesktopApi` contract from `src/shared/desktop.ts`.

IPC channel names are centralized in `src/shared/desktopIpc.ts` and shared by main and preload instead of duplicating string literals.

### Renderer

The React renderer depends on shared domain modules and the preload API, not on Electron or Node built-ins.

`App.tsx` is primarily the application shell, shared high-level state, navigation, and feature composition:

```text
App
├─ StandardSquadFeature
├─ DraftPanel
├─ GlobalPoolFeature
├─ DraftRulebookPanel
└─ OptionsPanel
```

Feature ownership is intentionally local:

- `StandardSquadFeature` owns Standard Squad generation, slot editing, confirmations, and user squad preset management.
- `DraftPanel` owns Draft Rulebook selection and Draft session presentation; `useDraftSession` owns Draft session state.
- `GlobalPoolFeature` owns operator-eligibility/filter orchestration and pool presentation.
- `DraftRulebookPanel` composes Rulebook authoring sections around `useDraftRulebookLibrary`.
- `useOperatorDataset` owns renderer-side dataset loading, localization, update checks, and update installation orchestration.

### Shared domain

`src/shared` contains framework-independent types and domain logic. It must remain usable by unit tests without Electron.

Notable boundaries include:

- `draft/*` — Draft session/actions/economy/offers/configuration engine.
- `rulebook/*` — Draft Rulebook schema/domain internals.
- `draftRulebook.ts` — stable public Rulebook facade.
- `draftRulebookExecution.ts` — resolves a selected Rulebook into the effective runtime inputs.
- `operatorDataPipeline.ts` — shared Node-compatible operator-data source/build pipeline.
- `desktopIpc.ts` — IPC channel contract and main-boundary validators.

## Draft execution

All Draft sessions use one execution path:

```text
Selected Draft Rulebook
        ↓
resolveDraftRulebookExecution()
        ↓
effective pool + configuration + interactions + identity
        ↓
useDraftSession()
        ↓
DraftSessionView
```

`STANDARD_DRAFT_RULEBOOK` goes through this same path. Built-in, local, and imported Rulebooks differ only by declarative Rulebook data.

The execution identity includes the Rulebook execution identity, effective operator pool, and target squad size. Changing any of those resets the Draft session rather than allowing stale state to cross configurations.

### Rulebook pool sources

Rulebooks support three pool sources:

- **Inherit Global Pool** — uses the already-resolved app-wide Global Pool.
- **Global Pool + Rulebook Restrictions** — can only restrict the current Global Pool.
- **Rulebook Pool** — resolves eligibility from the installed dataset and intentionally ignores Global Pool exclusions.

### Rulebook domain organization

`src/shared/rulebook/` separates the Rulebook domain into semantic modules:

```text
rulebook/
├─ types.ts
├─ defaults.ts
├─ validation.ts
├─ serialization.ts
├─ selectors.ts
├─ resolution.ts
└─ migrations.ts
```

`draftRulebook.ts` re-exports the stable public API so consumers do not depend on internal file layout.

Selector semantics are centralized in `rulebook/selectors.ts`. Runtime matching, editor selector catalogs/defaults, structural selector validation, and portability reference inspection use the same selector knowledge.

Schema migrations are explicit in `rulebook/migrations.ts`. Schema v1 is currently the portable format; future schema changes should add a migration from the previous version rather than embedding ad-hoc migration behavior in import/UI code.

## Rulebook authoring

Renderer Rulebook authoring is split into a controller plus focused sections:

```text
DraftRulebookPanel
├─ useDraftRulebookLibrary
├─ DraftRulebookLibrary
├─ DraftRulebookIdentifierEditor
├─ DraftRulebookGeneralRulesEditor
├─ DraftRulebookPoolEditor
├─ DraftRulebookOverridesEditor
└─ DraftRulebookInteractionsEditor
```

The library controller owns selection, create/duplicate/delete, import compatibility handling, and editor updates. Domain-specific selector/cost/interaction behavior stays in shared/domain helpers rather than being reimplemented by each editor section.

## Renderer persistence

`src/renderer/src/rendererPersistence.ts` is the single versioned renderer persistence boundary. It owns normalization/default handling and migration from the earlier fragmented local-storage keys.

The persisted root includes:

- Operator preferences.
- User squad presets.
- Dismissed warning flags.
- Selected Draft Rulebook.
- Race exclusions.
- Artwork preference.
- Draft Rulebook library entries.

Rulebook library metadata is stored beside each document:

```text
RulebookLibraryEntry
├─ document
├─ origin: built-in | local | imported
└─ editor metadata
```

Editor persistence validity is deliberately separate from execution/export validity. A temporarily invalid in-progress Rulebook remains persisted so an unfinished edit survives reload; execution and export remain blocked until `validateDraftRulebook()` succeeds. Structurally corrupted storage that the editor cannot render safely is rejected during persistence normalization.

## Operator data lifecycle

A known-good operator dataset ships in `resources/bundled-data/operators`.

At runtime:

1. The app prefers a validated downloaded dataset in Electron's `userData` directory.
2. If no valid downloaded dataset exists, the bundled dataset is used.
3. Update checks compare upstream source commits through `src/shared/operatorDataPipeline.ts`.
4. When an update is available, the same shared pipeline fetches source tables, normalizes/builds the dataset, applies race metadata, and validates the generated result.
5. `src/main/operatorDataService.ts` stages runtime data/assets and activates the dataset with rollback protection. A failed activation leaves the last known-good dataset usable.

Bundled-data generation uses the same source-version/fetch/build/validation pipeline from `scripts/update-operator-data.mts`, but keeps CLI-specific output and optional asset-download behavior in the script.

This separation is intentional:

```text
shared operatorDataPipeline
├─ source version detection
├─ source comparison
├─ source-table fetching
├─ normalization / dataset construction
└─ generated-dataset validation

runtime operatorDataService
├─ staging
├─ activation
├─ rollback
└─ runtime image cache policy

bundled-data CLI
├─ bundled JSON output
└─ optional avatar / UI-asset download policy
```

## Styling organization

Renderer styles are organized by semantic responsibility rather than implementation iteration:

- `styles.css` — base renderer/application styles.
- `DraftPanel.css` — Draft session presentation.
- `GlobalPoolFeature.css` — release/source/global-pool controls.
- `StandardSquadFeature.css` — Standard Squad/preset/slot editor controls.
- `PresentationPreferences.css` — portrait presentation and display-option styling.
- `RendererTheme.css` — shared rarity/theme and final layout refinements.
- `OperatorFilters.css` — subclass/race/faction filter UI.
- Component-specific styles remain with their corresponding feature where appropriate.

New styling should be added to the semantic feature/component owner rather than creating chronology-based `iteration*.css` files.

## Security baseline

The Electron window keeps these settings intact:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`

Additional boundary rules:

- Main/preload use the shared IPC channel contract.
- Main-process IPC handlers validate renderer-supplied identifiers/enums before service calls.
- Renderer code has no arbitrary filesystem access.
- Renderer-created windows are denied.
- `shell.openExternal()` is limited to `http:` and `https:` URLs.

## Testing and change boundaries

Pure domain logic belongs under `src/shared` so it can be exercised without Electron. Refactors should preserve public facades and behavior while moving ownership boundaries; schema or gameplay behavior changes should be deliberate, separately reviewed changes rather than incidental consequences of file movement.
