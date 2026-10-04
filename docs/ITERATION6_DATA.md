# Iteration 6 data foundation

This document records the source-of-truth decisions behind the new granular operator metadata.

## Subclass / branch

- Canonical identity is the game-data `subProfessionId` from `character_table.json` / `char_patch_table.json`.
- The upstream EN `uniequip_data.json` currently contains untranslated `subProfessionName` values, so it is not used as the user-facing English label source.
- `src/shared/operatorMetadata.ts` maintains the English label map for the current 72 playable branches.
- Dataset validation rejects an unknown `subProfessionId`, forcing newly introduced branches to be named deliberately instead of silently exposing an internal ID.

## Faction

Character records expose `nationId`, `groupId`, `teamId`, and a `mainPower` object.

- `mainPower` is authoritative for the canonical main faction; the most-specific populated level is used (`teamId`, then `groupId`, then `nationId`).
- `affiliations` preserves every populated nation/group/team ID and includes the canonical main faction.
- Display labels come from `handbook_team_table.json`.
- CN and EN handbook catalogs are merged because CN can contain factions for operators not yet available globally. EN entries override matching CN entries so localized Global labels are preferred when available.

## Kernel era cutoff

Kernel-era is a release-date classification, not literal Kernel Headhunting membership. It applies equally to Standard, Limited, collaboration, and Welfare operators.

Current maintained inclusive cutoffs:

- EN / Global: `2022-06-30` — Gnosis / Break the Ice release boundary; Gnosis is the newest 6-star in the June 30, 2026 Celebration - Kernel pool.
- CN: `2022-07-05` — Dorothy / Dorothy's Vision release boundary in the current migrated Kernel range.

Operators released on the cutoff date are `kernel`; operators released after it are `postKernel`.

The selected metadata region will choose the corresponding release date and cutoff when the Iteration 6 eligibility layer is implemented.
