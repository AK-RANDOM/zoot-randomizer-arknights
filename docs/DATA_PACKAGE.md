# Prepared data package contract

This contract distributes one validated data snapshot to Windows and the website. M1 defined the format, M2 implemented the producer, M3 implemented immutable publication/build selection, and M4 connected the application readers. The changes are locally implemented and validated; application source has not landed on `main`. The owning architecture workboard is [#45](https://github.com/AK-RANDOM/zoot-randomizer-arknights/issues/45). The measured baseline and reproduction commands are in [DATA_BASELINE.md](DATA_BASELINE.md).

The combined producer and frozen-rebuild commands are described in [DATA_PACKAGE_PRODUCER.md](DATA_PACKAGE_PRODUCER.md). [DATA_PACKAGE_DELIVERY.md](DATA_PACKAGE_DELIVERY.md) covers publication/build selection and [DATA_PACKAGE_READERS.md](DATA_PACKAGE_READERS.md) covers activation, migration and recovery.

## Package contents

A package contains a manifest, one operator dataset and ten Garrison catalogs: CN and Global metadata regions, each with EN, JP, KR, TW and CN display languages. The regions determine available content; a display language never adds events, stages or operators from another region.

```text
manifest.json
operators.json
garrison/cn-en.json
garrison/cn-jp.json
garrison/cn-kr.json
garrison/cn-tw.json
garrison/cn-cn.json
garrison/global-en.json
garrison/global-jp.json
garrison/global-kr.json
garrison/global-tw.json
garrison/global-cn.json
```

`operators.json` retains the existing schema-v6 `OperatorDataset`, including release events, all localizations, skin/default-art identities, factions, race/gender data, acquisition metadata and availability. The package envelope does not itself require an operator-schema migration. Operator release events and Garrison event/stage catalogs remain distinct models.

Each Garrison file has `schemaVersion: 1`, `region`, `locale` and `events`. Events retain the existing `GarrisonEvent` fields and gain `helperOperatorId: string | null`, resolved using the full regional roster in this package. Event order, stage-group membership and stage-code order are significant. The current catalog stores stage codes, not native stage IDs; format v1 preserves those codes and does not invent native identities or change saved Garrison stage IDs.

The derived helper uses the current chapter/explicit-event overrides, regional banner priority and debut-date fallback. It is independent of user filters and selected cosmetic appearance. A null representative remains null. Rerun deduplication and original-event identity remain governed by the existing catalog functions.

## Manifest format v1

The following is a structural example. Bracketed values stand for real values produced at generation time; this is not an installable manifest.

```json
{
  "packageFormatVersion": 1,
  "packageId": "sha256:<identity hash>",
  "generatedAt": "<ISO UTC timestamp>",
  "compatibility": {
    "minimumReaderVersion": 1,
    "operatorDatasetSchemaVersion": 6,
    "garrisonCatalogSchemaVersion": 1
  },
  "normalization": {
    "operatorPipelineVersion": 10,
    "skinMetadataVersion": 5,
    "garrisonNormalizationVersion": 1,
    "producerSourceSha256": "<hash of producer source inventory>",
    "correctionsSha256": "<hash of maintained corrections>"
  },
  "sources": {
    "gamedata": {
      "repository": "ArknightsAssets/ArknightsGamedata",
      "commit": "<full commit SHA>"
    },
    "releaseMetadata": {
      "repository": "nadering/arknights-toolbox",
      "commit": "<full commit SHA>"
    },
    "publishedCnDates": {
      "endpoint": "https://prts.wiki/api.php",
      "inputSha256": "<hash of the captured query input and paginated responses>"
    }
  },
  "files": [
    {
      "path": "operators.json",
      "kind": "operators",
      "schemaVersion": 6,
      "bytes": 0,
      "sha256": "<SHA-256 of exact uncompressed file bytes>"
    },
    {
      "path": "garrison/global-en.json",
      "kind": "garrison",
      "region": "global",
      "locale": "en",
      "schemaVersion": 1,
      "bytes": 0,
      "sha256": "<SHA-256 of exact uncompressed file bytes>"
    }
  ]
}
```

The complete `files` list has all eleven payloads exactly once. `minimumReaderVersion` is the package reader's protocol revision, not `package.json`'s application version. Garrison normalization starts at 1 for this package producer; it is independent of the existing runtime cache version 14. The existing operator pipeline and skin revisions are preserved and advance when their normalization changes.

Producer source inventory hashes identify the exact code and configuration used. Corrections include maintained release dates, acquisition/limited-series and Kernel membership, collaborations, label maps, race overrides and Garrison helper/identity rules. Their supporting references and precedence belong to the producer, rather than being repeated in each reader.

## Identity and repeatability

Each payload is deterministic UTF-8 JSON with LF line endings, a trailing newline and recursively sorted object keys. Preserve every array's order. File byte counts and hashes apply after HTTP decompression, irrespective of optional transport/archive compression.

Object serialization uses JavaScript JSON enumeration: integer-index keys are numeric ascending; other keys are sorted by UTF-16 code units. Two-space indentation and standard `JSON.stringify` primitive escaping are used. There is no locale-dependent object-key sort. Reusing an identical previous input snapshot retains its first observation timestamp, so an unchanged live check cannot create a package solely by advancing the clock.

Compute the package identity from canonical JSON containing `packageFormatVersion`, `compatibility`, `normalization`, `sources` and the complete `files` list sorted by path. Exclude `packageId`, generation/capture timestamps, hosting locations and channel pointers. Payload generation timestamps are fixed from the captured input snapshot, not recomputed for each replay. Rebuilding the same captured inputs with the same producer therefore produces identical payload hashes and package identity.

Capture and retain the actual PRTS query and every response page. Its content hash identifies that input; GitHub commit timestamps and asset preload versions cannot replace published availability dates. A producer source check must revisit PRTS even when the GitHub heads are unchanged. Original capture times remain available in the producer's evidence archive outside the content identity.

## Producer and reader rules

1. Resolve one game-data revision and one release-metadata revision, then fetch every required table at those exact commits. Reuse overlapping inputs for operator metadata and Garrison catalogs.
2. Build all eleven outputs using existing normalization and localization rules. An absent translated string may use the current language fallback; a failed table request must not be disguised as a successfully generated empty table.
3. Validate required fields, unique identities, regional availability, release metadata, stage groups/order and representatives. A temporary source outage must not erase previously confirmed values. Incomplete required inputs block a new publication and leave the previous package available.
4. Publish immutable package contents, then advance a channel pointer only after validation. Preview and production pointers are separate. Readers follow a compatible package identifier, not moving upstream branch URLs.
5. Readers validate supported envelope/payload versions, the exact required file set, safe relative paths, byte counts, checksums and payload content before activating the complete package. Partial download, incompatibility or validation failure retains the previous installed package; bundled data remains the initial fallback.
6. The website and Windows release embed the same selected package identifier and checksums. A release records both application commit and data package identity. Data freshness and package compatibility remain separate checks.

Package format v1 does not add automatic background updates or change saved preferences, Rulebooks, presets, Garrisons or imported account snapshots. Existing installations need an app version containing the new reader before they can use this format. The new reader preserves newer legacy metadata as a labelled bridge until a complete compatible package replaces it; old cache files remain read-only.

## Artwork boundary

Image binaries, bulk artwork downloads and artwork-cache statistics are outside this metadata package. Native avatar/portrait/skin references remain in operator metadata because they determine available appearances. A metadata update must not wait for image downloads.

Artwork uses a separate version/inventory describing its providers, source revisions and asset identities. An image-only repository change must not change the metadata package identity or trigger a full operator rebuild. Missing artwork retains existing placeholders and on-demand/bulk download controls. UI icons may be prepared separately for application builds without becoming an upstream operator-data freshness dependency.

## Comparison gate

M1 captures the current normalized roster, its resolved display values in five languages, and all ten Garrison catalogs with resolved helpers. The comparison ignores only dataset provenance fields (`generatedAt`, `sources`, `dataPipelineVersion`, `skinMetadataVersion`); it checks every remaining field, including schema, optional fields, array order and localized strings. Input revisions, code hashes and excluded provenance are still recorded in the evidence report.

M2 must replay the captured inputs through the current producer and the replacement producer, compare both against the rebuilt M1 baseline, and explicitly account for every intended difference. Comparing changing live upstream inputs is not a behavior-preservation test. This gate preserves the Garrison behavior established in [#90](https://github.com/AK-RANDOM/zoot-randomizer-arknights/issues/90) and artwork controls established in [#96](https://github.com/AK-RANDOM/zoot-randomizer-arknights/issues/96).
