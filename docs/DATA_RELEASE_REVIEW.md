# Prepared-data release review — 1.2.3

M5 is implemented. M6 preview preparation is based on released application commit `a2e47b8c435226b3568f0c73f0ebeef8d2bf0267`, preserving current branding, themes, sharing, account boundaries and dependencies. Only the prepared-data/artwork work is integrated; unrelated edits in the older working checkout are excluded. This is a review candidate, not approval to promote main or deploy production.

## Selected versions

- Metadata: `sha256:c15265d204534093006addb9509c7fb46c2fe4268a606aee7e1e4e94a6a6520f`.
- Decoded artifact: SHA-256 `ad992d73261516d3969de7fb269c7b383e9c0c1aaa0feb7d715b201f33292ae5`, 2,040,330 bytes.
- Artwork inventory: `sha256:97571ccdd033988084a8de40e9cc500de09deaa8ae3425614a63d003eef67a9e`, 2,793 unique sources.
- Artwork download revision: `ebc29c3ccb39fe58bb129d66834eeac576559cb7`.

The build marker records the exact application commit alongside these selections. Clean dev builds use the preview data channel. Production data activation remains a separately confirmed publication of the selected package.

## Validation

Frozen replay of M1 inputs matches all eleven rebuilt behavior snapshots with zero changes and zero network requests. This preserves IDs, dates, acquisition, skins, localized/fallback strings, Garrison identities/stage order and representatives. Relative to the original November 16 bundle, the already-reviewed M1 differences are 23 display-field additions/changes (14 English names, eight outfit name/brand fields and one event label), with no roster-count, availability, date or acquisition changes.

The isolated current-main integration passes 114 test files / 699 tests. The older working checkout separately passed 219 files / 1,339 tests at the M5 checkpoint; it contains additional work outside this release candidate. Type checks, both builds and bundle/UI-icon validation pass. Repository-wide lint has zero errors and existing formatting warnings; changed data/artwork files are checked separately without warnings.

Actual Windows/browser Options checks compare all eleven payloads and five complete localized views before and after updates. Truncated downloads, failed storage, incompatible readers, offline restart, corrupt-current recovery and legacy bridging pass. Additional UI checks exercise Standard squad generation, Draft offers, loading an existing saved Garrison, both regions, all five locales and the shipped theme control. A local test candidate is used for update failure/success; it is never published.

M5 checks include shared source identity, old cache reuse, CRC/truncation checks, retries, unavailable/failed classification, concurrent subscribers, bulk interruption/resume and failed writes. Nine real provider assets validated successfully, with zero network calls on reuse. Cache clearing retains metadata and personal data. Full artwork acquisition remains explicit.

## Client-data measurements

| Observation                            | M1 legacy path                                                      | Prepared path                                              |
| -------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| Update requests                        | Three source checks, then 50 operator-fetch requests                | One channel check plus one complete package                |
| Response bodies                        | 26,394,650 declared compressed bytes for operator fetching          | 295,993 observed bytes: pointer 1,191 + gzip 294,802       |
| Decoded data                           | 265,927,751 bytes of operator source responses                      | 2,040,330 bytes containing the roster and all ten catalogs |
| Observed fetch/build or fetch/validate | 10,020 ms operator fetch/normalize/validate, excluding source check | 1,510 ms complete pointer/package retrieval and validation |

These are individual observations, not a controlled timing benchmark. Counts/bytes exclude HTTP/TLS overhead. The old path's Garrison source fetches are additional and are not included in that comparison; the prepared path already includes all catalogs.

Thirty new local client instances, with warm filesystem cache and full package verification plus all ten catalogs, made zero network requests. Read times in milliseconds: P1 52.664, P10 53.782, P25 55.271, P50 57.909, P75 65.496, P90 69.067, P99 80.671. These are data-reader measurements, not complete Electron cold-start times. The package reader performs more local validation than the old roster-only parse.

Evidence is kept under the isolated preview's `.tmp/`: `m6-data-replay-final`, `m6-data-measurements.json` and `data-checkpoint/run-KHenq9`. Commands are `data:update`, `data:validate`, `build`, `build:web`, `check-data-package-checkpoint.mts`, `measure-prepared-data.mts`, and the normal test suite.

## Promotion boundary

Before main promotion, review the exact dev source commit, local website preview on `127.0.0.1` and Windows preview. Native smoke reports verify packaged roster/catalog loading and application/data/artwork provenance; the portable release includes `windows-build-provenance.json`.

After explicit approval of this candidate, promote the reviewed source to main and publish the confirmed production data pointer. Verify the new Windows release and application Pages deployment against the promoted commit and selected data/artwork identities. Then dispatch `pages.yml` on `AK-RANDOM/ak-random.github.io` at main, wait for success and verify the root site's `source-revision.txt` and `data-package-revision.txt`. Update landed workboard status only after that evidence exists.

Production verification remains pending until that approval and promotion. Existing browser metadata can recover offline while its application shell is available; this does not introduce a service worker or promise a wholly offline website launch.
