# Data streamlining baseline

M1 preparation captures the existing data outputs and defines their comparison boundary before the producer or readers change. This is technical evidence and reproduction guidance; GitHub [#45](https://github.com/AK-RANDOM/zoot-randomizer-arknights/issues/45) remains the workboard. The proposed distribution format is in [DATA_PACKAGE.md](DATA_PACKAGE.md).

## Capture and replay

Run with Node 24 and the existing development dependencies installed:

```powershell
node --experimental-transform-types scripts/capture-data-baseline.mts --online --output .tmp/data-baseline/m1-2026-11-20
node --experimental-transform-types scripts/capture-data-baseline.mts --cache .tmp/data-baseline/m1-2026-11-20/inputs --output .tmp/data-baseline/m1-2026-11-20-replay --compare .tmp/data-baseline/m1-2026-11-20
```

`--online` allows missing inputs to be downloaded from the public sources. Omitting it forbids network access. Input cache entries are keyed by full URL and checked against their saved SHA-256 and byte count. Reusing a cache freezes the captured branch-head responses and PRTS pages; choose a new capture/cache directory for a later live observation. A completed output directory is never overwritten.

The capture leaves the bundled dataset, artwork and user data untouched. Generated data is kept under ignored `.tmp/`, consistent with the repository's policy of keeping upstream game data out of the source snapshot. Preserve the capture directory when moving the preparation to another checkout.

## Captured evidence

- `local-dataset.json` preserves the exact parsed installed development bundle; its original bytes/hash and source stamps are recorded in `report.json`.
- `local-operator-behavior.json` captures its complete behavior fields and resolved localized operator names, subclass labels, class/faction/race labels.
- `rebuilt-dataset.json` and `rebuilt-operator-behavior.json` capture the current pipeline's result using detected upstream commits and captured PRTS responses.
- `catalogs/<region>-<locale>.json` captures every existing Garrison event field, stage-code grouping/order and resolved helper for all ten combinations.
- `inputs/` retains public response bodies and their provenance; it contains no account synchronization data.
- `producer-source/` archives the actual normalization and audit source files so pre-existing uncommitted fixes are not lost when this checkout changes.
- `report.json` records source-file hashes, Git HEAD/dirty-state provenance, input revisions, payload hashes, validation results, request-level measurements, comparisons and timing scope.

The development checkout has pre-existing edits and its HEAD predates the current production application commit. The report records those facts and hashes the actual normalization files. It must not be described as a clean production-build measurement. The bundled roster also predates capture time; local-to-rebuilt differences are recorded separately from the offline replay comparison.

The Garrison capture resolves the legacy moving game-data branch once and pins all ten catalogs to it. This produces reproducible evidence without claiming that previously downloaded app caches used that same revision. Existing Garrison output has stage codes rather than native stage IDs; baseline comparisons preserve the actual existing identities.

## Measurement definitions

Timings are one observation per phase, not statistical performance claims. The report distinguishes local read/parse, validation, localization/snapshot writing, upstream source checks and the full existing fetch/normalize/validate pipeline. Electron startup, rendering, artwork downloads and runtime staging/activation are excluded.

Request counts are logical calls made by the current functions. Network calls and audit-cache hits are reported separately. Decoded response-body bytes measure JSON/text processed, not compressed network traffic. Declared `Content-Length` values are recorded separately where available and exclude HTTP/TLS overhead. Garrison phases reuse already captured tables where possible, so their elapsed time must be interpreted alongside their cache/network counts; logical bytes describe the raw tables required for that catalog.

Baseline behavior comparison ignores object-key order and dataset provenance only. It retains array ordering, stable identities, release dates/year groups, availability, acquisition groups, subclasses, factions, race/gender fields, all appearance references, translations and release-event mappings. Differences are reported with JSON pointers, total counts and bounded details. Missing fields differ from explicit nulls.

## Validation

The meaningful checks are successful dataset validation, complete generation of all ten catalogs, offline replay with zero network requests and equality of all twelve behavior snapshots. Tests additionally check release/acquisition/translation/skin changes, stage ordering, representative changes, optional fields, JSON-pointer escaping and request-byte accounting.

## Observation on 20 November 2026

Captured at 19:16 WIB using Node 24.22.1 on Windows x64. These are single observations from the existing development checkout, not production startup benchmarks. Full evidence is in `.tmp/data-baseline/m1-2026-11-20/report.json`; its frozen inputs are shared with the offline replay directories.

| Measurement                                              | Observed result                                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Local bundle                                             | 440 operators; 217 release events; 1,390,302 original bytes                               |
| Local read and JSON parse                                | 5.75 ms                                                                                   |
| Local validation                                         | 2.87 ms                                                                                   |
| Five-language localization and behavior-snapshot writing | 44.06 ms                                                                                  |
| Upstream source checks                                   | 3 requests; 430.83 ms                                                                     |
| Full operator fetch/normalize/validate                   | 50 requests, all network; 10,020.26 ms                                                    |
| Full operator response bodies                            | 265,927,751 decoded bytes; 26,394,650 declared compressed body bytes                      |
| Rebuilt operator dataset                                 | 440 operators; 217 release events; 1,391,350 canonical JSON bytes                         |
| English Global Garrison requirements                     | 4 logical requests; 43,953,424 decoded bytes                                              |
| Chinese CN Garrison requirements                         | 4 logical requests; 48,388,688 decoded bytes                                              |
| Derived Global catalogs                                  | 61 events and 1,118 stage entries in each display language                                |
| Derived CN catalogs                                      | 63 events and 1,159 stage entries in each display language                                |
| Derived catalog output                                   | 405,738 bytes across all ten files, including helper IDs                                  |
| Offline replay                                           | 109 logical requests; 109 cache hits; 0 network requests; all 12 behavior snapshots equal |

The complete audit used 62 network responses and replayed overlapping inputs for subsequent Garrison calls. Its totals are not a typical single-user update cost. Catalog stage counts count entries across events/groups, rather than asserting globally unique native stages. Every captured event has a resolved helper in this observation.

The new upstream snapshot adds 23 display-field changes relative to the November 16 bundle: 14 English character/token/trap name entries, 8 English outfit name/brand fields and 1 English release-event name. There are no roster-count, availability, release-date or acquisition changes in that comparison. All differences are retained as JSON pointers in `localToRebuiltComparison`; the capture does not replace the bundled file.

The original bundle's SHA-256 is `318275285dc59feecb7d6341c11688483ec8d9a9d26dbb6afc3ae5a7bc5fd634`. The detected game-data commit is `e0cd8f274ffbcf57ed0b0684cb681620478ffe0e`; release metadata is `45ae2912b394bb8fdb35285b79a24066a34e3c9b`. The captured PRTS response hash is `9fdea3b9fde3a52e6aba56f4834e612c0fe2e6a2201c933e9b3d7692e277feae`.

Local and rebuilt dataset validation both pass with the existing `dispatcher` subclass English-label warning. M1 preparation is local and validated; no application updater, publishing workflow, production deployment or workboard completion state has been changed by these preparation files.
