# Phase 2K-B — Authoritative battle skill data foundation

Branch: `phase-2k-b-authoritative-skill-data`. No commit or push.

## Source inspection and discrepancies

Primary source: supplied **DW2 Modding Info.xlsx**, SHA-256
`38869acaa3908eb9b9dc0d9b46f32a6421af5e0d5c3a8e632983d26a7699e494`.
Interpretation source: supplied **Mecânicas de batalha de Digimon World 2 — documento-base para implementação.md**, SHA-256
`9e3cfce3b9b66b35a24d865af569197eb975b7aa550a2da47c9147d0cba79c5a`.
These documents were treated as evidence; the implementation scope comes from the user's Phase 2K-B request.

The workbook has 18 sheets. WAZADATA occupies the formatted extent `A1:BP1001` (68 columns). Row 1 contains grouped field headings; row 2 is the **decimal byte-number ruler**, not a record. Rows 3–475 contain 217 label rows and 256 complete 68-byte records. The remaining 526 rows are empty. Every record is preserved, including 39 unnamed records. The initial inspection count of 257 mistakenly included the ruler; the importer explicitly excludes it.

Skill Effects has formatted extent `A1:Z99`. Its actual table is `A1:C91`: headers `Row`, `Value`, `Effect`, followed by 90 dictionary entries. Only these three columns contain values. Numeric-looking flag values such as `10`, `20`, `40`, `80` are hexadecimal tokens, even when stored as numeric Excel cells. The mechanics document's explicit hex tables corroborate this. Composite entries `17:03` and `29:07` describe OR combinations, not extra effects. `23:0C` is a conjunction with its own confirmed interpretation.

Important discrepancies and gaps are preserved rather than silently reconciled:

| Finding | Treatment |
|---|---|
| Request/document list byte 1 as the ID, but records exceed 255 | Preserve bytes 1–2 and use their little-endian word for identity. Full IDs are unique; using byte 1 alone collides for 45 values. |
| Unnamed row 423, following ID FF, contains ID `0000`, not `0100` | Preserve ID 0. Do not repair it to 256 or invent an item name. IDs are not assumed contiguous. Maximum ID is 301. |
| Document maps elements 0–5; Fantasmic Bomb and Fantasmic Ray contain byte4 `36` | Rank Mega, element null, explicit unknown-value issue. |
| Document lists target modes 01/02/04; 30 records contain 00 and Necro Magic contains 08 | Preserve/report all 31 occurrences. Zero is not silently treated as normal; 08 is also an unknown effect bit. |
| 15 records have high-bit AP words, including FFFF and FF6A | Preserve the unsigned word and bytes. Canonical `attackPower` is null with an issue because neither supplied source specifies signed healing/sentinel semantics. Do not interpret these as enormous offensive AP or guess a signed formula. Five identified techniques are affected: HP Recovery, Full HP Cure, Small HP Cure, Mega Heal, Full Recovery. |
| Workbook label order is reversed for A3, C3, C4 and DD | Explicit identity-only annotations resolve Giga Scissor Claw, Blaze Blaster, Nature Hit Ray and Blind Attack. No mechanical rule uses these IDs or names. |
| Four rows say `abc? Unused?` (DF/E0/E6/EC), E9 says `Energy Blast (?)`, EA says `Alias Fake (?)` | Preserve all six tentative labels, exclude them from unambiguous name lookup. Do not merge E9 with Energy Blast 1B. |
| Technique C8 `AntiDote` and item 0103 `Antidote` collide after normalization | Keep separate numeric identities. Technique-name lookup excludes the original item/system records; ID lookup retains both. |
| Hydro Blaster byte4 is `01` | Canonical rank Rookie and element Fire. Existing Planner learn-rank metadata says Champion; it remains unchanged because Planner integration is out of scope. The old simulator's Water element is corrected in its data projection. |
| Sheet marks `17:04` potentially defunct; document summarizes it as cannot-miss | Preserve a cannot-miss descriptor with uncertain certainty, not an unconditional promise. |
| `31:20` says interrupt prevention is broken | Keep that caveat on the turn-protection descriptor. |
| Isolated `23:04` and `23:08` have uncertain reset scope | Keep unresolved descriptors for Parameter Patch, Zen Recovery, Re-Format and Re-Initialize. Only a complete 0C conjunction becomes reset-all. |
| SubZero Ice Punch `18:10` documents +5 internal units, cap 70 | Store +2.5 displayed AP and documented cap 35, with total-versus-bonus cap interpretation unresolved. Existing engine's +25 bonus cap is not validated by these sources and remains a legacy limitation. |
| Shadow Scythe 4D has only deprecated `21:01` and normal target `33:01` | No documented chain-on-kill flag. Remove the unsupported compatibility descriptor; leave the engine's generic chain-resolution code untouched. The separate FB record is not merged with 4D. |

No signed AP, unknown element, uncertain identity, isolated reset scope, missing damage amount, timing or status-resolution behavior was guessed. Canonical identity resolution does not imply every field is ready for an exact simulation.

## Record fields and canonical model

All 68 raw bytes survive normalization and `exportWazaBytes`, including fields outside this phase:

| Source columns / bytes | Preserved interpretation |
|---|---|
| A:B / 1–2 | Raw ID bytes and full numeric ID |
| C / 3 | Action kind, animation kind, target group; unknown nibbles remain null |
| D / 4 | Independent rank and element |
| E / 5 | MP cost, including zero; no consumption |
| F:H / 6–8 | Audio/raw fields |
| I:J / 9–10 | Little-endian AP word, normalized once to displayed half-point units where interpretable |
| K:L / 11–12 | Raw unknown fields |
| M:P / 13–16 | Text-popup/raw fields |
| Q:AG / 17–33 | Strongly typed `EffectFlags`, including every unknown bit |
| AH:AJ / 34–36 | Raw unknown fields |
| AK:AN / 37–40 | Name pointer bytes |
| AO:AR / 41–44 | Description pointer bytes |
| AS:BH / 45–60 | Launch particle bytes |
| BI:BP / 61–68 | Impact bytes |

Name text comes from the workbook's adjacent label rows, not guessed ROM pointer dereferencing. The workbook does not provide a corresponding per-record description-string table here, so description pointers are retained without invented descriptions. Labels and descriptions never determine effects.

`BattleSkillDefinition` contains stable numeric `id`, nullable `name`, `recordKind`, independent nullable `actionKind` / `animationKind` / `targetGroup`, `targetModes[]`, independent `rank` / `element`, `mpCost`, displayed `attackPower`, `attackPowerRaw`, `effectFlags`, discriminated `effects[]`, explicit `issues[]`, and `provenance` (sheet row, exact source label, all 68 bytes). Optional `timing.singleFrames` / `multiFrames` is absent for every imported record; unknown timing is never zero.

Byte3 high nibble: 0 self, 1 one ally, 2 all allies, 5 one enemy, 6 all enemies, 8 field, 9 interrupt target. Low nibble: 0/1/2 Attack projectile/magic/physical; 4/5/6 Counter; 8/9/A Interrupt; C/D Assist projectile/magic. No physical-Assist mapping is invented. Byte4 high nibble maps 0/1/2/3 to Rookie/Champion/Ultimate/Mega; low nibble maps 0–5 to Water/Fire/Nature/Machine/Darkness/Neutral.

`normalizeWazaRecord` and `decodeEffectFlags` are pure. All known single-bit rules are independent; byte23 reset-all explicitly requires both bits. Byte33 combines known bit descriptors with issues for undocumented values/combinations. Every descriptor includes byte/mask and, where documented, its Skill Effects row and exact label. Unknown bits get unresolved descriptors. Deprecated flags stay visible without acquiring invented gameplay semantics.

The union distinguishes status application/cure, Poison Body, parameter modifiers/reset/transfer, temporary attack powers, special states, recovery/restrictions, action protection, accuracy, initiative, damage modifiers/rules/drain, consecutive power, Counter payment, Interrupt modification and target modes. Source `stun` is an alias for internal `paralysis`, including cures and powers. Temporary attack powers never become ailments on their possessor.

Counter descriptors cover protection, returned-damage 1.5×, Counter damage 1.5×, evasion modifier without a guessed magnitude, guaranteed conditional Poison/Paralysis/Confusion, miss-unless-triggered, enemy MP payment and all-on-Counter target mode. Interrupt descriptors cover protection, guaranteed conditional paralysis, cancellation at 87.5% excluding bosses, target-action damage reductions 70.3125% and 39.84375%, forced miss at 66%, and target action last. No scheduler or effect resolver consumes these new descriptors in this phase.

## Coverage

Machine-readable details, including every unresolved occurrence, source location and named Assist: [coverage.json](coverage.json). Regenerate with `node scripts/checkBattleSkills.cjs --write-report`; validate the reviewed output with `node scripts/checkBattleSkills.cjs`.

There are **256 records**, **217 labeled records**, **201 unambiguous technique records**, **48 original item/system records**, and **7 unresolved records** (six tentative labels plus unnamed ID 0). Of the 201 techniques, **191 have fully decoded basic fields**. This does not assert complete semantic certainty or simulator support.

| Count | All 256 records | 201 identified techniques |
|---|---:|---:|
| Attack | 190 | 137 |
| Counter | 14 | 14 |
| Interrupt | 9 | 9 |
| Assist | 43 | 41 |
| Projectile | 152 | 101 |
| Magic | 59 | 57 |
| Physical | 45 | 43 |
| Self | 8 | 6 |
| One ally | 42 | 23 |
| All allies | 12 | 4 |
| One enemy | 116 | 108 |
| All enemies | 52 | 46 |
| Field | 17 | 5 |
| Interrupt target | 9 | 9 |
| Rookie | 81 | 32 |
| Champion | 68 | 68 |
| Ultimate | 52 | 52 |
| Mega | 55 | 49 |
| Water | 16 | 13 |
| Fire | 20 | 18 |
| Nature | 27 | 25 |
| Machine | 35 | 31 |
| Darkness | 16 | 13 |
| Neutral | 140 | 99 |
| Unknown element | 2 | 2 |
| Status-inflicting | 17 | 17 |
| Status-curing | 11 | 6 |
| Parameter modifiers | 18 | 18 |
| Confirmed parameter resets | 1 | 1 |
| Temporary powers | 9 | 9 |
| Special states / recovery / restrictions | 13 | 9 |

Identified Assists: **41 (38 magic, 3 projectile, 0 physical)**. The all-record count additionally includes two tentative magic Assist records. Categories count records containing at least one matching descriptor, not flag occurrences.

- Unknown byte3 values: **0**.
- Unknown byte4 values: **one distinct value (36), two records**, IDs F1 and F4.
- Unknown byte33 values: **00 in 30 records, 08 in one record**. Every ID is listed in coverage.json.
- Unknown effect bits: **three occurrences / three byte-mask pairs**: Black Pearl Shot 3D, `31:04`; Pummel Whack 89, `22:01`; Necro Magic D2, `33:08`.
- Source-listed unknown `26:40` is supported as an unresolved descriptor, but absent in these records.
- Documented uncertain reset bits: **four occurrences**. Deprecated flag occurrences are listed separately: `21:01` (175), `21:80` (1), `23:01` (1), `23:02` (1), `32:01` (2), `32:10` (1), `32:40` (1).
- Planner canonical identities: **179 resolved / 179**, **zero unresolved**. The earlier progress note's 177 was an intermediate reporting error; the verified normalized count is 179.
- Encounter labels: **195 resolved / 196**. Occurrences: **672 resolved / 673**. Sole unresolved label: **Alias Fake**, encounter **149**, slot **1**, source tentative identity EA.
- Legacy simulator compatibility remains intentionally smaller: **138 technique entries**; **61 resolved encounter labels** lack a legacy projection. They are listed in coverage.json and rejected at the encounter input boundary, not converted into fake attacks. Planner's legacy-lookup diagnostics now report **43** unresolved Planner labels; the canonical catalog resolves all 179.

Reused reviewed aliases: Blaze Blaster ↔ Blaze Buster, FLer Cannon → Flower Cannon, Ninja FLer → Ninja Flower. New explicit spelling alias: **Destabilizer Ray → Destablizer Ray** (WAZADATA F9, row 412). Existing conservative punctuation/case normalization handles Trihorn Attack/Tri-Horn Attack, SubzeroIcePunch/SubZero Ice Punch, and other spacing variants. No fuzzy matching and no alias from Alias Fake to a tentative record.

## Compatibility and manual-case audit

`Tech`, `TECHS`, `specialEffect` and `isCounter` remain available. `legacyTechIdentities.ts` stores only the 138 historical IDs/display names and their WAZADATA IDs. All mechanics are derived via `toLegacyTech`; the independently maintained `techs.ts` database was replaced. The unused, unreferenced `tech_data.csv` was removed to avoid another apparent mechanics authority.

| Existing manual case | Authoritative evidence | Compatibility treatment / limitation |
|---|---|---|
| Beast King Fist | `18:01` returned damage 1.5× | Project existing counterDamageMultiplier |
| SubZero Ice Punch | `18:10`, +5 internal = +2.5 displayed AP | Project increment; retain existing engine cap pending later resolution work |
| Twig Tap | `19:08`, steal HP | Project healOnDamage; exact drain ratio is unspecified in source and existing full-damage healing is not newly validated |
| Shadow Scythe | No chain flag; `21:01` is deprecated | Remove chain descriptor; no new identity-based exception |
| Howling Crusher | `17:01` | Project noTriggerCounter |
| Smiley Bomb, Ninja Knife Throw | `18:20` | Project existing Counter AP multiplier; authoritative descriptor says damage multiplier, so integer rounding/order remains a legacy approximation |
| Smiley Warhead | `18:20` plus `33:04` | Project multiplier and Counter-all target |
| Meteor Stream, Energetic Bomb | `33:04` | Project Counter-all target |
| Coral Crusher, Evil Wind | `22:40` | SPD-down descriptor; legacy stack cap remains the engine default |
| Scissor Claw, Duo Scissor Claw | `22:10` | DEF-down descriptor; same limitation |
| Pulse Blast, Tidal Wave | `22:04` | ATK-down descriptor; same limitation |

[legacy-data-changes.json](legacy-data-changes.json) records every before/after field difference for 22 entries (including six removal-only `maxStacks: 2` differences whose engine default is unchanged). Changes include source-proven targets/elements, no-Counter flags on Giga Cannon/Chaos Cannon, standardized Darkness→Dark projection, Wave→Water correction, and removal of Shadow Scythe's unsupported descriptor. **No AP values changed for the original 138 entries.**

The adapter is intentionally lossy: it can expose only one existing specialEffect and Single/All targets. Ally/field/Interrupt semantics remain explicit in the canonical model; their full resolution is deferred. Existing MP omission, RNG, damage formula, drain quantities, parameter stack limits, Counter scheduling and timing estimates are not claimed authoritative.

`requireEncounterTechs` rejects unknown labels, unsupported legacy techniques and empty encounter technique lists. The existing UI catches these asynchronous errors and clears its busy state; a regression test verifies that failed input never produces simulation results. This is error handling for the new validation boundary, not a new simulator flow. The old fallback for manually supplied teams with no damaging techniques remains an explicitly legacy engine behavior; it is not canonical skill data and cannot be reached through unresolved/empty encounter labels.

## Validation and verification

The importer uses Python's standard ZIP/XML libraries, not Excel or a runtime workbook dependency. It validates the byte ruler, complete 68-byte records, label binding and dictionary structure. `--check` compares every generated byte, label, effect entry and workbook hash against the reviewed source. Runtime self-checks also use a deterministic fingerprint, structural validation, unique IDs/names, AP/MP checks, known nibble checks, combined-bit checks, aliases and reviewed coverage. A change to the authoritative extract fails loudly until reimported and reviewed.

The focused tests cover all requested categories, synthetic combinations/modded records, independent unknown nibbles, high-byte IDs/AP, unknown-bit round trips across all 17 effect bytes, composite dictionary entries, cures vs parameter reset, all temporary powers, states, Counter/Interrupt descriptors, name conservatism, encounter rejection, compatibility and asynchronous UI recovery.

Existing test updates are limited to three audit expectations:

1. `runDataSelfChecks` count **46 → 57**: eleven new battle-data checks, all original checks retained.
2. Phase 2F unresolved legacy Planner-label count **45 → 43**: reviewed Flower Cannon/Ninja Flower aliases now reach the legacy lookup.
3. Phase 2G-B unresolved legacy count/name **45 → 43**, for the same reason. Planner ranks, learning, progression and capture behavior are unchanged.

No existing battle damage/scheduling test expectation was changed.

Final verification:

| Check | Result |
|---|---|
| All existing tests plus new battle-data tests | **796 / 796 passed**, no failures, skips or cancellations |
| New battle-data tests (included above) | **88 / 88 passed** |
| Run Planner, hardening, rank-learning, route-export and theme tests | All passed in the complete run |
| Data self-checks | **57 / 57 passed**, including **11 / 11** battle-data checks |
| Reviewed coverage report | `node scripts/checkBattleSkills.cjs` passed |
| Workbook re-extraction comparison | Importer's `--check` passed against the supplied workbook |
| App TypeScript | `npx tsc --noEmit -p tsconfig.app.json` passed |
| Node TypeScript | `npx tsc --noEmit -p tsconfig.node.json` passed |
| Production build | `npm run build` passed; 1,825 modules transformed |
| Lint | **7 errors / 7 warnings**, matching the historical baseline; no new findings |
| Whitespace / diff | `git diff --check` passed; new files also checked separately |

The first build attempt failed because esbuild could not access a parent directory under the filesystem sandbox. Repeating the same build with approved filesystem access succeeded. The successful build retains the existing Browserslist-data and chunk-size warnings; dependencies and build configuration were not changed.

Complete test command:

```text
node --test tests/battleSkillData.test.cjs tests/runPlanner.test.cjs tests/runPlannerHardening.test.cjs tests/theme.test.cjs tests/routeExport.test.cjs tests/rankLearning.test.cjs
```

Local ignored verification logs: `phase-2kb-all-tests.log`, `phase-2kb-data-tests.log`, `phase-2kb-build.log`, and `phase-2kb-lint.log`. The source import, coverage report and self-checks can be repeated without rebuilding the application. No commit or push was performed.

## Files

Created:

- `scripts/importBattleSkills.py`
- `scripts/checkBattleSkills.cjs`
- `src/types/battleSkill.ts`
- `src/data/wazaSource.ts`
- `src/data/battleSkills.ts`
- `src/data/legacyTechIdentities.ts`
- `src/utils/battleSkillDecoder.ts`
- `src/utils/battleSkillCompatibility.ts`
- `src/utils/battleSkillValidation.ts`
- `src/utils/encounterBattleSkills.ts`
- `tests/battleSkillData.test.cjs`
- `docs/phase-2k-b/VALIDATION.md`
- `docs/phase-2k-b/coverage.json`
- `docs/phase-2k-b/legacy-data-changes.json`

Modified: `src/data/techs.ts`, `src/utils/techLookup.ts`, `src/utils/dataSelfChecks.ts`, `src/utils/battleEngine.ts` (encounter lookup boundary only), `src/components/BattleSimulation.tsx` (asynchronous rejection handling only), `tests/runPlanner.test.cjs` (three audit expectations).

Removed: unused `src/data/tech_data.csv`.

No battle-resolution behavior was intentionally redesigned. No MP consumption, Guard, hit/miss, status behavior/recovery, Counter/Interrupt/Assist scheduling, frame timing, Planner integration or new simulator workflow was implemented. Authoritative data corrections and explicit rejection of incomplete inputs are the intentional observable differences.
