# Architecture

## Goals

- Windows-first Electron desktop application.
- Core squad randomization works completely offline.
- Operator data and operator images have a bundled fallback.
- Operator-data updates are independent from application releases.
- The renderer never receives unrestricted Node.js or filesystem access.

## Process boundaries

### Main process

Owns native desktop capabilities: windows, filesystem access, application-data paths, and future network-backed data updates.

### Preload

The only bridge between the renderer and Electron/native APIs. Add narrowly scoped APIs here rather than enabling `nodeIntegration`.

### Renderer

React application. It should depend on shared domain types and APIs exposed by preload, not on `electron` or Node built-ins.

### Shared domain

`src/shared` contains framework-independent types and randomizer logic. It must remain runnable under unit tests without Electron.

## Data lifecycle

1. A known-good operator dataset ships in `resources/bundled-data`.
2. At runtime, the app will prefer a validated dataset in Electron's `userData` directory when one exists.
3. If no downloaded dataset exists, the bundled copy is used.
4. Future update checks compare upstream versions from:
   - `ArknightsAssets/ArknightsGamedata` (CN and EN character data)
   - `yuanyan3060/ArknightsGameResource` (operator avatars)
5. A newly generated dataset is validated before replacing the current local copy.
6. A failed update must leave the last known-good dataset untouched.

## Security baseline

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- External links are opened in the system browser.
- The renderer does not fetch or write arbitrary local files.
- Future IPC handlers should validate inputs at the main-process boundary.

## Squad order

The 6x2 desktop layout uses CSS column flow so slot numbering appears as:

    [1] [3] [5] [7] [9]  [11]
    [2] [4] [6] [8] [10] [12]
