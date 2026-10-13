# Arknights Randomizer

Offline-first Windows desktop app for building randomized Arknights squads and running interactive drafts against a configurable operator pool.

The app combines standard squad randomization, detailed operator eligibility controls, operator-pool curation, and an evolving Draft Rulebook system in one Electron application.

## Current state

The current `main` branch is organized around three primary areas.

### Get Squad

**Standard** generates a squad from the current Global Pool.

Current Standard features include:

- configurable squad size;
- rarity and class composition bounds;
- per-slot constraints;
- built-in and user-created squad presets;
- validation before generation;
- operator cards using cached E1/E2 artwork when available.

**Drafts** runs an interactive Draft Session using a selected Draft Rulebook.

Current Draft features include:

- built-in, imported, and locally-authored Rulebooks;
- configurable offer size and pull distribution;
- Rulebook-specific operator pools;
- optional economy, points, and operator pricing;
- optional capacity rules;
- Rulebook-controlled actions such as Hold, Capacity Forfeit, Reroll, and Capacity Expansion;
- action confirmation controls;
- completed-run Draft history;
- selectable built-in presets: Standard Draft, Dev Strict, Arknights Headhunting, and Dev Lax.

The plain **Standard Draft** is pick-1-from-3 using the current Global Pool with the extra economy/action systems disabled. The other built-in Rulebooks are active balance/development presets and may change as Draft design work continues.

### Setup

**Global Pool** defines the operator set used by Standard and by Draft Rulebooks that inherit the global pool.

The Global Pool UI is split into **Global Filter** and **Curate**. It currently supports filtering and curation using release bounds/region, acquisition source, collaboration source, class/subclass, race, faction, Kernel-era metadata, Alter exclusivity, and individual operator inclusion/exclusion. Pool presentation and search/grouping tools are available without changing eligibility.

**Draft Rulebooks** provides the current Rulebook library and editor. Built-in Rulebooks are read-only; custom Rulebooks can be created, duplicated, imported, exported, edited, and deleted.

The editor currently exposes these sections:

- Rulebook
- Pool
- Variables
- Probability
- Pricing
- Interactions

Rulebooks are currently imported/exported as portable JSON. The Variables section is intentionally read-only for now: authored constants, runtime state variables, derived values, and custom entities are part of the planned portable Rulebook runtime but are not exposed as authored backend data yet.

### Options

Current application preferences include:

- metadata region (EN / Global or CN);
- game-data localization for game-provided names and terminology;
- Global Pool presentation mode;
- Draft action confirmations;
- preferred E1/E2 operator artwork;
- offline artwork-cache download status and controls.

App-owned interface text is currently English; changing game localization only changes game-provided names and terminology.

## Stack

- Electron
- React
- TypeScript
- Vite via electron-vite
- Vitest
- electron-builder

## Development

Prerequisite: **Node.js 24** and npm.

From a clean clone:

```sh
npm ci
npm run data:update
npm run dev
```

Useful validation commands:

```sh
npm run data:validate
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

### Local builds

Compile the Electron application without packaging:

```sh
npm run build
```

Create an unpacked/raw Electron build:

```sh
npm run build:unpack
```

Create the portable Windows release executable:

```sh
npm run build:win
```

`build:unpack` and `build:win` refresh bundled operator metadata before packaging. `build:portable` remains an alias for the portable Windows build.

## Data and artwork

The project consumes public Arknights community/game-data sources and normalizes them into its own application schema. Update scripts live in `scripts/`.

Generated operator metadata and class icons under `resources/bundled-data` are intentionally not part of the public source snapshot; they are recreated with `npm run data:update` for development and packaging.

Operator avatars and promotion artwork are not packaged with the public application source. They are downloaded into the persistent user-data artwork cache as needed so an installed copy can continue using cached artwork offline. Missing artwork falls back gracefully instead of making squad generation unavailable.

Current upstream sources include:

- operator data: `ArknightsAssets/ArknightsGamedata`
- operator imagery: `yuanyan3060/ArknightsGameResource`
- class/branch icons: `tohmatosauce/ak-branch-icons`
- operator release metadata: `nadering/arknights-toolbox`

Arknights and its game assets are property of their respective rights holders. This project is an unofficial fan utility. Third-party game data and artwork are not represented as project-owned material.

See `THIRD_PARTY_NOTICES.md` for source-by-source provenance and licensing notes.

## Windows releases

Windows releases are distributed as a single portable executable. Portable update data is kept in `Arknights-Randomizer-Data` beside the executable when writable.

Current builds are unsigned, so Windows may display its normal warning for unsigned applications.

## Automation

Permanent GitHub Actions workflows are intentionally **manual-only**. The project does not automatically run CI, refresh data, or build releases on pushes, pull requests, schedules, or tags.

Run a GitHub Actions workflow only when the project explicitly decides to use one for that task. Permanent workflows use read-only repository contents permissions; generated operator data/artwork is validation/build output rather than something an automated refresh workflow pushes directly to `main`.

## Workboard and documentation

GitHub **Issues** are the active project workboard and source of truth for implementation tasks. `WORKBOARD.md` is only a pointer and is not a second workboard.

Useful project documentation:

- `docs/ARCHITECTURE.md` — application architecture baseline;
- `docs/ITERATION6_DATA.md` — operator-data and filtering model;
- repository Issues — current implementation and Draft design work.

## License

The original Arknights Randomizer source code is licensed under the MIT License; see `LICENSE`.

The MIT grant does **not** apply to Arknights game data, artwork, names, trademarks, or other third-party material consumed or generated by this project. Those materials remain subject to their respective rights holders and upstream terms; see `THIRD_PARTY_NOTICES.md`.
