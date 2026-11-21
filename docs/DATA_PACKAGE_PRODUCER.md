# Prepared data producer

M2 implements a combined operator/Garrison producer using the existing normalization functions. It generates the format defined in [DATA_PACKAGE.md](DATA_PACKAGE.md) and compares against the frozen [M1 baseline](DATA_BASELINE.md). This producer prepares local artifacts and does not publish or activate them. Publication/build selection and application consumption are separate boundaries documented in [DATA_PACKAGE_DELIVERY.md](DATA_PACKAGE_DELIVERY.md) and [DATA_PACKAGE_READERS.md](DATA_PACKAGE_READERS.md).

## Commands

Rebuild the frozen M1 observation and check behavior parity without network access:

```powershell
npm.cmd run data:package -- --from-baseline .tmp/data-baseline/m1-2026-11-20 --output .tmp/data-package/m2-validated
```

Replay the producer's own frozen snapshot into a different output directory:

```powershell
npm.cmd run data:package -- --snapshot .tmp/data-package/m2-validated/capture/snapshot.json --compare-baseline .tmp/data-baseline/m1-2026-11-20 --output .tmp/data-package/m2-replayed
```

Capture current public inputs explicitly:

```powershell
npm.cmd run data:package -- --online --output .tmp/data-package/new-observation
```

For subsequent live observations, add `--previous-snapshot <previous capture/snapshot.json>` to reuse the original input-observation time when all source revisions and input body hashes are unchanged. The producer still checks both metadata repository heads and every PRTS page. A changed PRTS body participates in package identity even when both GitHub heads match.

These Windows PowerShell commands use `npm.cmd` to preserve argument separators. The direct cross-platform equivalent starts with `node --experimental-transform-types scripts/build-data-package.mts` and uses the same arguments.

The previous bundled dataset is checked for loss of confirmed dates/availability. `--previous-dataset <operators.json>` selects a different known-good reference. Supplying a prior snapshot does not supply its data as a silent fallback after a failed live request.

Exactly one of `--online`, `--from-baseline` and `--snapshot` is required. Existing output directories are never overwritten. `--help` describes the entry points. No command modifies bundled data, artwork, user data, channel pointers or workflow configuration.

## Output and ownership

```text
<output>/
  package/
    manifest.json
    operators.json
    garrison/<region>-<locale>.json   # ten catalogs
  capture/
    snapshot.json
    bodies/<sha256>.body
  evidence/
    source-inventory.json
    producer-source/<source paths>
    corrections.json
  build-report.json
```

Only `package/` is the prospective client payload. The much larger frozen input bodies and source evidence belong to the producer archive. Keep generated upstream data under ignored storage, rather than committing it to the public source snapshot.

The manifest records an operator-schema-v6 dataset, Garrison schema 1, the reader protocol, normalization versions, exact producer/correction fingerprints, both metadata source commits, PRTS query/body fingerprints and all eleven payload hashes and sizes. The legacy dataset's `resourcesCommit` is deliberately null inside this package. Producer and prepared-package readers explicitly validate metadata independently of artwork. Older applications need the new reader rather than a copied operator JSON file.

Output is staged separately and renamed into the requested new directory after writes complete. An interrupted or failed write cannot replace an existing package. A baseline mismatch returns exit code 2, sets `eligibleForPublication` false and places candidate payloads under `evidence/candidate/`; it does not expose a successful `package/` directory. Source/validation failures return exit code 1. A successful build returns 0. Actual publication and installation are separate integrations.

## Shared capture and normalization

`dataPackageInputs.ts` resolves two metadata heads and accepts only their pinned game/release paths and the configured PRTS query. Each input URL is fetched once per observation and shared across operator normalization and all ten catalogs. Parsed source tables are reused read-only. Frozen rebuilds use the supplied byte reader with checksum/length verification and have no network fallback.

The complete input snapshot retains the first observation time, source revisions, URL, decoded byte count and SHA-256 for each body. Replays reuse that time verbatim. Every JSON table must parse as an object; each PRTS page must have the expected Cargo response shape. Duplicate snapshot URLs, missing/unused bodies, changed checksums and moving source revisions are rejected.

The producer tracks errors even where the legacy pipeline tolerates missing optional release-event inputs. It rejects the entire preparation if an input fails, a supported catalog cannot be localized, a catalog is empty, or the captured PRTS date source is empty or malformed. Existing known availability/dates cannot disappear relative to the supplied previous dataset. The last published package is outside the producer's write boundary and is left available after a failure.

`dataPackageProducer.ts` reuses `operatorDataPipeline.ts`, `loadGarrisonEvents.ts` and `garrisonEventHelper.ts`. It validates the payload count, descriptors, sizes/hashes, schemas, metadata provenance, localizations, unique events, stage groups, representatives and structural equality across display languages. Language may replace event names; it cannot change regional content, event identities, stage order or representatives.

## Maintained corrections

`dataCorrections.ts` now owns the inherited date overrides and presentation aliases, historical limited/acquisition membership, Kernel roster, English subclass labels, collaboration registry, Amiya race presentation and chapter/crossover representatives. Existing public metadata modules re-export the same previously public values, so callers keep their existing imports.

`DATA_CORRECTION_POLICY` records each category's reason, precedence and existing references. Values without individual historical references are explicitly carried forward for parity, rather than presented as newly verified facts. Generic normalization algorithms remain in their existing modules and are covered by the producer-source fingerprint. Generated gender fallback data remains generated data rather than becoming a manually maintained correction.

## Verification boundary

The M1-to-M2 comparison checks the rebuilt operator behavior, resolved display values in all five languages and all ten Garrison catalogs. It deliberately accounts for three envelope changes: Garrison schema wrappers, a null legacy artwork stamp and deterministic object-key serialization. Operator/event identities, arrays, dates, classifications, appearance references and localized/fallback values remain unchanged.

Tests cover a complete eleven-payload build, source deduplication, byte-identical offline replay, unchanged content across later observations, PRTS-only changes and pagination, unavailable/malformed sources, corrupted/missing snapshot bodies, pinned revisions, previous-date/availability protection and independently rehashed invalid payloads. M2 completion on the repository workboard still requires landing and validation on `main`; these local artifacts do not claim a production rollout.

## Local verification on 20 November 2026

The prepared artifact is `.tmp/data-package/m2-validated/package/`; `.tmp/data-package/m2-replayed/package/` is its independent frozen rebuild. Both have package ID `sha256:c15265d204534093006addb9509c7fb46c2fe4268a606aee7e1e4e94a6a6520f` and producer source fingerprint `9bb21d37471e1b442a5a1182095886b7a57364a0b5e7a555d17eff4fdc5e60e9`.

| Check                                          | Result                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Prepared client payloads                       | 440 operators and ten catalogs; 1,797,270 bytes excluding manifest       |
| Frozen producer inputs                         | 59 unique URLs; each body loaded once; zero network requests             |
| M1 behavior comparison                         | 11/11 equal: rebuilt operator behavior plus all ten catalogs             |
| Legacy producer after correction consolidation | All 12 M1 behavior snapshots still equal on offline replay               |
| Independent package replay                     | All eleven payloads and the manifest are byte-identical                  |
| Changed-baseline CLI case                      | Exit 2; publication eligibility false; evidence-only candidate directory |
| Existing-output CLI case                       | Exit 1; existing manifest remains unchanged                              |
| Automated suite                                | 214 test files / 1,312 tests passed, including 15 producer cases         |
| Build checks                                   | Node and renderer type checks, desktop build and web build passed        |
| Code checks                                    | Touched-file ESLint passed with zero warnings                            |

The validated producer run took 2,573.54 ms and its independent replay took 2,267.84 ms on this Windows development checkout. These include local frozen-body reads and normalization and exclude archive writing; they are single observations, not live-network speed comparisons. Complete reports and per-file source fingerprints are retained alongside the packages. The existing `dispatcher` English-label warning remains.

This M2 checkpoint preserved the pre-existing workspace edits. The old source audit's archive writes are now sequential to avoid a Windows shared-directory creation failure observed during verification. Application loading and publication were connected subsequently in M3/M4. The selected artifact retains its original archived producer fingerprint; subsequent producer source changes do not rewrite that immutable version.
