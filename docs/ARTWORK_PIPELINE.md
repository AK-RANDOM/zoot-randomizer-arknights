# Shared operator artwork handling

M5 consolidates individual requests, manual bulk downloading and developer artwork commands. Metadata stays on the M4 prepared-package path. The operator imagery provider remains `yuanyan3060/ArknightsGameResource`; `artworkSources.ts` selects an exact revision independently from metadata. Account synchronization/profile avatars and bundled UI icons remain separate integrations.

## Inventory and identities

`artwork.ts` enumerates normal avatars, E1/E2 portraits, default appearance avatars, outfit portraits and outfit avatars. A source key contains repository, exact artwork revision, source directory and filename. All references to that same source share one cache/download operation, including Medic Amiya's existing filename override. Legacy filenames and promotion fallbacks remain supported.

`artworkInventory.ts` creates an `artwork-inventory.json` with its own identity, policy version, source revision, references and metadata-package linkage. The metadata-package ID is excluded from artwork identity; generated timestamps and unrelated metadata revisions do not change it. Changing only `artworkSources.ts` does not change the metadata build selection. Build preparation writes the inventory and artwork identity beside the metadata/build markers; web outputs also include `artwork-revision.txt`.

The selected source revision is a download target, not proof of the origin of older cached files. Legacy caches have no trustworthy source stamp. Valid legacy PNGs are retained as an offline fallback rather than relabelled as verified bytes from that revision. New downloads use the pinned URL and source-keyed cache.

## One download/cache policy

`ArtworkCache` serves native individual and bulk requests. The shared downloader bounds responses to 24 MiB, checks complete PNG chunk structure and CRCs, retries transient/invalid responses up to three times, and distinguishes unavailable HTTP 404/410 responses from failures. It writes a unique temporary file, flushes/closes it and renames it only after validation and a cancellation check. Failed writes/downloads leave existing valid images available.

Concurrent requests for the same source share a job. Cancellation removes only the requesting subscriber; an on-screen request can finish while a bulk subscriber cancels. Bulk downloading uses at most six jobs at once and reports completed, downloaded, reused, unavailable and failed counts. Resume checks saved files before downloading. The memory cache is bounded separately from the durable disk cache.

New downloaded files live under `operator-data/shared-artwork/<source-key-hash>.png`. Existing `images`, `portraits`, `appearance-avatars`, `skin-portraits` and `skin-avatars` folders are consulted without moving, overwriting or deleting their files. Cached fallback portraits are checked before attempting a network request. Browsers keep their existing browser-managed image loading/cache behavior, using the same pinned source and filename rules; browser bulk/offline artwork storage is not introduced.

Full downloads run only when explicitly requested. Clearing artwork removes the five old artwork categories and the new shared category, after application-level active-download/display guards; metadata, preferences, account snapshots, Rulebooks and saved Garrisons stay outside that deletion boundary. Windows packaging excludes all operator image categories.

## Developer commands

```powershell
npm run data:artwork
npm run data:images
npm run data:portraits
node --experimental-transform-types scripts/download-artwork.mts --cache .tmp/artwork --kind avatar
```

These commands read the prepared bundle and use the same cache/downloader. They never rebuild metadata. The old portrait script is a compatibility entry point with no separate download implementation. The legacy metadata producer retains only metadata/UI-icon work for audits; its former avatar downloader is retired.

## Verification boundary

Automated checks cover source-identity deduplication, legacy/Amiya aliases, PNG corruption/truncation, missing assets versus failures, concurrent individual/bulk calls, subscriber cancellation, bulk cancellation/resume, disk-write failure and cache reuse after restart. The existing metadata/data-reader checks remain separate. Release validation and production promotion are M6 work; M5 alone does not publish application source or advance production data.
