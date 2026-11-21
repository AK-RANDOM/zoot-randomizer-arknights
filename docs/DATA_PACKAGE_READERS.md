# Complete package readers

M4 connects Windows and browser consumption to the selected data package. This is a local implementation, not a main-branch or production rollout. [Delivery](DATA_PACKAGE_DELIVERY.md) covers immutable hosting, channels and application build pins.

## Shared runtime boundary

`dataPackageReader.ts` verifies the envelope, reader/schema compatibility, exact eleven-file inventory, package identity, per-file hashes and content using WebCrypto. It shares pure validation with the Node producer through `dataPackageValidation.ts`; source fetching and normalization are outside the reader.

`dataPackageClient.ts` owns the active roster and ten catalogs together. Fresh startup reads bundled data with no metadata-source requests. Manual checks fetch one channel pointer and compare package identity, so a PRTS-only correction is detectable even when repository heads do not change. Manual installation fetches one gzip artifact, bounds encoded and decoded sizes, verifies both hashes and all payloads, then persists the complete record before changing the active in-memory package. Concurrent installation calls in one client share the operation.

An update cannot silently remove known operator IDs or previously confirmed dates/availability. Incompatible readers receive a message requesting a newer application. Network errors, truncated responses, checksum failures, invalid catalogs and storage failures leave the active data usable. No metadata operation downloads artwork or raw upstream tables. Existing artwork controls remain independent; the developer image-only command also avoids rebuilding metadata.

## Persistence and recovery

Windows stores one `data-packages/cache.json` record in Electron's configured `userData` directory, including portable storage. `dataPackageRepository.ts` writes a unique temporary file in that directory, flushes/closes it and renames it over the cache. The record contains complete current and previous packages, so roster and catalogs cannot activate separately. Temporary files are removed after failure.

The browser stores the same current/previous record as one value in a dedicated IndexedDB database (`akr-data-packages`, version 1). A transaction must commit before activation. A successfully loaded bundle is cached for later metadata reads when its HTTP response is unavailable. Blocked storage does not prevent use of the bundled package; a failed installation save is reported without changing active data. This does not install a service worker or promise that the application shell itself can launch offline.

Startup validates the current record, then the previous record, then bundled data as needed. A new application bundle replaces an older saved package unless the saved package was installed against that bundle, is newer, or contains operator IDs absent from the bundle. Cached packages therefore survive app upgrades without silently discarding newer known operators. A damaged or unsupported saved package never suppresses the valid previous/bundled fallback.

## Legacy migration

Legacy Windows `operator-data/operators.json` remains read-only. If no complete saved package exists, newer legacy metadata or a roster containing additional known IDs is retained as a bridge. The reader displays “Using previously downloaded operator data until a complete data package is available.” Existing schema upgrades and acquisition corrections still apply. For obsolete pipeline versions, confirmed bundled CN dates replace old inferred dates; operators absent from the bundle keep unknown CN dates rather than fabricated values.

In bridge mode, a structurally valid version-14 regional/language Garrison cache is used when available, otherwise that catalog comes from the bundled package. These old caches lack matching source stamps; only complete package mode guarantees roster/catalog provenance together. No raw table request repairs the bridge in the background. Once a complete package is installed, it takes precedence and the old files remain untouched.

No preferences, pool rules, Rulebooks, saved Garrisons, account snapshots or artwork directories are moved, reset or deleted. Browser update controls are available in Options; Windows-only artwork/account controls remain scoped to Windows. Garrison reloads its catalog when the dataset changes after activation.

## Verification

The M4 checkpoint passed 218 test files / 1,331 tests, desktop/web type checks and builds, bundle/UI-asset validation and touched-file lint. Tests cover fresh offline use of every catalog, unchanged-source package changes, concurrent installation, corrupted/incompatible pointers and payloads, failed storage, previous-package recovery, application upgrades, legacy retention and date/ID loss protection.

The real Chromium integration check uses the built website, an isolated temporary browser profile and HTTP bound only to `127.0.0.1`:

```powershell
npm run build:web
node --experimental-transform-types scripts/smoke-data-package-browser.mts
```

It loads the actual 440-operator package and all ten catalogs, rejects a truncated gzip, installs a locally generated test version, verifies committed IndexedDB storage and the previous package, recovers offline metadata after restart, and checks preference retention. External network requests are blocked; artwork transfer is outside this check. Reports and the isolated profile remain under `.tmp/browser-data-smoke/run-*/`. The verified run was `run-HWTZxa`.

A separate hidden Windows launch exercised the actual renderer → preload → IPC → main-service path with a temporary portable profile and all network fetches failing. It loaded 440 operators and all ten catalogs (63 CN and 61 Global events per language), and an offline update check retained the bundle. The only attempted metadata request was the preview pointer; no raw source-table request occurred. Evidence is retained in `.tmp/m4-desktop-smoke-report.json` and its test harness `.tmp/m4-desktop-smoke.cjs`.

The published preview and source-selected bundle still use `sha256:c15265d204534093006addb9509c7fb46c2fe4268a606aee7e1e4e94a6a6520f`. Test-only versions are never uploaded. Production has no pointer yet; production activation and application promotion remain approval steps.

## First end-to-end checkpoint — M4

**Passed locally on 20 November 2026.** A fresh run exercised the actual built browser API and Windows renderer/preload/IPC services through the Options update buttons. This extends the earlier shared-client smoke checks with direct comparison of every returned payload and resolved localization, plus Windows process restarts.

| Check                  | Result                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Initial data           | Windows and web embed the exact pinned artifact; 440 operators, ten catalogs                                                                                                                           |
| Cross-platform content | All eleven full payload checksums/lengths and all five complete localized views match before and after installation                                                                                    |
| Regional catalogs      | Each language contains 63 CN events / 1,159 stage entries and 61 Global events / 1,118 stage entries                                                                                                   |
| Real update controls   | Both platforms reject a truncated download, retain data after storage failure, then install the complete test version successfully                                                                     |
| Incompatibility        | Both reject a newer reader requirement before downloading an artifact and retain the active version                                                                                                    |
| Offline/recovery       | Browser reload works with its bundled metadata response unavailable; a fresh Windows process loads the saved update offline; both recover the previous complete package after current-cache corruption |
| Migration/preferences  | A newer legacy Windows roster stays a labelled bridge until installation; afterward all eleven payloads match the prepared package. Old files and renderer preferences remain unchanged                |
| Public preview         | The actual reader downloaded the preview pointer and gzip in two successful requests, verified the pinned checksum and all payloads, and observed browser CORS on both responses                       |

The Windows write failure uses a real filesystem obstruction inside the isolated test profile. The browser write failure injects a quota exception into IndexedDB's write-transaction entry point. Test updates use a local candidate with changed catalog labels and a later observation timestamp, keeping upstream heads unchanged; it is never published. Both applications use their normal update interfaces, with feed URLs redirected only by the test harness to an HTTP server bound to `127.0.0.1`. Other external requests are blocked and no raw metadata-table request occurs.

Reproduce after preparing the pinned package and building both targets:

```powershell
npm run build
npm run build:web
node --experimental-transform-types scripts/check-data-package-checkpoint.mts
```

The script requires the build marker's preview channel. Evidence from the passed run is retained under `.tmp/data-checkpoint/run-kEkIn3/`: `report.json`, `published-preview.json`, individual platform/scenario reports and `source-fingerprints.json`. The full suite was rerun: 218 files / 1,331 tests passed. Type checks, desktop/web builds, bundle/UI-asset validation and verification-script lint/formatting also passed.

This verifies the local built Windows application and locally served website. It does not claim an installed production Windows release or a production website rollout. Browser metadata recovery still requires the application shell to be available. Source remains dirty/uncommitted at `cf2076b45c8795018f33044bf7eedc2a38dcbf37`; application `main` and production data were not changed by this check.
