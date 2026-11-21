# Prepared data delivery

M3 publishes immutable data versions separately from application source. The initial preview feed is on the generated-artifact branch [codex/data-packages](https://github.com/AK-RANDOM/zoot-randomizer-arknights/tree/codex/data-packages), seeded by commit `881d4e45900c3719965d1e59e4703651c42e49de`. Production has not been advanced.

## Build selection

`src/shared/dataPackagePin.ts` selects an exact package ID, decoded artifact checksum/size and source-snapshot checksum. `npm run data:update` now installs this selection through `scripts/install-data-package.mts`; it never resolves live game-data tables or the current update channel. The legacy producer CLI is explicitly available as `data:legacy:update` for development.

The Windows workflows, repository Pages workflow and root website all use that preparation command. The root website's existing workflow checks out application `main` and calls `data:update`, so it inherits the same pin without a separate source or workflow change. A clean rebuild of an older application commit retains its source-controlled data selection.

UI icon preparation remains separate from metadata generation. Class/subclass/faction assets are checked/downloaded after the selected package is validated. Complete operator artwork remains on-demand or manually downloaded; metadata installation does not acquire it.

Build preparation writes a complete `resources/bundled-data/data-package.json`, its legacy operator export and `data-package-build.json`. The latter records application commit, dirty-source status, package ID, checksum and selected runtime channel. Clean `main` builds use production; dev, dirty and other builds use preview. `AKR_DATA_CHANNEL` provides an explicit build override.

The website copies the same package and provenance, and emits `source-revision.txt` and `data-package-revision.txt`. Both website URLs inherit these markers. Windows packaging includes the same files under bundled resources. Replacing the package pin is a source change reviewed with the corresponding application release.

## Immutable feed and independent channels

```text
packages/<package digest>/package.json.gz
packages/<package digest>/snapshot.json
channels/preview.json
channels/production.json
```

The gzip artifact contains the manifest and all eleven payload strings. Its decoded contents are still checked against the manifest's per-file hashes and package identity. Transport compression is separate from data identity; an already published version is retained rather than recompressed or overwritten. Snapshot descriptors are producer evidence; clients do not download raw game-table bodies.

The preview and production pointers identify an exact version, encoded/decoded sizes and checksums, reader compatibility, input sources and publication time. Publishers validate the complete artifact before atomically replacing a pointer. Previous immutable versions remain available; rollback advances a channel to one of those existing validated versions.

Production publication requires confirmation of the exact package ID. The production workflow also requires dispatch from application `main`. Publishing application source to `main` and production deployment still require explicit user approval.

## Commands and workflows

Stage a preview publication locally:

```powershell
npm.cmd run data:publish -- --prepared .tmp/data-package/m2-validated --store .tmp/data-feed --channel preview --expect-package sha256:c15265d204534093006addb9509c7fb46c2fe4268a606aee7e1e4e94a6a6520f
```

Install from a local store without network access:

```powershell
node --experimental-transform-types scripts/install-data-package.mts --store .tmp/data-feed
```

The manual **Prepare reviewed data package** workflow creates a producer artifact and build report using captured previous inputs for timestamp stability. The separate **Publish reviewed data package** workflow consumes the reviewed run and exact package ID, validates it, then commits immutable files and the chosen channel together on the data branch. Git's fast-forward push protects the remote publication from competing writers. No workflow was dispatched during this local implementation.

`publish-data-package.mts --rollback <package ID> --store <feed> --channel <channel>` selects an existing stored version. Production also needs `--confirm-production <same package ID>`. The script only stages the requested store; uploading/committing it is a separate step.

## M3 verification

The selected package remains `sha256:c15265d204534093006addb9509c7fb46c2fe4268a606aee7e1e4e94a6a6520f`. The complete compressed artifact is 294,802 bytes and decodes to 2,040,330 bytes; its eleven payloads total 1,797,270 bytes. The public preview URL returned HTTP 200 with browser CORS enabled, and the build installer verified its pinned checksum after downloading it.

Publication tests cover independent channels, rollback, previous-version retention, rejection of failed/corrupt candidates, immutable-version protection and competing publishers. Bundling tests cover exact selection, offline cache use, provenance and retention of existing bundled files after a rejected replacement. All 216 test files / 1,317 tests passed at the M3 checkpoint, along with type checks, touched-file lint and desktop/web builds. Application `main` remained at `a2e47b8c435226b3568f0c73f0ebeef8d2bf0267` and no production pointer was created.
