# Phase 2K-L3 — Canonical data corrections

Implemented on `phase-2k-l3-canonical-data-corrections` from committed baseline `7cc490c`, which includes L2 commit `57fc1a4`. No commit or push performed.

P-Sukamon now resolves as Machine at the canonical species layer. **Wing Blade already resolves as Interrupt + Nature in the committed baseline.** The reported Neutral classification was not reproduced in raw data, decoder, canonical record, compatibility projection or battle input. Neither proposed error case A nor B applies: raw and runtime already agree with the reviewed rule. This phase protects that rule with regressions rather than inventing an override or rewriting correct bytes.

## Files (final-report items 1–2)

Created: `tests/canonicalDataL3.test.cjs`, this document, `canonical-data-audit.json`, `verification.json`.

Modified: `src/data/digimons.ts`, `src/data/digimon_data.csv`, `src/utils/dataSelfChecks.ts`, `src/utils/battleSkillValidation.ts`, `tests/runPlanner.test.cjs`.

## P-Sukamon provenance and consumers (3–11, 27–32)

Canonical ID `p-sukamon`, display name `P-Sukamon`, type Virus. The previous runtime specialty was Dark in the hand-maintained `DIGIMONS` catalog (`src/data/digimons.ts`). The auxiliary CSV also said Dark. Both records entered the repository in `0a2ede5`. No species generator or runtime CSV consumer was found; the CSV is aligned with the canonical correction so it cannot reintroduce stale data.

The user's authoritative review identifies MetalKid's Dark classification as incorrect and specifies Machine. Local records do not carry per-row external provenance; this attribution comes from the user, not a new external verification. No more authoritative raw species-specialty source was found locally. The inline provenance comment and audit JSON retain the Dark-to-Machine distinction. Ordinary UI receives no source warning.

`getSpecies`, `getDigimonById`, `getDigimonByName` and `ALL_SPECIES` derive from the same catalog. There are no dedicated P-Sukamon aliases in the alias table. Existing case/punctuation normalization resolves P-Sukamon, p-sukamon, P Sukamon, P.Sukamon and PSUKAMON to the same entry. No new species or speculative alias was added.

| Consumer | Result / existing behavior |
| --- | --- |
| Team Builder | Reads DIGIMONS; server-rendered DigimonCard displays Machine. |
| Planner | Identity-based roster adapter resolves Machine. The ordinary roster card does not expose a specialty field; no field was added. |
| Historical reconstruction | historicalPlayerTeam resolves current canonical identity to Machine without mutating stored roster data. |
| Saved runs | Persist identity/stats/techs, not a copied specialty. No migration; schema remains v7. |
| Encounters / BattleInput | All P-Sukamon encounter slots and reconstructed player input resolve Machine through production adapters. |
| Damage | Defender specialty participates in the existing elemental matchup. |
| Attack element | Comes from the selected skill; species specialty does not replace the outgoing skill element. |
| Floor specialty | Existing matching species-floor DEF bonus now applies to Machine. Skill element independently controls the existing floor AP bonus. |
| AI/search | Consumes the resulting battle state/damage; no species-specific branch or architecture change. |
| Reports / exports | Canonical specialty snapshots as Machine; serializers unchanged. |
| Selectors | Existing species selectors filter names; no new specialty filtering was introduced. |

A full structural comparison of baseline and current 202-species arrays found exactly one changed property: p-sukamon.specialty, Dark to Machine. No unrelated discrepancy was established or corrected.

## Wing Blade raw audit (12–20, 27–31)

Full technique ID `0x00A1` (161), canonical name Wing Blade; WAZADATA row 258, label `Garudamon – Wing Blade`, from `DW2 Modding Info.xlsx`. Its full 68 bytes are preserved in the audit JSON.

First four bytes: `A1 00 98 22`. Byte 3 (`0x98`) has high nibble 9 = interrupt-target and low nibble 8 = Interrupt/projectile. Byte 4 (`0x22`) has high nibble 2 = Ultimate and low nibble 2 = Nature. AP is 35 (raw 70); MP is 20. Action kind and element remain independent fields.

Pipeline: workbook → `scripts/importBattleSkills.py` → `src/data/wazaSource.ts` → generic `battleSkillDecoder.ts` → `BATTLE_SKILLS` → `toLegacyTech` / `TECHS` and historical analysis → BattleInput → engine/history/report. Every inspected stage already retains Nature. `legacyTechIdentities` provides compatibility identities, not a replacement element. No shared decoder defect was found.

V-Wing Blade is a separate `0x0031` (49) record, WAZADATA row 100, Attack/projectile/one-enemy, Ultimate/Neutral, bytes 3–4 `50 25`; it remains unchanged. There is no alias collision.

The source fingerprint remains `00a1f844`. Reimporting the workbook is stable on repeated runs and produces no Git content diff. The first import normalized the Windows working copy from CRLF to LF; subsequent generated files were byte-identical. Working-copy line endings were restored afterward without changing content. Workbook `--check` passes all 68 bytes, labels, effect dictionary and provenance. No generated semantic record or raw workbook byte was edited.

Two canonical-ID self-checks now enforce P-Sukamon Machine and Wing Blade Interrupt/Nature. Battle checks increase from 11 to 12; aggregate data checks increase from 61 to 63.

## Engine characterization (21–26, 33–37, 59)

The new tests load the real canonical records and execute the production engine. Damage expectations use `calculateActionDamage`, not a copied formula. Neutral controls are hypothetical comparisons, **not evidence of a previous Neutral runtime value**.

| Controlled Wing Blade fixture | Damage |
| --- | ---: |
| Generic Machine defender, no floor | 42 |
| Same state, Nature floor | 50 |
| Same state, Water floor | 42 |
| Canonical Virus P-Sukamon, no floor | 33 |
| Same P-Sukamon, Machine floor | 27 |
| P-Sukamon with old Dark value as test-only control, no floor | 22 |

P-Sukamon equals an otherwise identical Machine control. Nature beats Machine through the unchanged cycle Water > Fire > Nature > Machine > Darkness > Water. Nature floor boosts Wing Blade through the ordinary attack-element path; Interrupts are not excluded. Machine floor reduces damage to P-Sukamon through ordinary DEF behavior.

Wing Blade executes as an Interrupt against the interrupted player, restarts the original action, retains Hit 761f / Miss 270f, and does not activate Counter. Miss/restart tests cover Natural and TAS Luck. Existing full-suite Interrupt tests cover opportunity generation, same-side executor constraints, cancellation/deletion, precheck, target resolution and recovery behavior; no relevant production code changed.

Compatibility/historical skill projections and planned action metadata retain Nature and Interrupt. Team Builder's P-Sukamon card was rendered on the server. Report integration runs Random Monte Carlo, exports Machine/Nature/Wing Blade, preserves executed Interrupt actions, and round-trips JSON. Simulation Report remains v1. No serializer-specific correction exists. Smoke was engine/data/report-backed, with server rendering for the species card; no browser smoke is claimed.

## Verification and boundaries (38–69)

All 2,974 tests passed (baseline 2,952 plus 22 focused tests), with zero failures, skips or cancellations. This includes canonical data, damage/floors, Interrupt/Counter, Natural/TAS, Random Monte Carlo, Optimized Search, Fastest Potential, Average Victory, Success Rate, L2 Poison timing, L1a TAS, Planner/history/multiple runs, story/Coliseum, navigation, reports, Markdown and JSON regressions.

Data self-checks: 63/63. Battle-skill checks: 12/12. Effect coverage: 598 classified occurrences, 101 groups, 370 authoritative occurrences, zero used deferred occurrences, five unused dictionary rows. Workbook check and both TypeScript projects pass. Production build passes (13.44s), with existing chunk-size/Browserslist warnings. Lint remains at its existing 3 errors and 7 warnings: empty interfaces in command.tsx/textarea.tsx, require in tailwind.config.ts, and seven Fast Refresh warnings. No new lint findings; unrelated debt is untouched. `git diff --check` passes.

Only P-Sukamon's canonical specialty needed a data correction; Wing Blade's already-correct reviewed classification is now guarded. No unrelated species specialty or skill action/element changed, and no battle-engine name/ID special case was introduced.

L2 direct Poison same-hit +10, Poison Power delayed first-hit bonus, subsequent impacts and Poison Wave remain covered and unchanged. L1a TAS still branches only for Enemy Confusion/Paralysis action conflicts. Search architecture, 2,197-plan enumeration, 4→16→64 refinement, beam/common RNG/ranking and all objective semantics are unchanged. Outcomes may change where P-Sukamon's corrected defender specialty affects a battle.

Planner XP, Bits, growth, level-up, DNA, trades, capture, story, Coliseum and storage are unchanged. Schema remains v7. Report remains v1. Final navigation remains Run Planner → Team Builder → Battle Simulation → Results, with Run Planner default. How to Use and Phase 2L-C are untouched. No commit or push performed.
