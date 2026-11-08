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

## Standard acquisition groups

The selected metadata region determines which Kernel roster applies. Standard 5★ and 6★ operators in that roster appear under Kernel, and the rest appear under Post-Kernel. Standard operators of lower rarity have their own toggle.

As of November 7, 2026, CN and Global share the same 5★ and 6★ Kernel roster through the Dorothy migration. The app tracks membership by operator ID so Global's release order and missing release dates do not affect the split. [Global Kernel update](https://www.arknights.global/news/4814), [CN migration notice](https://ak.hypergryph.com/news/6252)
