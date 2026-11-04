# Iteration 6 data foundation

This document records the source-of-truth decisions behind the new granular operator metadata.

## Subclass / branch

- Canonical identity is the game-data `subProfessionId` from `character_table.json` / `char_patch_table.json`.
- Subclass choices are ordered by original CN debut, using the earliest confirmed operator release in the full dataset. Same-day branches, including launch branches, are alphabetical; unknown dates sort last. Filtering out an operator does not change its subclass's original debut order.
- The upstream EN `uniequip_data.json` currently contains untranslated `subProfessionName` values, so it is not used as the user-facing English label source.
- `src/shared/operatorMetadata.ts` maintains the English label map for the current 72 playable branches.
- Newly introduced branches use the source-provided label from `uniequip_data.json` (EN, then CN) until an English label is maintained locally. If neither source has a label, the stable branch ID is shown. Validation reports a warning for new branches without blocking the operator update; missing IDs/names and incorrect labels for maintained branches remain errors.

## Garrison event representatives

- Event helpers use the full regional operator dataset and fixed default E0 avatars.
- Limited events take their representative from the matching regional banner's `limitParam.limitedCharId`, supporting both a single ID and an array. Other events use their debut 6★, with limited operators taking priority over simultaneous Standard releases.
- Release dates come from published operator availability dates, mapped event opening dates and debut banner schedules. Every member of a release group receives the actual release day. Commit dates, asset preload dates and `releasever` values are never used as release dates.
- CN availability dates are read from the PRTS `char_obtain.cnOnlineTime` table, matched to canonical character IDs through their CN names. Missing dates remain unknown with a warning; they do not remove an obtainable operator. Data normalization has its own revision so corrected dates rebuild an existing cache even when upstream commits are unchanged.

## Faction

Character records expose `nationId`, `groupId`, `teamId`, and a `mainPower` object.

- `mainPower` is authoritative for the canonical main faction; the most-specific populated level is used (`teamId`, then `groupId`, then `nationId`).
- `affiliations` preserves every populated nation/group/team ID and includes the canonical main faction.
- Display labels come from `handbook_team_table.json`.
- CN and EN handbook catalogs are merged because CN can contain factions for operators not yet available globally. EN entries override matching CN entries so localized Global labels are preferred when available.

## Kernel era cutoff

Kernel-era is a release-date classification, not literal Kernel Headhunting membership. It applies equally to Standard, Limited, collaboration, and Welfare operators.

Current maintained inclusive cutoffs:

- EN / Global: `2023-03-14` — Dorothy / Dorothy's Vision release boundary, following the October 9, 2026 Kernel expansion. The [official October event notice](https://www.arknights.global/news/4814) confirms Dorothy and Goldenglow in Kernel Locating.
- CN: `2022-07-05` — Dorothy / Dorothy's Vision release boundary in the current migrated Kernel range.

Operators released on the cutoff date are `kernel`; operators released after it are `postKernel`.

Verified on October 30, 2026. CN remains at the existing Dorothy boundary. These are era cutoffs rather than exact banner rosters: Global's different release order can place operators from other banners within the same era.

The selected metadata region will choose the corresponding release date and cutoff when the Iteration 6 eligibility layer is implemented.
