# Arknights Randomizer

Offline-first Windows desktop app for building randomized Arknights squads with configurable operator eligibility, pool controls, and squad constraints.

## Current state

The app is organized around four primary tabs:

- **Squads** — configure squad size, presets, slot constraints, and generate squads.
- **Operators** — control eligibility by release, class/subclass, faction, Kernel era, Alter exclusivity, and related metadata.
- **Pool** — inspect the resulting operator pool, search/group operators, and make explicit inclusions or exclusions.
- **Options** — application and presentation settings.

The next major product work is Draft Mode. GitHub Issues are the project workboard and source of truth for active implementation tasks.

## Stack

- Electron
- React
- TypeScript
- Vite via electron-vite
- Vitest
- electron-builder

## Development

Prerequisite: Node.js 24 and npm.

From a clean clone:

```sh
npm install
npm run data:update:images
npm run dev
```

Useful validation commands:

```sh
npm run data:validate
npm run typecheck
npm run lint
npm test
npm run build
```

Windows packaging commands:

```sh
npm run build:portable
npm run build:win
```

The build commands refresh the operator dataset and generated artwork caches before packaging, so the resulting desktop build carries the data it needs for normal offline use.

## Data and assets

The project consumes public Arknights community/game-data sources and normalizes them into its own application schema. Update scripts are kept in `scripts/`. Generated operator data and artwork caches under `resources/bundled-data` are intentionally not part of the public source snapshot; they are recreated with `npm run data:update:images` for development and packaging.

Current upstream sources include:

- operator data: `ArknightsAssets/ArknightsGamedata`
- operator imagery: `yuanyan3060/ArknightsGameResource`
- class/subclass/faction imagery sources documented by the update scripts and project history

Arknights and its game assets are property of their respective rights holders. This project is an unofficial fan utility. Third-party game data and artwork are not represented as project-owned material.

## Windows releases

The portable executable is the preferred distribution format. Installed and portable builds use the neutral **Arknights Randomizer** application identity; portable update data is kept in `Arknights-Randomizer-Data` beside the executable when writable.

Current builds are unsigned, so Windows may display its normal warning for unsigned applications.

## Automation

Workflow definitions are present under `.github/workflows`, but automatic triggers are intentionally disabled during the public-repository migration. They can be run manually after the project explicitly decides to use GitHub Actions again.

## Workboard

Use the repository's **Issues** page for active work. `WORKBOARD.md` is only a pointer and is not a second source of truth.

See `docs/ARCHITECTURE.md` for the design baseline and `docs/ITERATION6_DATA.md` for the current operator-data/filtering model.
